import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Impression beacon target. sendBeacon posts text/plain, so parse the body as
 * text and JSON.parse it ourselves. Batched by design ({ ids: [...] }) even
 * though today's client sends one id per slot — the cap keeps a hostile
 * payload from turning into a big write.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = JSON.parse(await request.text())
    const ids: string[] = Array.isArray(body?.ids)
      ? body.ids.filter((x: unknown) => typeof x === 'string').slice(0, 10)
      : []
    if (ids.length) {
      await prisma.banner.updateMany({
        where: { id: { in: ids } },
        data: { impressions: { increment: 1 } },
      })
    }
  } catch {
    // A malformed beacon is not worth a 500 in anyone's console.
  }
  return new NextResponse(null, { status: 204 })
}
