import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
  try {
    await requireAdmin()

    const categories = await prisma.category.findMany({
      orderBy: [{ order: 'asc' }, { nameAr: 'asc' }],
      include: {
        _count: { select: { products: true } },
        children: {
          include: { _count: { select: { products: true } } },
          orderBy: { order: 'asc' },
        },
      },
    })

    return NextResponse.json({ categories })
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { nameAr, nameEn, slug, icon, parentId, order, isActive } = body

    if (!nameAr || !nameEn || !slug) {
      return NextResponse.json(
        { error: 'nameAr, nameEn, and slug are required' },
        { status: 400 }
      )
    }

    const category = await prisma.category.create({
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

    return NextResponse.json({ category }, { status: 201 })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 })
    }
    console.error('Create category error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
