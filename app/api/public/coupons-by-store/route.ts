import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')
    const storeId = searchParams.get('storeId')

    if (!slug && !storeId) {
      return NextResponse.json({ coupons: [] })
    }

    const coupons = await prisma.coupon.findMany({
      where: {
        isActive: true,
        store: slug ? { slug } : undefined,
        storeId: storeId || undefined,
      },
      include: {
        store: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    return NextResponse.json({ coupons })
  } catch (error) {
    console.error('Error fetching coupons by store:', error)
    return NextResponse.json(
      { error: 'Failed to fetch coupons' },
      { status: 500 }
    )
  }
}
