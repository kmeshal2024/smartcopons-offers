import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const store = await prisma.store.findUnique({
      where: { slug: params.slug },
    })

    if (!store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      )
    }

    const coupons = await prisma.coupon.findMany({
      where: {
        storeId: store.id,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ store, coupons })
  } catch (error) {
    console.error('Get store error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
