import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const supermarketId = searchParams.get('supermarketId')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = 20

    const where: any = {}
    if (supermarketId) where.supermarketId = supermarketId
    if (search) {
      where.OR = [
        { nameAr: { contains: search } },
        { nameEn: { contains: search } },
        { brand: { contains: search } },
      ]
    }

    const [products, total] = await Promise.all([
      prisma.productOffer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          supermarket: { select: { nameAr: true } },
          category: { select: { nameAr: true } },
          flyer: { select: { title: true, endDate: true } },
        },
      }),
      prisma.productOffer.count({ where }),
    ])

    return NextResponse.json({
      products,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const {
      flyerId, supermarketId, categoryId,
      nameAr, nameEn, brand,
      price, oldPrice, discountPercent, sizeText,
      imageUrl, pageNumber, tags, isHidden,
    } = body

    if (!flyerId || !supermarketId || !price) {
      return NextResponse.json(
        { error: 'flyerId, supermarketId, and price are required' },
        { status: 400 }
      )
    }

    const product = await prisma.productOffer.create({
      data: {
        flyerId,
        supermarketId,
        categoryId: categoryId || null,
        nameAr: nameAr || null,
        nameEn: nameEn || null,
        brand: brand || null,
        price: parseFloat(price),
        oldPrice: oldPrice ? parseFloat(oldPrice) : null,
        discountPercent: discountPercent ? parseInt(discountPercent) : null,
        sizeText: sizeText || null,
        imageUrl: imageUrl || null,
        pageNumber: pageNumber || 1,
        tags: tags || null,
        isHidden: isHidden || false,
      },
    })

    return NextResponse.json({ product }, { status: 201 })
  } catch (error) {
    console.error('Create product error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
