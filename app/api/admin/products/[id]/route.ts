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
    const {
      categoryId, nameAr, nameEn, brand,
      price, oldPrice, discountPercent, sizeText,
      imageUrl, tags, isHidden,
    } = body

    const product = await prisma.productOffer.update({
      where: { id },
      data: {
        categoryId: categoryId || null,
        nameAr: nameAr || null,
        nameEn: nameEn || null,
        brand: brand || null,
        price: parseFloat(price),
        oldPrice: oldPrice ? parseFloat(oldPrice) : null,
        discountPercent: discountPercent ? parseInt(discountPercent) : null,
        sizeText: sizeText || null,
        imageUrl: imageUrl || null,
        tags: tags || null,
        isHidden: isHidden || false,
      },
    })

    return NextResponse.json({ product })
  } catch (error) {
    console.error('Update product error:', error)
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

    await prisma.productOffer.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized or not found' }, { status: 401 })
  }
}
