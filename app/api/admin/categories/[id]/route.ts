import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params

    const body = await request.json()
    const { nameAr, nameEn, slug, icon, parentId, order, isActive } = body

    const category = await prisma.category.update({
      where: { id },
      data: {
        nameAr,
        nameEn,
        slug,
        icon: icon || null,
        parentId: parentId || null,
        order: order || 0,
        isActive: isActive !== false,
      },
    })

    return NextResponse.json({ category })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Unauthorized or not found' }, { status: 401 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params

    await prisma.category.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized or not found' }, { status: 401 })
  }
}
