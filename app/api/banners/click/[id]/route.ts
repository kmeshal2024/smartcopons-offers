import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Banner click-through: count and redirect in one event, so the click number
 * is exactly the number of shoppers who left through this banner.
 *
 * Crawlers follow plain <a> links regardless of rel, and in week one they
 * produced impossible numbers (7 clicks on 4 impressions on /coupons) — so
 * bot user-agents are redirected WITHOUT counting, and every response carries
 * X-Robots-Tag + a robots.txt disallow to keep the URLs out of crawl queues
 * altogether.
 *
 * Only redirects to the URL stored on an ACTIVE banner row (the DB CHECK
 * guarantees it is http-prefixed) — this is not an open redirect.
 */
export const dynamic = 'force-dynamic'

const BOT_UA =
  /bot|crawl|spider|slurp|bingpreview|yandex|baidu|duckduck|facebookexternalhit|whatsapp|telegram|skype|preview|curl|wget|python|axios|okhttp|headless|lighthouse|pingdom|uptime|monitor/i

const NOINDEX = { 'X-Robots-Tag': 'noindex, nofollow' }

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const ua = request.headers.get('user-agent') || ''
  const isBot = !ua || BOT_UA.test(ua)

  try {
    const banner = isBot
      ? await prisma.banner.findUnique({
          where: { id: params.id },
          select: { targetUrl: true, isActive: true },
        })
      : await prisma.banner.update({
          where: { id: params.id },
          data: { clicks: { increment: 1 } },
          select: { targetUrl: true, isActive: true },
        })
    if (banner?.isActive && banner.targetUrl.startsWith('http')) {
      return NextResponse.redirect(banner.targetUrl, { status: 302, headers: NOINDEX })
    }
  } catch {
    // Unknown id or table not migrated yet — fall through to the homepage.
  }
  return NextResponse.redirect(new URL('/', request.url), { status: 302, headers: NOINDEX })
}
