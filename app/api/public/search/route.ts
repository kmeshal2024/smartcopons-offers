import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { arabicContainsFilter } from '@/lib/arabic-search'
import { hasEnoughContent } from '@/lib/retailer-visibility'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const type = searchParams.get('type') || 'all' // 'all' | 'products' | 'coupons'

    if (!query || query.length < 2) {
      return NextResponse.json({ products: [], coupons: [], stores: [], categories: [], total: 0 })
    }

    const results: any = { products: [], coupons: [], stores: [], categories: [], total: 0 }

    if (type === 'all' || type === 'products') {
      const products = await prisma.productOffer.findMany({
        where: {
          isHidden: false,
          price: { gt: 0 },
          // Don't suggest products whose offer has already ended.
          flyer: { endDate: { gte: new Date() } },
          // Arabic-variant aware: "ارز" also matches "أرز", "بندة" matches "بنده".
          OR: arabicContainsFilter(query, ['nameAr', 'nameEn', 'brand', 'tags']),
        },
        take: 10,
        orderBy: { viewCount: 'desc' },
        include: {
          supermarket: {
            select: {
              id: true,
              nameAr: true,
              slug: true,
              logo: true,
            },
          },
          category: {
            select: {
              nameAr: true,
              icon: true,
            },
          },
        },
      })
      results.products = products
    }

    if (type === 'all' || type === 'coupons') {
      const coupons = await prisma.coupon.findMany({
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
        include: {
          store: {
            select: {
              name: true,
              slug: true,
              logo: true,
            },
          },
        },
      })
      results.coupons = coupons
    }

    // Stores + categories are only needed for the grouped autocomplete ('all').
    if (type === 'all') {
      const [stores, categories] = await Promise.all([
        prisma.supermarket.findMany({
          where: {
            isActive: true,
            OR: arabicContainsFilter(query, ['nameAr', 'name']),
          },
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
        }),
        prisma.category.findMany({
          where: {
            isActive: true,
            OR: arabicContainsFilter(query, ['nameAr', 'nameEn']),
          },
          take: 5,
          orderBy: { order: 'asc' },
          select: { id: true, nameAr: true, slug: true, icon: true },
        }),
      ])
      // Don't suggest retailers whose page has nothing on it — tapping the
      // suggestion would land the shopper on an empty store.
      results.stores = stores
        .filter(s => hasEnoughContent(s._count))
        .slice(0, 5)
        .map(({ _count, ...store }) => store)
      results.categories = categories
    }

    results.total =
      results.products.length + results.coupons.length + results.stores.length + results.categories.length

    return NextResponse.json(results)
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}
