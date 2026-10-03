import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { amazonProductSchema } from '@/lib/validators'
import { invalidateAmazon } from '@/lib/cache-invalidation'

export const dynamic = 'force-dynamic'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const product = await prisma.amazonProduct.update({
      where: { id: params.id },
      data: validation.data,
    })
    invalidateAmazon()
    return NextResponse.json({ product })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Another row already has this ASIN' }, { status: 409 })
    }
    console.error('Update Amazon product error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin()
    await prisma.amazonProduct.delete({ where: { id: params.id } })
    invalidateAmazon()
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Delete Amazon product error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
