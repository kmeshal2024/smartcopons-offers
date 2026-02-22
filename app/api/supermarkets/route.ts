import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const supermarkets = await prisma.supermarket.findMany({
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

    return NextResponse.json({ supermarkets })
  } catch (error) {
    console.error('Error fetching supermarkets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch supermarkets' },
      { status: 500 }
    )
  }
}