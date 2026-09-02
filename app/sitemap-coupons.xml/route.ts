import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'
import { buildUrlSet, XML_HEADERS, SITE_URL } from '@/lib/sitemap-xml'
import { TTL_SITEMAP } from '@/lib/offer-queries'

/**
 * Coupon STORE pages only — one URL per store that has at least one active
 * code. Deliberately no per-code URLs: the retired per-coupon generation is
 * exactly the thin-page mistake this sitemap must not repeat, and a store
 * whose codes all lapse falls out of here on the next revalidation (its page
 * also goes noindex).
 */
export const dynamic = 'force-dynamic'

const listCouponStoreEntries = unstable_cache(
  async () => {
    const stores = await prisma.store.findMany({
      where: { coupons: { some: { isActive: true, OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }] } } },
      select: {
        slug: true,
        coupons: {
          where: { isActive: true },
          select: { updatedAt: true },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    })
    return stores.map(s => ({
      slug: s.slug,
      lastmod: s.coupons[0]?.updatedAt?.toISOString() ?? new Date().toISOString(),
    }))
  },
  ['sitemap-coupon-stores'],
  { revalidate: TTL_SITEMAP, tags: ['coupons'] }
)

export async function GET() {
  const entries = await listCouponStoreEntries()
  const xml = buildUrlSet(
    entries.map(e => ({
      loc: `${SITE_URL}/coupons/${encodeURIComponent(e.slug)}`,
      lastmod: e.lastmod,
      changefreq: 'weekly' as const,
      priority: 0.8,
    }))
  )
  return new Response(xml, { headers: XML_HEADERS })
}
