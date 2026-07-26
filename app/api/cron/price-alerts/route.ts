import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { arabicContainsFilter } from '@/lib/arabic-search'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { sendToShopper } from '@/lib/push'

/**
 * Turn price watches into actual notifications.
 *
 * For each watch, find the cheapest CURRENT offer for the same item (matched by
 * Arabic-variant name, so it survives the offer row being replaced each flyer)
 * and push when it drops below the target — or below the price at the time the
 * watch was created.
 *
 * lastNotifiedPrice stops the same drop being announced every night: we only
 * alert again if the price fell *further* than the last thing we told them.
 *
 * Runs from the daily cron after the scrapers land.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_WATCHES_PER_RUN = 500

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const started = Date.now()
  const watches = await prisma.priceWatch.findMany({
    take: MAX_WATCHES_PER_RUN,
    orderBy: { createdAt: 'asc' },
  })

  let checked = 0
  let dropped = 0
  let notified = 0

  for (const w of watches) {
    checked++
    const term = w.nameKey.trim().slice(0, 60)
    if (term.length < 4) continue

    const best = await prisma.productOffer.findFirst({
      where: {
        isHidden: false,
        price: { gt: 0 },
        flyer: { endDate: { gte: new Date() } },
        OR: arabicContainsFilter(term, ['nameAr', 'nameEn']),
      },
      orderBy: { price: 'asc' },
      select: { id: true, price: true, nameAr: true, supermarket: { select: { nameAr: true } } },
    })
    if (!best) continue

    const threshold = w.targetPrice ?? w.basePrice
    if (best.price >= threshold) continue
    dropped++

    // Only speak up if this beats whatever we last told them about.
    if (w.lastNotifiedPrice != null && best.price >= w.lastNotifiedPrice) continue

    const name = (best.nameAr || w.nameKey).slice(0, 40)
    const saved = (threshold - best.price).toFixed(2)
    const sent = await sendToShopper(w.shopperId, {
      title: '💰 نزل السعر!',
      body: `${name} الآن بـ ${best.price.toFixed(2)} ر.س في ${best.supermarket.nameAr} — وفّر ${saved} ر.س`,
      url: `/product/${best.id}`,
      tag: `watch-${w.id}`,
    })

    if (sent > 0) {
      notified++
      await prisma.priceWatch
        .update({ where: { id: w.id }, data: { lastNotifiedPrice: best.price } })
        .catch(() => {})
    }
  }

  return NextResponse.json({
    success: true,
    checked,
    dropped,
    notified,
    durationMs: Date.now() - started,
  })
}
