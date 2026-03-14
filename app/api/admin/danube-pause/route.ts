import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// One-time endpoint to deactivate Danube (no real deals data)
// Auth via APP_SECRET query param
export async function POST(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key')
  const secret = process.env.APP_SECRET
  if (!secret || key !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Deactivate Danube supermarket
  const result = await prisma.supermarket.updateMany({
    where: { slug: 'danube' },
    data: { isActive: false },
  })

  // Also hide any Danube product offers so they don't appear in "Best Deals"
  const danube = await prisma.supermarket.findUnique({ where: { slug: 'danube' } })
  let hiddenOffers = 0
  if (danube) {
    const hidden = await prisma.productOffer.updateMany({
      where: { supermarketId: danube.id },
      data: { isHidden: true },
    })
    hiddenOffers = hidden.count
  }

  return NextResponse.json({
    success: true,
    supermarketsDeactivated: result.count,
    offersHidden: hiddenOffers,
  })
}
