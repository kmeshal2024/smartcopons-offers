import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { couponSchema } from '@/lib/validators'

export async function GET() {
  try {
    await requireAdmin()
  } catch (error: any) {
    console.error('Coupons auth error:', error?.message)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const coupons = await prisma.coupon.findMany({
      include: {
        store: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ coupons })
  } catch (error) {
    console.error('Coupons fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch coupons' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const validation = couponSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      )
    }

    const coupon = await prisma.coupon.create({
      data: validation.data,
    })

    return NextResponse.json({ coupon }, { status: 201 })
  } catch (error) {
    console.error('Create coupon error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
