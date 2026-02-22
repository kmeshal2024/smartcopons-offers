import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function GET() {
  try {
    await requireAdmin()

    const supermarkets = await prisma.supermarket.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            flyers: true,
            productOffers: true,
          },
        },
      },
    })

    return NextResponse.json({ supermarkets })
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { name, nameAr, slug, logo, website, isActive } = body

    if (!name || !nameAr || !slug) {
      return NextResponse.json({ error: 'Name, nameAr, and slug are required' }, { status: 400 })
    }

    const supermarket = await prisma.supermarket.create({
      data: {
        name,
        nameAr,
        slug,
        logo: logo || null,
        website: website || null,
        isActive: isActive !== false,
      },
    })

    return NextResponse.json({ supermarket }, { status: 201 })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 })
    }
    console.error('Create supermarket error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
