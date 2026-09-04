import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Banner click-through: count and redirect in one event, so the click number
 * is exactly the number of shoppers who left through this banner.
 *
 * Only redirects to the URL stored on an ACTIVE banner row (the DB CHECK
 * guarantees it is http-prefixed) — this is not an open redirect.
 */
export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const banner = await prisma.banner.update({
      where: { id: params.id },
      data: { clicks: { increment: 1 } },
      select: { targetUrl: true, isActive: true },
    })
    if (banner.isActive && banner.targetUrl.startsWith('http')) {
      return NextResponse.redirect(banner.targetUrl, 302)
    }
  } catch {
    // Unknown id or table not migrated yet — fall through to the homepage.
  }
  return NextResponse.redirect(new URL('/', _request.url), 302)
}
