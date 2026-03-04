import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const logs = await prisma.scrapeLog.findMany({
      orderBy: { scrapedAt: 'desc' },
      take: 50,
    })
    return NextResponse.json({ logs })
  } catch (error) {
    console.error('Scrape logs fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }
}
