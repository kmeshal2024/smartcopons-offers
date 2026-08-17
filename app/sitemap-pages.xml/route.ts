import { prisma } from '@/lib/db'
import { buildUrlSet, XML_HEADERS, SITE_URL, type SitemapEntry } from '@/lib/sitemap-xml'
import { listVisibleRetailers } from '@/lib/offer-queries'
import { DEFAULT_COUNTRY } from '@/lib/countries'

export const dynamic = 'force-dynamic'

/** Static pages + retailer pages + category pages. */
export async function GET() {
  const now = new Date()

  const entries: SitemapEntry[] = [
    { loc: SITE_URL, lastmod: now, changefreq: 'daily', priority: 1 },
    { loc: `${SITE_URL}/offers`, lastmod: now, changefreq: 'daily', priority: 0.9 },
    { loc: `${SITE_URL}/supermarkets`, lastmod: now, changefreq: 'weekly', priority: 0.8 },
    { loc: `${SITE_URL}/compare`, lastmod: now, changefreq: 'weekly', priority: 0.6 },
    { loc: `${SITE_URL}/privacy`, lastmod: now, changefreq: 'yearly', priority: 0.3 },
  ]

  try {
    // listVisibleRetailers scopes to this market's stores and applies the same
    // content gate the retailer pages use, so the sitemap and the pages can never
    // disagree. It fixes two leaks that were live here:
    //
    //   1. The old query filtered `country` on the offer COUNTS but not on the
    //      supermarket, so eleven UAE stores (lulu-ae, carrefour-ae, km-trading,
    //      aswaaq, almaya, adcoop, gala, geant, union-coop, ansar-gallery,
    //      nesto-ae) were submitted under sa.smartcopons.com.
    //   2. The flyer sub-count accepted any ACTIVE flyer. The nightly ClicFlyer
    //      import leaves duplicate ACTIVE flyers holding zero offers — 60 of 79
    //      site-wide — so alothaim, nesto and farm were submitted with 0 live
    //      offers and rendered an empty grid.
    const [supermarkets, categories] = await Promise.all([
      listVisibleRetailers(DEFAULT_COUNTRY),
      prisma.category.findMany({
        where: { isActive: true },
        select: { slug: true },
      }),
    ])

    for (const sm of supermarkets) {
      entries.push({
        loc: `${SITE_URL}/offers/${sm.slug}`,
        lastmod: sm.updatedAt,
        changefreq: 'daily',
        priority: 0.8,
      })
    }

    for (const cat of categories) {
      entries.push({
        loc: `${SITE_URL}/offers/category/${cat.slug}`,
        changefreq: 'daily',
        priority: 0.7,
      })
    }
  } catch {
    // DB unavailable (e.g. during build) — still serve the static routes.
  }

  return new Response(buildUrlSet(entries), { headers: XML_HEADERS })
}
