import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Counts one coupon copy. Called by trackCouponCopy() in lib/track.ts.
 *
 * Always answers 204, whatever happens. It is fired from a click that is usually
 * also opening the merchant in a new tab, so nothing reads the response, and an
 * error here must never surface in the shopper's console as a failed request.
 *
 * What keeps the numbers honest:
 *   - POST only, and only reachable from a real click — crawlers do not click.
 *   - Known bot user agents are dropped anyway.
 *   - `surface` is restricted to the known list, so the table cannot be filled
 *     with arbitrary strings.
 *   - The coupon must exist. An id is preferred; a code is accepted because one
 *     call site only has the code.
 * It does NOT deduplicate repeat copies by the same person — there is no
 * identifier to do it with, by design. Treat the figures as relative, not exact.
 */
export const dynamic = 'force-dynamic'

const SURFACES = new Set([
  'coupon_store_page',
  'coupons_explorer',
  'coupon_card',
  'offers_page',
  'retailer_page',
  'shopping_list',
  'product_page',
  'category_page',
])

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor/i

const done = () => new NextResponse(null, { status: 204 })

export async function POST(request: Request) {
  try {
    if (BOT.test(request.headers.get('user-agent') || '')) return done()

    const body: any = await request.json().catch(() => null)
    const surface = typeof body?.surface === 'string' ? body.surface : ''
    if (!SURFACES.has(surface)) return done()

    const id = typeof body?.id === 'string' ? body.id.slice(0, 40) : ''
    const code = typeof body?.code === 'string' ? body.code.slice(0, 60) : ''
    if (!id && !code) return done()

    const coupon =
      (id && (await prisma.coupon.findUnique({ where: { id }, select: { id: true } }))) ||
      (code &&
        (await prisma.coupon.findFirst({
          where: { code, isActive: true },
          select: { id: true },
          orderBy: { createdAt: 'desc' },
        }))) ||
      null
    if (!coupon) return done()

    // Riyadh day, so "today" in the stats matches the owner's calendar.
    const day = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10)
    await prisma.$executeRawUnsafe(
      `INSERT INTO coupon_copies ("couponId", day, surface, copies)
       VALUES ($1, $2::date, $3, 1)
       ON CONFLICT ("couponId", day, surface)
       DO UPDATE SET copies = coupon_copies.copies + 1`,
      coupon.id,
      day,
      surface
    )
  } catch {
    // Table not created yet, or the database is asleep. Not the shopper's problem.
  }
  return done()
}
