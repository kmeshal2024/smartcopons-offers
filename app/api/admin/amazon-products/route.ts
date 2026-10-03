import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { amazonProductSchema } from '@/lib/validators'
import { invalidateAmazon } from '@/lib/cache-invalidation'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const products = await prisma.amazonProduct.findMany({
      orderBy: [{ isActive: 'desc' }, { category: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    })
    return NextResponse.json({ products })
  } catch (error) {
    console.error('Amazon products fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch products (table migrated?)' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const validation = amazonProductSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      )
    }

    const product = await prisma.amazonProduct.create({ data: validation.data })
    invalidateAmazon()
    return NextResponse.json({ product }, { status: 201 })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'This ASIN is already in the list' }, { status: 409 })
    }
    console.error('Create Amazon product error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
