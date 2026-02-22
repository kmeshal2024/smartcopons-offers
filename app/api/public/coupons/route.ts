import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const coupons = await prisma.coupon.findMany({
      where: {
        isActive: true,
      },
      include: {
        store: {
          select: {
            name: true,
            slug: true,
            website: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ coupons })
  } catch (error) {
    console.error('Get coupons error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
