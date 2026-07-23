import { prisma } from '@/lib/db'
import { buildUrlSet, XML_HEADERS, SITE_URL, type SitemapEntry } from '@/lib/sitemap-xml'
import { COUPON_CATEGORIES } from '@/lib/coupon-categories'

export const dynamic = 'force-dynamic'

/** Coupon category pages + individual coupons + stores with active coupons. */
export async function GET() {
  const entries: SitemapEntry[] = []

  // Category pages first — the highest-value coupon URLs for broad queries.
  for (const cat of COUPON_CATEGORIES) {
    entries.push({
      loc: `${SITE_URL}/coupons/category/${cat.slug}`,
      changefreq: 'daily',
      priority: 0.7,
    })
  }

  try {
    const [coupons, stores] = await Promise.all([
      prisma.coupon.findMany({
        where: { isActive: true },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.store.findMany({
        where: { coupons: { some: { isActive: true } } },
        select: { slug: true },
      }),
    ])

    for (const c of coupons) {
      entries.push({
        loc: `${SITE_URL}/coupon/${c.id}`,
        lastmod: c.updatedAt,
        changefreq: 'weekly',
        priority: 0.6,
      })
    }

    for (const s of stores) {
      entries.push({
        loc: `${SITE_URL}/store/${s.slug}`,
        changefreq: 'weekly',
        priority: 0.5,
      })
    }
  } catch {
    // DB unavailable — return an empty (but valid) sitemap.
  }

  return new Response(buildUrlSet(entries), { headers: XML_HEADERS })
}
