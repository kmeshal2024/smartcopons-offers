import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hasEnoughContent } from '@/lib/retailer-visibility'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const all = await prisma.supermarket.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        nameAr: true,
        slug: true,
        logo: true,
        viewCount: true,
        _count: {
          select: {
            productOffers: { where: { isHidden: false } },
            flyers: {
              where: {
                status: 'ACTIVE',
                endDate: { gte: new Date() },
              },
            },
          },
        },
      },
      orderBy: { viewCount: 'desc' },
    })

    // Hide retailers with no real content — see lib/retailer-visibility.ts.
    const supermarkets = all.filter(s => hasEnoughContent(s._count))

    const response = NextResponse.json({ supermarkets })
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    return response
  } catch (error) {
    console.error('Error fetching supermarkets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch supermarkets' },
      { status: 500 }
    )
  }
}