import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { invalidateCoupons } from '@/lib/cache-invalidation'

/**
 * Load owned partner codes.
 *
 * These are the site owner's own codes, so this is a revenue surface rather than
 * a catalogue: a handful shown at the moment of purchase intent, not a hundred
 * on a standalone page. No affiliate URL is required — in the GCC programmes
 * these run through, the CODE is the attribution.
 *
 * Idempotent, keyed on the code, so re-running updates in place rather than
 * duplicating. Send a body to add or change codes without a deploy:
 *
 *   curl -X POST https://sa.smartcopons.com/api/admin/seed-owned-coupons \
 *     -H "Authorization: Bearer $APP_SECRET" -H "Content-Type: application/json" \
 *     -d '{"coupons":[{"code":"P8MO","title":"كود خصم النهدي","discountText":"خصم حتى 40%","brand":"النهدي","supermarketSlug":"nahdi","validUntil":"2026-12-31"}]}'
 *
 * With no body it loads the defaults below — the Saudi grocery-adjacent codes
 * recovered from the WordPress export.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 120

interface Incoming {
  code: string
  title: string
  discountText: string
  brand: string
  /** Links the code to a retailer page, enabling the retailer strip. */
  supermarketSlug?: string
  /** ISO date. Omit for an evergreen code. */
  validUntil?: string
  isExclusive?: boolean
  affiliateUrl?: string
}

/** Recovered from the export; only the Saudi grocery-adjacent, published ones. */
const DEFAULTS: Incoming[] = [
  {
    code: 'P8MO',
    title: 'كود خصم النهدي',
    discountText: 'خصم حتى 40%',
    brand: 'صيدليات النهدي',
    supermarketSlug: 'nahdi',
  },
  {
    code: 'NN164',
    title: 'كود خصم نون مينتس',
    discountText: 'خصم على البقالة',
    brand: 'noon minutes',
  },
  {
    code: 'ZHW',
    title: 'كود خصم نون ناو ناو',
    discountText: 'خصم 10%',
    brand: 'noon NowNow',
  },
]

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) ||
  'store'

async function run(list: Incoming[]) {
  const results: Array<Record<string, unknown>> = []

  for (const c of list) {
    const code = (c.code || '').trim()
    if (!code) {
      results.push({ code: c.code, ok: false, error: 'missing code' })
      continue
    }

    try {
      // Coupon.storeId is required, so ensure a Store exists for the brand.
      const storeSlug = slugify(c.brand || code)
      const store = await prisma.store.upsert({
        where: { slug: storeSlug },
        update: {},
        create: { name: c.brand || code, slug: storeSlug, countries: 'SA' },
      })

      let supermarketId: string | null = null
      if (c.supermarketSlug) {
        const sm = await prisma.supermarket.findUnique({
          where: { slug: c.supermarketSlug },
          select: { id: true },
        })
        supermarketId = sm?.id ?? null
        if (!supermarketId) {
          results.push({ code, ok: false, error: `no supermarket "${c.supermarketSlug}"` })
          continue
        }
      }

      const data = {
        title: c.title || code,
        discountText: c.discountText || '',
        // Legacy non-null column; nothing reads it any more.
        url: '#',
        affiliateUrl: c.affiliateUrl || null,
        validUntil: c.validUntil ? new Date(c.validUntil) : null,
        isExclusive: c.isExclusive ?? false,
        isActive: true,
        storeId: store.id,
        supermarketId,
      }

      const existing = await prisma.coupon.findFirst({ where: { code }, select: { id: true } })
      if (existing) {
        await prisma.coupon.update({ where: { id: existing.id }, data })
        results.push({ code, ok: true, action: 'updated', supermarketId })
      } else {
        await prisma.coupon.create({ data: { code, ...data } })
        results.push({ code, ok: true, action: 'created', supermarketId })
      }
    } catch (e: any) {
      results.push({ code, ok: false, error: String(e?.message).slice(0, 160) })
    }
  }

  // CRITICAL. The surfaces gate on "active and not expired" — no affiliate URL
  // required, because the code is the attribution. That means every one of the
  // 106 LEGACY third-party rows (AliExpress, Namshi, Gamivo…) would instantly
  // become renderable and could appear in a shopper's list. Those were retired
  // for good reasons and are not the owner's codes.
  //
  // So anything not in the owned set is deactivated. Rows are KEPT — this is
  // isActive = false, not a delete — so it is fully reversible, and the table
  // stays intact as agreed.
  const ownedCodes = list.map(c => (c.code || '').trim()).filter(Boolean)
  const deactivated = await prisma.coupon.updateMany({
    where: { isActive: true, code: { notIn: ownedCodes } },
    data: { isActive: false },
  })

  invalidateCoupons()

  const renderable = await prisma.coupon.count({
    where: {
      isActive: true,
      OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
    },
  })

  return {
    results,
    failed: results.filter(r => !r.ok).length,
    legacyDeactivated: deactivated.count,
    renderableCoupons: renderable,
  }
}

export async function POST(request: Request) {
  const secret = process.env.APP_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json().catch(() => null)
  const list: Incoming[] = Array.isArray(body?.coupons) && body.coupons.length ? body.coupons : DEFAULTS
  return NextResponse.json(await run(list))
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed. Use POST with an Authorization: Bearer header.' },
    { status: 405, headers: { Allow: 'POST' } }
  )
}
