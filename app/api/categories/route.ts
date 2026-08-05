import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { countryFromRequest } from '@/lib/countries'

export async function GET(request: Request) {
  try {
    const country = countryFromRequest(request)
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
          include: {
            _count: {
              select: {
                products: {
                  where: { isHidden: false, country },
                },
              },
            },
          },
        },
        _count: {
          select: {
            products: {
              where: { isHidden: false, country },
            },
          },
        },
      },
    })

    const response = NextResponse.json({ categories })
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    return response
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}