import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { invalidateOffers } from '@/lib/cache-invalidation'

/**
 * One-shot consolidation: collapse duplicate ACTIVE flyers per retailer.
 *
 * BACKGROUND
 * The retired ClicFlyer aggregator cron created a fresh flyer row every night
 * without marking the previous ACTIVE one EXPIRED, and `cleanup-expired` only
 * touches status=EXPIRED — so ACTIVE-but-superseded records piled up. Snapshot
 * at the time this was written: 86 total flyer records where ~24 was correct.
 * union-coop had ten ACTIVE flyers, only ONE of them carrying the 438 offer
 * rows that actually power the UAE store page; the other nine were empty.
 *
 * RULE (revised 2026-08-19)
 * A store legitimately carries TWO kinds of ACTIVE flyer row at once: the
 * offers CONTAINER (hundreds of ProductOffer rows attached by the nightly
 * scrape) and the weekly LEAFLET (pageImages/pdfUrl, zero offers). The first
 * version of this route kept exactly one flyer per store, ranked by offer
 * count — which would demote every leaflet row, PDFs included, and blank the
 * flyer pages. So:
 *   1. Group a store's ACTIVE flyers by week (start-of-week of startDate) and
 *      keep the best row per week: most offers, then most pages, then has a
 *      PDF, then newest createdAt. This kills the true duplicates.
 *   2. Among the surviving pure leaflets (zero offers, totalPages > 0), keep
 *      only the NEWEST week — an old leaflet whose endDate was extended is
 *      superseded content.
 *   3. Surviving zero-offer, zero-page rows are demoted too when the store has
 *      any content-bearing row left.
 * Demoted rows get `status = EXPIRED` and a past `endDate` so `cleanup-expired`
 * retires them on its normal cycle.
 *
 * WHY NOT DELETE
 * Rows are kept, only demoted. Reversible via one UPDATE if anything looks
 * wrong, and existing `ProductOffer.flyerId` FKs stay intact. If a demoted
 * flyer turns out to have been the wrong one to demote, its offers are still
 * queryable by id.
 *
 * SAFE BY DEFAULT
 * Dry-run unless the body contains {"apply": true}. Reports what WOULD be
 * demoted so you can eyeball the winner picks before acting.
 *
 *   # dry run
 *   curl -X POST https://sa.smartcopons.com/api/admin/consolidate-flyers \
 *        -H "Authorization: Bearer $APP_SECRET"
 *
 *   # apply
 *   curl -X POST https://sa.smartcopons.com/api/admin/consolidate-flyers \
 *        -H "Authorization: Bearer $APP_SECRET" \
 *        -H "Content-Type: application/json" -d '{"apply":true}'
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 120

async function run(apply: boolean) {
  const now = new Date()

  const flyers = await prisma.flyer.findMany({
    where: { status: 'ACTIVE', endDate: { gte: now } },
    select: {
      id: true,
      supermarketId: true,
      supermarket: { select: { slug: true } },
      startDate: true,
      createdAt: true,
      totalPages: true,
      pdfUrl: true,
      _count: { select: { productOffers: true } },
    },
  })

  const byRetailer = new Map<string, typeof flyers>()
  for (const f of flyers) {
    const arr = byRetailer.get(f.supermarketId) ?? []
    arr.push(f)
    byRetailer.set(f.supermarketId, arr)
  }

  const plan: Array<{
    retailer: string
    keep: { id: string; offers: number; startDate: string }
    demote: Array<{ id: string; offers: number; startDate: string }>
  }> = []

  // Array.from rather than `for..of` on the Map iterator — tsconfig targets a
  // pre-ES2015 iteration mode, so iterating a Map directly needs
  // --downlevelIteration. Same lesson as the shared-list id generator.
  const weekOf = (d: Date | string) => {
    const w = new Date(d)
    w.setUTCDate(w.getUTCDate() - w.getUTCDay())
    return w.toISOString().slice(0, 10)
  }

  // Best row within one week: most offers, then most pages, then has-a-PDF,
  // then newest createdAt.
  const better = (a: (typeof flyers)[number], b: (typeof flyers)[number]) => {
    const off = (b._count.productOffers || 0) - (a._count.productOffers || 0)
    if (off !== 0) return off
    const pages = (b.totalPages || 0) - (a.totalPages || 0)
    if (pages !== 0) return pages
    const pdf = (b.pdfUrl ? 1 : 0) - (a.pdfUrl ? 1 : 0)
    if (pdf !== 0) return pdf
    return +new Date(b.createdAt) - +new Date(a.createdAt)
  }

  for (const arr of Array.from(byRetailer.values())) {
    if (arr.length < 2) continue

    // 1. one winner per week
    const byWeek = new Map<string, typeof arr>()
    for (const f of arr) {
      const k = weekOf(f.startDate)
      const g = byWeek.get(k) ?? []
      g.push(f)
      byWeek.set(k, g)
    }
    const weekWinners = Array.from(byWeek.values()).map(g => [...g].sort(better)[0])
    const losers = arr.filter(f => !weekWinners.includes(f))

    // 2. only the newest pure leaflet survives; older ones are superseded
    const leaflets = weekWinners
      .filter(f => (f._count.productOffers || 0) === 0 && (f.totalPages || 0) > 0)
      .sort((a, b) => +new Date(b.startDate) - +new Date(a.startDate))
    losers.push(...leaflets.slice(1))

    // 3. empty winners (no offers, no pages) go too, unless nothing else is left
    const keepers = weekWinners.filter(f => !losers.includes(f))
    const hasContent = keepers.some(
      f => (f._count.productOffers || 0) > 0 || (f.totalPages || 0) > 0
    )
    if (hasContent) {
      for (const f of keepers) {
        if ((f._count.productOffers || 0) === 0 && (f.totalPages || 0) === 0) losers.push(f)
      }
    }

    if (!losers.length) continue
    const kept = arr.filter(f => !losers.includes(f))
    const primary = [...kept].sort(better)[0]

    plan.push({
      retailer: primary.supermarket?.slug ?? primary.supermarketId,
      keep: {
        id: kept.map(k => k.id).join(','),
        offers: kept.reduce((n, k) => n + (k._count.productOffers || 0), 0),
        startDate: kept
          .map(k => new Date(k.startDate).toISOString().slice(0, 10))
          .join(','),
      },
      demote: losers.map(l => ({
        id: l.id,
        offers: l._count.productOffers || 0,
        startDate: new Date(l.startDate).toISOString().slice(0, 10),
      })),
    })
  }

  let demotedCount = 0
  if (apply && plan.length) {
    // Batched update: one UPDATE per plan entry rather than one per flyer, so
    // Neon takes fewer round-trips and the compute wake stays short.
    for (const p of plan) {
      const res = await prisma.flyer.updateMany({
        where: { id: { in: p.demote.map(d => d.id) } },
        data: {
          status: 'EXPIRED',
          // A second in the past so cleanup-expired's `endDate < now` filter
          // catches it on the next Sunday run.
          endDate: new Date(now.getTime() - 1000),
        },
      })
      demotedCount += res.count
    }
    invalidateOffers()
  }

  return {
    applied: apply,
    retailersWithDuplicates: plan.length,
    wouldDemote: plan.reduce((n, p) => n + p.demote.length, 0),
    demoted: apply ? demotedCount : 0,
    plan,
  }
}

export async function POST(request: Request) {
  const secret = process.env.APP_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json().catch(() => null)
  const apply = !!(body && typeof body === 'object' && (body as any).apply === true)
  return NextResponse.json(await run(apply))
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed. Use POST with an Authorization: Bearer header.' },
    { status: 405, headers: { Allow: 'POST' } }
  )
}
