import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Cron endpoint: Auto-expire flyers past their end date.
 *
 * Hostinger cron setup:
 *   Schedule: 0 0 * * * (daily at midnight)
 *   Command:  curl -s https://sa.smartcopons.com/api/cron/expire-flyers?key=YOUR_CRON_SECRET
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')

  const cronSecret = process.env.APP_SECRET
  if (!cronSecret || key !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()

    // Expire active flyers past their end date
    const result = await prisma.flyer.updateMany({
      where: {
        status: 'ACTIVE',
        endDate: { lt: now },
      },
      data: { status: 'EXPIRED' },
    })

    return NextResponse.json({
      success: true,
      expiredCount: result.count,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error('Cron expire-flyers error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
