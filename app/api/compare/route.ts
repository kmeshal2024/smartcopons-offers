import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { arabicContainsFilter } from '@/lib/arabic-search'

// GET /api/compare?q=productName
// Returns the same product across stores side-by-side, with each store's
// cheapest CURRENT price, discount, validity, difference-from-cheapest, and a
// 30-day price history for the sparkline.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()

    if (q.length < 2) {
      return NextResponse.json({ query: q, rows: [], cheapestPrice: null, productName: q })
    }

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000)

    const match = {
      isHidden: false,
      OR: arabicContainsFilter(q, ['nameAr', 'nameEn', 'brand', 'tags']),
    }

    // Current offers (within an active validity window) for the comparison rows.
    const current = await prisma.productOffer.findMany({
      where: { ...match, flyer: { endDate: { gte: now } } },
      orderBy: { price: 'asc' },
      include: {
        supermarket: { select: { id: true, nameAr: true, name: true, slug: true, logo: true } },
        flyer: { select: { endDate: true, startDate: true } },
      },
      take: 200,
    })

    if (current.length === 0) {
      return NextResponse.json({ query: q, rows: [], cheapestPrice: null, productName: q })
    }

    // Keep the cheapest current offer per store.
    const perStore = new Map<string, (typeof current)[number]>()
    for (const o of current) {
      const prev = perStore.get(o.supermarketId)
      if (!prev || o.price < prev.price) perStore.set(o.supermarketId, o)
    }

    // 30-day history across the same matched product (all involved stores).
    const storeIds = Array.from(perStore.keys())
    const historyRows = await prisma.productOffer.findMany({
      where: { ...match, supermarketId: { in: storeIds }, createdAt: { gte: thirtyDaysAgo } },
      select: { supermarketId: true, price: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    // Group → one point per day per store (min price that day).
    const histByStore = new Map<string, Map<string, number>>()
    for (const h of historyRows) {
      const day = h.createdAt.toISOString().slice(0, 10)
      if (!histByStore.has(h.supermarketId)) histByStore.set(h.supermarketId, new Map())
      const m = histByStore.get(h.supermarketId)!
      const existing = m.get(day)
      if (existing == null || h.price < existing) m.set(day, h.price)
    }

    const cheapestPrice = Math.min(...Array.from(perStore.values()).map((o) => o.price))

    const rows = Array.from(perStore.values())
      .map((o) => {
        const dayMap = histByStore.get(o.supermarketId)
        const history = dayMap
          ? Array.from(dayMap.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, price]) => ({ date, price }))
          : []
        // Ensure the current price is the last point.
        const today = now.toISOString().slice(0, 10)
        if (!history.length || history[history.length - 1].date !== today) {
          history.push({ date: today, price: o.price })
        }
        return {
          productName: o.nameAr || o.nameEn || q,
          imageUrl: o.imageUrl,
          sizeText: o.sizeText,
          supermarket: o.supermarket,
          price: o.price,
          oldPrice: o.oldPrice,
          discountPercent: o.discountPercent,
          validUntil: o.flyer?.endDate ?? null,
          isCheapest: o.price === cheapestPrice,
          diffFromCheapest: +(o.price - cheapestPrice).toFixed(2),
          history,
        }
      })
      .sort((a, b) => a.price - b.price)

    return NextResponse.json({
      query: q,
      productName: rows[0]?.productName ?? q,
      cheapestPrice,
      storeCount: rows.length,
      rows,
    })
  } catch (error) {
    console.error('Error comparing prices:', error)
    return NextResponse.json({ error: 'Failed to compare prices' }, { status: 500 })
  }
}
