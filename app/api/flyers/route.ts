import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const supermarketId = searchParams.get('supermarket')
    const cityId = searchParams.get('city')

    const where: any = {
      status: 'ACTIVE',
      endDate: { gte: new Date() },
    }

    if (supermarketId) where.supermarketId = supermarketId
    if (cityId) where.cityId = cityId

    const flyers = await prisma.flyer.findMany({
      where,
      orderBy: { startDate: 'desc' },
      include: {
        supermarket: {
          select: {
            name: true,
            nameAr: true,
            slug: true,
            logo: true,
          },
        },
        city: {
          select: {
            nameAr: true,
            nameEn: true,
          },
        },
        _count: {
          select: {
            productOffers: {
              where: { isHidden: false },
            },
          },
        },
      },
    })

    return NextResponse.json({ flyers })
  } catch (error) {
    console.error('Error fetching flyers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch flyers' },
      { status: 500 }
    )
  }
}