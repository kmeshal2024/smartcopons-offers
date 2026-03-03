import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { cleanupExpiredAssets, getUploadsDiskUsage } from '@/lib/services/image-storage'

// GET: Show disk usage stats
export async function GET() {
  try {
    await requireAdmin()

    const usage = await getUploadsDiskUsage()
    const expiredCount = await prisma.flyer.count({
      where: {
        status: 'EXPIRED',
        endDate: { lt: new Date() },
      },
    })

    return NextResponse.json({ usage, expiredFlyersCount: expiredCount })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// POST: Run cleanup of expired flyer assets
export async function POST() {
  try {
    await requireAdmin()

    // Find expired flyers older than 7 days past end date
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 7)

    const expiredFlyers = await prisma.flyer.findMany({
      where: {
        status: 'EXPIRED',
        endDate: { lt: cutoff },
      },
      select: { id: true },
    })

    if (expiredFlyers.length === 0) {
      return NextResponse.json({ message: 'No expired assets to clean up', cleaned: { pdfs: 0, images: 0 } })
    }

    const flyerIds = expiredFlyers.map(f => f.id)
    const cleaned = await cleanupExpiredAssets(flyerIds)

    return NextResponse.json({
      message: `Cleaned ${cleaned.pdfs} PDFs and ${cleaned.images} images from ${flyerIds.length} expired flyers`,
      cleaned,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 })
  }
}
