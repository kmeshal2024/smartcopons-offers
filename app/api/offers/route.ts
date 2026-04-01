import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const supermarketId = searchParams.get('supermarket')
    const categoryId = searchParams.get('category')
    const cityId = searchParams.get('city')
    const search = searchParams.get('search')
    const minPrice = searchParams.get('minPrice')
    const maxPrice = searchParams.get('maxPrice')
    const sort = searchParams.get('sort') || 'newest'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '24')
    const skip = (page - 1) * limit

    // Build filters
    const where: any = {
      isHidden: false,
    }

    // Only filter by active flyers if no direct product search
    if (!search && !supermarketId) {
      where.flyer = {
        status: 'ACTIVE',
        endDate: { gte: new Date() },
      }
    } else if (supermarketId) {
      where.supermarketId = supermarketId
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    if (cityId) {
      where.flyer = {
        ...(where.flyer || {}),
        cityId,
      }
    }

    if (search) {
      where.OR = [
        { nameAr: { contains: search } },
        { nameEn: { contains: search } },
        { brand: { contains: search } },
        { tags: { contains: search } },
      ]
    }

    if (minPrice || maxPrice) {
      where.price = {}
      if (minPrice) where.price.gte = parseFloat(minPrice)
      if (maxPrice) where.price.lte = parseFloat(maxPrice)
    }

    // Build orderBy
    let orderBy: any = { createdAt: 'desc' }

    switch (sort) {
      case 'price-low':
        orderBy = { price: 'asc' }
        break
      case 'price-high':
        orderBy = { price: 'desc' }
        break
      case 'discount':
        orderBy = { discountPercent: 'desc' }
        break
      case 'popular':
        orderBy = { viewCount: 'desc' }
        break
    }

    // Fetch products with pagination
    const [products, total] = await Promise.all([
      prisma.productOffer.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          supermarket: {
            select: {
              id: true,
              name: true,
              nameAr: true,
              slug: true,
              logo: true,
            },
          },
          category: {
            select: {
              id: true,
              nameAr: true,
              nameEn: true,
              slug: true,
              icon: true,
            },
          },
          flyer: {
            select: {
              id: true,
              title: true,
              titleAr: true,
              endDate: true,
            },
          },
        },
      }),
      prisma.productOffer.count({ where }),
    ])

    // Increment view counts (async, don't wait)
    if (products.length > 0) {
      const productIds = products.map(p => p.id)
      prisma.productOffer.updateMany({
        where: { id: { in: productIds } },
        data: { viewCount: { increment: 1 } },
      }).catch(() => {})
    }

    const response = NextResponse.json({
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })

    // Cache for 60 seconds on CDN/browser — reduces DB hits on shared hosting
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')

    return response
  } catch (error) {
    console.error('Error fetching offers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch offers' },
      { status: 500 }
    )
  }
}
