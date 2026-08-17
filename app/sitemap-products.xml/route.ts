import { buildUrlSet, XML_HEADERS, SITE_URL, type SitemapEntry } from '@/lib/sitemap-xml'
import { listSitemapProducts } from '@/lib/offer-queries'
import { DEFAULT_COUNTRY } from '@/lib/countries'

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
    // Cached (6h) — this is a ~24k-row scan and it ran uncached on every crawler
    // request. Capped at 45k to stay inside Google's 50k-URL sitemap limit.
    const products = await listSitemapProducts(DEFAULT_COUNTRY)

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
