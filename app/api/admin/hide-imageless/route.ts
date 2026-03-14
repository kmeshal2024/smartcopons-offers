import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// One-time cleanup: hide all product offers without images (seed data)
export async function POST(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key')
  const secret = process.env.APP_SECRET
  if (!secret || key !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Count before hiding
  const beforeCount = await prisma.productOffer.count({
    where: { isHidden: false, imageUrl: null },
  })

  // Hide all offers without images
  const result = await prisma.productOffer.updateMany({
    where: {
      isHidden: false,
      OR: [
        { imageUrl: null },
        { imageUrl: '' },
      ],
    },
    data: { isHidden: true },
  })

  // Count remaining visible offers
  const visibleAfter = await prisma.productOffer.count({
    where: { isHidden: false },
  })

  return NextResponse.json({
    success: true,
    imagelessHidden: result.count,
    visibleOffersRemaining: visibleAfter,
  })
}
