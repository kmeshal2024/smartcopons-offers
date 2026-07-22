import { prisma } from '@/lib/db'
import { buildUrlSet, XML_HEADERS, SITE_URL, type SitemapEntry } from '@/lib/sitemap-xml'

export const dynamic = 'force-dynamic'

/**
 * Individual product pages.
 *
 * Only currently-valid offers are submitted — an expired product page is
 * noindex'd, so listing it would just report "excluded by noindex".
 * Junk rows are filtered too: the flyer scrapers emit placeholder entries with
 * price 0 and generic names like "العروض", which must never be indexed.
 */
export async function GET() {
  const entries: SitemapEntry[] = []

  try {
    const products = await prisma.productOffer.findMany({
      where: {
        isHidden: false,
        price: { gt: 0 },
        flyer: { endDate: { gte: new Date() } },
      },
      select: { id: true, nameAr: true, nameEn: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      // Google caps a sitemap at 50k URLs; stay well inside it.
      take: 45000,
    })

    for (const p of products) {
      const name = (p.nameAr || p.nameEn || '').trim()
      // Skip placeholder/generic rows that would be thin pages.
      if (name.length < 8) continue
      entries.push({
        loc: `${SITE_URL}/product/${p.id}`,
        lastmod: p.updatedAt,
        changefreq: 'weekly',
        priority: 0.5,
      })
    }
  } catch {
    // DB unavailable — serve an empty but valid sitemap.
  }

  return new Response(buildUrlSet(entries), { headers: XML_HEADERS })
}
