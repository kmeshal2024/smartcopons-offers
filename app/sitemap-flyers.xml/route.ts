import { prisma } from '@/lib/db'
import { buildUrlSet, XML_HEADERS, SITE_URL, type SitemapEntry } from '@/lib/sitemap-xml'

export const dynamic = 'force-dynamic'

/**
 * Weekly flyer permalinks: /flyers/{retailer}/{YYYY-MM-DD}.
 * A new URL appears every week, which is a genuine freshness signal.
 * Expired flyers are noindex'd on the page itself, so only currently-valid
 * ones are submitted here.
 */
export async function GET() {
  const entries: SitemapEntry[] = []

  try {
    const flyers = await prisma.flyer.findMany({
      where: { endDate: { gte: new Date() } },
      select: {
        startDate: true,
        updatedAt: true,
        supermarket: { select: { slug: true } },
      },
      orderBy: { startDate: 'desc' },
      take: 500,
    })

    for (const f of flyers) {
      const date = new Date(f.startDate).toISOString().split('T')[0]
      entries.push({
        loc: `${SITE_URL}/flyers/${f.supermarket.slug}/${date}`,
        lastmod: f.updatedAt,
        changefreq: 'daily',
        priority: 0.7,
      })
    }
  } catch {
    // DB unavailable — return an empty (but valid) sitemap.
  }

  return new Response(buildUrlSet(entries), { headers: XML_HEADERS })
}
