import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'
import { DEFAULT_COUNTRY } from '@/lib/countries'
import { MIN_VISIBLE_OFFERS } from '@/lib/retailer-visibility'

/**
 * Cached read layer for public pages.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every public page reads the UI-language cookie (lib/i18n-server.ts) from the
 * root layout, which opts the whole app out of Next's static render. The
 * `revalidate` exports on the retailer/category/product/coupon pages were
 * therefore inert — `next build` reported all 55 routes as `ƒ Dynamic`, and
 * responses went out with `Cache-Control: no-store`. Result: one Postgres round
 * trip per page view, for humans and crawlers alike, which is what exhausted the
 * Neon compute allowance. Neon suspends after 5 minutes idle and the sitemap
 * advertises ~24k product URLs, so it never got the chance.
 *
 * Rather than restructure the app under /[lang] to win back static rendering,
 * the DB is taken out of the hot path: the queries are cached, the pages stay
 * dynamic. The scarce resource is Neon compute, not Vercel invocations. This
 * also keeps the AR/EN cookie toggle working exactly as before — cached rows are
 * language-agnostic, only the surrounding UI strings differ.
 *
 * RULES FOR ANYTHING ADDED HERE
 * -----------------------------
 * - Never read cookies()/headers() inside a cached callback; it throws.
 * - `new Date()` is frozen into the cache entry, so a `gte: now` bound can lag
 *   by up to the TTL. Offers expire on day boundaries, so an hour is harmless.
 * - Return plain data. Prisma Decimal/Date survive, but keep payloads lean —
 *   entries are serialised into the Data Cache.
 */

/** Listing pages: fresh enough that a new flyer shows up the same hour. */
export const TTL_LISTING = 3600
/** Sitemaps: crawler-facing, changes at most daily. */
export const TTL_SITEMAP = 21600
/** Counts on the homepage/store directory. */
export const TTL_COUNTS = 3600
/**
 * Product pages, deliberately longer than the listings.
 *
 * There are ~24k of them and they are the crawler's main target, so the cost that
 * matters is a full sweep of unique URLs — which a per-id cache deduplicates but
 * cannot eliminate. Prices only move when a flyer rolls over (weekly), so a
 * 6-hour window cuts the cost of a repeated crawl six-fold at no freshness cost
 * a shopper would notice.
 */
export const TTL_PRODUCT = 21600

/**
 * THE definition of a live offer. Previously spelled out inline in six places
 * with two different filter sets, which is why the homepage retailer cards
 * disagreed with the retailer pages by up to 14,590 offers (Tamimi: 24,100 vs
 * 9,510). The cards omitted `price > 0` and the flyer end-date bound, so they
 * counted expired stock and scraper placeholder rows.
 *
 * `flyerId` is non-nullable on ProductOffer, so the relation filter only ever
 * drops rows whose flyer has ended — it never drops flyer-less rows.
 */
export function activeOfferWhere(country: string = DEFAULT_COUNTRY) {
  return {
    isHidden: false,
    country,
    price: { gt: 0 },
    flyer: { endDate: { gte: new Date() } },
  } as const
}

/** Live-offer count for one retailer. Shared by cards, headers and the sitemap. */
export const countActiveOffers = unstable_cache(
  async (supermarketId: string, country: string = DEFAULT_COUNTRY) =>
    prisma.productOffer.count({
      where: { ...activeOfferWhere(country), supermarketId },
    }),
  ['active-offer-count'],
  { revalidate: TTL_COUNTS, tags: ['offers'] }
)

/** Site-wide live-offer count — the number in the homepage stats bar. */
export const countAllActiveOffers = unstable_cache(
  async (country: string = DEFAULT_COUNTRY) =>
    prisma.productOffer.count({ where: activeOfferWhere(country) }),
  ['active-offer-count-all'],
  { revalidate: TTL_COUNTS, tags: ['offers'] }
)

