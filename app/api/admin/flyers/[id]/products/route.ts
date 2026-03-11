import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { CategoryMapper } from '@/lib/services/category-mapper'

interface ProductRow {
  nameAr: string
  price: number
  oldPrice?: number
  imageUrl?: string
  brand?: string
  sizeText?: string
}

// POST: Bulk add products to a flyer
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id: flyerId } = await params
    const body = await request.json()
    const { products } = body as { products: ProductRow[] }

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'No products provided' }, { status: 400 })
    }

    if (products.length > 200) {
      return NextResponse.json({ error: 'Max 200 products per batch' }, { status: 400 })
    }

    // Verify flyer exists
    const flyer = await prisma.flyer.findUnique({
      where: { id: flyerId },
      include: { supermarket: true },
    })

    if (!flyer) {
      return NextResponse.json({ error: 'Flyer not found' }, { status: 404 })
    }

    // Initialize category mapper
    const categoryMapper = new CategoryMapper()
    await categoryMapper.initialize()

    let created = 0
    const errors: { index: number; message: string }[] = []

    for (let i = 0; i < products.length; i++) {
      const p = products[i]

      if (!p.nameAr || !p.price) {
        errors.push({ index: i, message: `Row ${i + 1}: name and price are required` })
        continue
      }

      try {
        // Auto-categorize based on product name
        const categoryId = await categoryMapper.mapToCategory(p.nameAr)

        // Calculate discount
        let discountPercent: number | null = null
        if (p.oldPrice && p.oldPrice > p.price) {
          discountPercent = Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100)
        }

        await prisma.productOffer.create({
          data: {
            flyerId,
            supermarketId: flyer.supermarketId,
            categoryId,
            nameAr: p.nameAr.trim(),
            nameEn: null,
            brand: p.brand?.trim() || null,
            price: parseFloat(String(p.price)),
            oldPrice: p.oldPrice ? parseFloat(String(p.oldPrice)) : null,
            discountPercent,
            sizeText: p.sizeText?.trim() || null,
            imageUrl: p.imageUrl?.trim() || null,
            pageNumber: 1,
            sourceUrl: `flyer:${flyerId}`,
            isHidden: false,
          },
        })
        created++
      } catch (err: any) {
        errors.push({ index: i, message: `Row ${i + 1}: ${err.message}` })
      }
    }

    return NextResponse.json({
      created,
      errors,
      flyerId,
      supermarket: flyer.supermarket.name,
    })
  } catch (err: any) {
    console.error('Bulk product import error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
