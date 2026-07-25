import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { arabicContainsFilter } from '@/lib/arabic-search'
import { hasEnoughContent } from '@/lib/retailer-visibility'

/**
 * Autocomplete search. Optimised for latency:
 *  - only the trigram-indexed columns are searched (nameAr/nameEn/brand); tags
 *    was a big unindexed text field that forced a scan.
 *  - the four result kinds run in one Promise.all instead of one after another.
 *  - responses are edge-cached: popular terms come back instantly on repeat.
 * See /api/admin/optimize-search for the indexes this relies on.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const type = searchParams.get('type') || 'all' // 'all' | 'products' | 'coupons'

    if (!query || query.length < 2) {
      return NextResponse.json({ products: [], coupons: [], stores: [], categories: [], total: 0 })
    }

    const wantProducts = type === 'all' || type === 'products'
    const wantCoupons = type === 'all' || type === 'coupons'
    const wantGroups = type === 'all'

    const [products, coupons, stores, categories] = await Promise.all([
      wantProducts
        ? prisma.productOffer.findMany({
            where: {
              isHidden: false,
              price: { gt: 0 },
              flyer: { endDate: { gte: new Date() } },
              // Arabic-variant aware over the indexed columns only.
              OR: arabicContainsFilter(query, ['nameAr', 'nameEn', 'brand']),
            },
            take: 10,
            orderBy: { viewCount: 'desc' },
            include: {
              supermarket: { select: { id: true, nameAr: true, slug: true, logo: true } },
              category: { select: { nameAr: true, icon: true } },
            },
          })
        : Promise.resolve([]),

      wantCoupons
        ? prisma.coupon.findMany({
            where: {
              isActive: true,
              OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { code: { contains: query, mode: 'insensitive' } },
                { discountText: { contains: query, mode: 'insensitive' } },
                { store: { name: { contains: query, mode: 'insensitive' } } },
              ],
            },
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: { store: { select: { name: true, slug: true, logo: true } } },
          })
        : Promise.resolve([]),

      wantGroups
        ? prisma.supermarket.findMany({
            where: { isActive: true, OR: arabicContainsFilter(query, ['nameAr', 'name']) },
            take: 12,
            orderBy: { viewCount: 'desc' },
            select: {
              id: true,
              nameAr: true,
              slug: true,
              logo: true,
              _count: {
                select: {
                  productOffers: { where: { isHidden: false } },
                  flyers: { where: { status: 'ACTIVE', endDate: { gte: new Date() } } },
                },
              },
            },
          })
        : Promise.resolve([]),

      wantGroups
        ? prisma.category.findMany({
            where: { isActive: true, OR: arabicContainsFilter(query, ['nameAr', 'nameEn']) },
            take: 5,
            orderBy: { order: 'asc' },
            select: { id: true, nameAr: true, slug: true, icon: true },
          })
        : Promise.resolve([]),
    ])

    // Don't suggest retailers whose page has nothing on it.
    const visibleStores = (stores as any[])
      .filter(s => hasEnoughContent(s._count))
      .slice(0, 5)
      .map(({ _count, ...store }) => store)

    const results = {
      products,
      coupons,
      stores: visibleStores,
      categories,
      total: products.length + coupons.length + visibleStores.length + categories.length,
    }

    return NextResponse.json(results, {
      // Autocomplete queries repeat heavily; let the edge serve popular terms.
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
