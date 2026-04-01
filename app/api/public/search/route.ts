import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const type = searchParams.get('type') || 'all' // 'all' | 'products' | 'coupons'

    if (!query || query.length < 2) {
      return NextResponse.json({ products: [], coupons: [], total: 0 })
    }

    const results: any = { products: [], coupons: [], total: 0 }

    if (type === 'all' || type === 'products') {
      const products = await prisma.productOffer.findMany({
        where: {
          isHidden: false,
          OR: [
            { nameAr: { contains: query } },
            { nameEn: { contains: query } },
            { brand: { contains: query } },
            { tags: { contains: query } },
          ],
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
            { title: { contains: query } },
            { code: { contains: query } },
            { discountText: { contains: query } },
            { store: { name: { contains: query } } },
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

    results.total = results.products.length + results.coupons.length

    return NextResponse.json(results)
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}
