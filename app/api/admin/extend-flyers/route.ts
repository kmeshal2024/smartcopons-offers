import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Keep manually-imported store flyers visible.
 *
 * The ClicFlyer UAE stores (Almaya, ADCOOP, Aswaaq, GALA, Ansar Gallery,
 * Geant, K.M Trading, Union Coop, Nesto AE) are imported by hand from flyer
 * images — there is no nightly scraper re-attaching them to a fresh flyer.
 * `offer-ingest` gives each import a flyer whose endDate is that week's
 * Saturday, so once the week passes the store page filter
 * (`flyer.endDate >= now`) hides every offer and the store looks empty.
 *
 * This bumps those stores' flyers' endDate forward and marks them ACTIVE, so
 * the offers stay live. Idempotent — safe to run daily from a cron to keep
 * them from lapsing (see /api/cron/refresh-imported).
 *
 * Guarded by APP_SECRET.
 *   POST { "key":"…", "supermarkets"?: ["slug"], "days"?: 45 }
 */
export const dynamic = 'force-dynamic'

const DEFAULT_STORES = [
  'almaya', 'adcoop', 'aswaaq', 'gala', 'ansar-gallery',
  'geant', 'km-trading', 'union-coop', 'nesto-ae',
]

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { key, supermarkets, days } = body as {
    key?: string
    supermarkets?: string[]
    days?: number
  }

  const appSecret = process.env.APP_SECRET
  if (!appSecret || key !== appSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const slugs = Array.isArray(supermarkets) && supermarkets.length ? supermarkets : DEFAULT_STORES
  const window = Number.isFinite(days) && (days as number) > 0 ? (days as number) : 45
  const now = new Date()
  const newEnd = new Date(now.getTime() + window * 24 * 60 * 60 * 1000)

  const stores = await prisma.supermarket.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  })

  const updated: Record<string, number> = {}
  for (const s of stores) {
    const r = await prisma.flyer.updateMany({
      where: { supermarketId: s.id },
      data: { endDate: newEnd, status: 'ACTIVE' },
    })
    updated[s.slug] = r.count
  }

  return NextResponse.json({
    success: true,
    until: newEnd.toISOString().slice(0, 10),
    updated,
  })
}
