import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Counts one outbound click to Amazon. Called by AmazonBuyButton via sendBeacon.
 *
 * The link itself goes straight to amazon.sa (no redirect through this site),
 * so Amazon sees a plain tagged link and the shopper sees where they are going.
 * This route only counts. Always 204, like /api/coupons/copy: nothing reads the
 * response, and the tab is already leaving.
 */
export const dynamic = 'force-dynamic'

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor/i

const done = () => new NextResponse(null, { status: 204 })

export async function POST(request: Request) {
  try {
    if (BOT.test(request.headers.get('user-agent') || '')) return done()
    // sendBeacon posts a Blob; parse the text ourselves so any content type works.
    const body: any = JSON.parse((await request.text()) || 'null')
    const id = typeof body?.id === 'string' ? body.id.slice(0, 40) : ''
    if (!id) return done()
    await prisma.amazonProduct.update({
      where: { id },
      data: { clicks: { increment: 1 } },
      select: { id: true },
    })
  } catch {
    // Unknown id, bad body, table missing, or DB asleep — not the shopper's problem.
  }
  return done()
}
