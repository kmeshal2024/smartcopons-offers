import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAuthorizedCron } from '@/lib/cron-auth'

/**
 * Cron: keep the hand-imported ClicFlyer UAE stores live.
 *
 * These stores (Almaya, ADCOOP, Aswaaq, GALA, Ansar Gallery, Geant,
 * K.M Trading, Union Coop, Nesto AE) are imported manually from flyer images —
 * unlike the SA stores, no nightly scraper re-attaches them to a fresh flyer.
 * Their import-time flyer ends on that week's Saturday, after which:
 *   1. the store page (`flyer.endDate >= now`) hides every offer, and
 *   2. `cleanup-expired` eventually HARD-DELETES the offers (cascade).
 *
 * This rolls those stores' flyers' endDate forward daily and keeps them ACTIVE,
 * so the manually-curated offers stay visible and are never garbage-collected.
 * Runs daily via vercel.json. Note: it does not refresh prices — those change
 * only on a fresh manual re-import; it just prevents silent disappearance.
 *
 *   Schedule: daily. Path: /api/cron/refresh-imported
 *   Manual:   curl "https://sa.smartcopons.com/api/cron/refresh-imported?key=$APP_SECRET"
 */
export const dynamic = 'force-dynamic'

const IMPORTED_STORES = [
  'almaya', 'adcoop', 'aswaaq', 'gala', 'ansar-gallery',
  'geant', 'km-trading', 'union-coop', 'nesto-ae',
]
const WINDOW_DAYS = 45

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const newEnd = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000)

    const stores = await prisma.supermarket.findMany({
      where: { slug: { in: IMPORTED_STORES } },
      select: { id: true, slug: true },
    })

    let flyersRenewed = 0
    for (const s of stores) {
      const r = await prisma.flyer.updateMany({
        where: { supermarketId: s.id },
        data: { endDate: newEnd, status: 'ACTIVE' },
      })
      flyersRenewed += r.count
    }

    return NextResponse.json({
      success: true,
      stores: stores.length,
      flyersRenewed,
      until: newEnd.toISOString().slice(0, 10),
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error('Cron refresh-imported error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
