import { prisma } from '@/lib/db'
import { buildUrlSet, XML_HEADERS, SITE_URL, type SitemapEntry } from '@/lib/sitemap-xml'

export const dynamic = 'force-dynamic'

/** Static pages + retailer pages + category pages. */
export async function GET() {
  const now = new Date()

  const entries: SitemapEntry[] = [
    { loc: SITE_URL, lastmod: now, changefreq: 'daily', priority: 1 },
    { loc: `${SITE_URL}/offers`, lastmod: now, changefreq: 'daily', priority: 0.9 },
    { loc: `${SITE_URL}/coupons`, lastmod: now, changefreq: 'daily', priority: 0.9 },
    { loc: `${SITE_URL}/supermarkets`, lastmod: now, changefreq: 'weekly', priority: 0.8 },
    { loc: `${SITE_URL}/compare`, lastmod: now, changefreq: 'weekly', priority: 0.6 },
  ]

  try {
    const [supermarkets, categories] = await Promise.all([
      prisma.supermarket.findMany({
        where: { isActive: true },
        select: {
          slug: true,
          updatedAt: true,
          _count: { select: { productOffers: { where: { isHidden: false } } } },
        },
      }),
      prisma.category.findMany({
        where: { isActive: true },
        select: { slug: true },
      }),
    ])

    // Skip retailers with no offers — those pages are noindex'd, so submitting
    // them would just report "excluded by noindex" in Search Console.
    for (const sm of supermarkets) {
      if (sm._count.productOffers === 0) continue
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
