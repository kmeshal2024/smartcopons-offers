import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
  try {
    await requireAdmin()

    const flyers = await prisma.flyer.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        supermarket: {
          select: { id: true, name: true, nameAr: true, slug: true },
        },
        _count: {
          select: { productOffers: true },
        },
      },
    })

    return NextResponse.json({ flyers })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to fetch flyers' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { supermarketId, title, titleAr, startDate, endDate, cityId } = body

    if (!supermarketId || !title || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields: supermarketId, title, startDate, endDate' },
        { status: 400 }
      )
    }

    const flyer = await prisma.flyer.create({
      data: {
        supermarketId,
        title,
        titleAr: titleAr || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        cityId: cityId || null,
        status: 'DRAFT',
      },
      include: {
        supermarket: {
          select: { nameAr: true },
        },
      },
    })

    return NextResponse.json({ flyer }, { status: 201 })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error creating flyer:', error)
    return NextResponse.json({ error: 'Failed to create flyer' }, { status: 500 })
  }
}