/**
 * Retailers eligible to be listed or submitted to a sitemap, for one market.
 *
 * Two filters that were missing and caused real index bloat:
 *
 * 1. `country` on the supermarket. sitemap-pages.xml scoped the offer *counts*
 *    to SA but not the store, so eleven UAE retailers (lulu-ae, carrefour-ae,
 *    km-trading, aswaaq, …) were being submitted under sa.smartcopons.com.
 *
 * 2. The flyer sub-count required only `status: ACTIVE`, and the nightly
 *    ClicFlyer import leaves behind duplicate ACTIVE flyers carrying zero
 *    offers — 60 of 79 flyers site-wide. Any store with one passed the
 *    "has enough content" gate on `flyers > 0` while rendering an empty product
 *    grid; alothaim, nesto and farm all reached the sitemap that way with 0 live
 *    offers. A flyer now only counts as content if it actually has offers, or is
 *    a real browsable brochure (a PDF or page images).
 */
export const listVisibleRetailers = unstable_cache(
  async (country: string = DEFAULT_COUNTRY) => {
    const all = await prisma.supermarket.findMany({
      where: { isActive: true, country },
      select: {
        id: true,
        name: true,
        nameAr: true,
        slug: true,
        logo: true,
        updatedAt: true,
        flyers: {
          where: { status: 'ACTIVE', endDate: { gte: new Date() } },
          select: {
            pdfUrl: true,
            pageImages: true,
            _count: { select: { productOffers: true } },
          },
        },
      },
      orderBy: { viewCount: 'desc' },
    })

    const withCounts = await Promise.all(
      all.map(async sm => ({
        ...sm,
        activeOffers: await prisma.productOffer.count({
          where: { ...activeOfferWhere(country), supermarketId: sm.id },
        }),
      }))
    )

    return withCounts
      .map(sm => {
        const realFlyers = sm.flyers.filter(
          f => f._count.productOffers > 0 || f.pdfUrl || (f.pageImages || '').trim()
        ).length
        const { flyers, ...rest } = sm
        return { ...rest, realFlyers }
      })
      .filter(sm => sm.activeOffers >= MIN_VISIBLE_OFFERS || sm.realFlyers > 0)
  },
  ['visible-retailers'],
  { revalidate: TTL_COUNTS, tags: ['offers', 'retailers'] }
)

/**
 * Content counts for one retailer, using the same definition of "real content"
 * as listVisibleRetailers.
 *
 * Shared so a store's own page and the sitemap can never disagree about whether
 * it is thin — otherwise the sitemap could drop a store that its page still
 * declares indexable, or vice versa.
 */
export const retailerContentCounts = unstable_cache(
  async (supermarketId: string, country: string = DEFAULT_COUNTRY) => {
    const [productOffers, flyerRows] = await Promise.all([
      prisma.productOffer.count({
        where: { ...activeOfferWhere(country), supermarketId },
      }),
      prisma.flyer.findMany({
        where: { supermarketId, status: 'ACTIVE', endDate: { gte: new Date() } },
        select: {
          pdfUrl: true,
          pageImages: true,
          _count: { select: { productOffers: true } },
        },
      }),
    ])
    const flyers = flyerRows.filter(
      f => f._count.productOffers > 0 || f.pdfUrl || (f.pageImages || '').trim()
    ).length
    return { productOffers, flyers }
  },
  ['retailer-content-counts'],
  { revalidate: TTL_COUNTS, tags: ['offers', 'retailers'] }
)

/** Product ids + lastmod for sitemap-products.xml. Was an uncached 45k-row scan. */
export const listSitemapProducts = unstable_cache(
  async (country: string = DEFAULT_COUNTRY) =>
    prisma.productOffer.findMany({
      where: activeOfferWhere(country),
      select: { id: true, nameAr: true, nameEn: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 45000,
    }),
  ['sitemap-products'],
  { revalidate: TTL_SITEMAP, tags: ['offers'] }
)
