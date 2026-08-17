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
 * ONE JOB: decide what gets indexed. The rule is deliberately minimal —
 * enough live offers, OR a live flyer exists. Nothing more.
 *
 * It does NOT try to detect broken scrapers. An earlier version qualified the
 * flyer clause (a flyer only counted if it had offers or was a "real" brochure)
 * so that a store with a dead scraper would fall out of the sitemap and thereby
 * become noticeable. That conflated two jobs and made indexing depend on a proxy
 * for content value — flyer page count and the like. Detection now lives in
 * /api/health `staleRetailers`, which is the right place for it, so this gate can
 * stay simple and stable.
 *
 * The filter that DOES matter here is `country` on the supermarket.
 * sitemap-pages.xml scoped the offer *counts* to SA but not the store, so eleven
 * UAE retailers (lulu-ae, carrefour-ae, km-trading, aswaaq, almaya, adcoop, gala,
 * geant, union-coop, ansar-gallery, nesto-ae) were being submitted under
 * sa.smartcopons.com. That was the real index bloat, and it is unaffected by the
 * simplification above — the 60-odd empty duplicate ClicFlyer flyers all belong to
 * UAE stores, which this filter already excludes.
 *
 * Caveat worth keeping in mind, not enforced here: an image or PDF flyer carries
 * no text a crawler can read, so a flyer-only store (nesto: 36 pages, farm: 64)
 * is indexable but will not rank for its own brand query. Making those rank needs
 * indexable text — product names, a summary, or OCR — which is separate work.
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
        retailerType: true,
        _count: {
          select: {
            flyers: { where: { status: 'ACTIVE', endDate: { gte: new Date() } } },
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
      .map(({ _count, ...rest }) => ({ ...rest, activeFlyers: _count.flyers }))
      .filter(sm => sm.activeOffers >= MIN_VISIBLE_OFFERS || sm.activeFlyers > 0)
  },
  ['visible-retailers'],
  { revalidate: TTL_COUNTS, tags: ['offers', 'retailers'] }
)

/**
 * Content counts for one retailer, matching listVisibleRetailers exactly.
 *
 * Shared so a store's own page and the sitemap can never disagree about whether
 * it is thin — otherwise the sitemap could drop a store that its page still
 * declares indexable, or vice versa.
 */
export const retailerContentCounts = unstable_cache(
  async (supermarketId: string, country: string = DEFAULT_COUNTRY) => {
    const [productOffers, flyers] = await Promise.all([
      prisma.productOffer.count({
        where: { ...activeOfferWhere(country), supermarketId },
      }),
      prisma.flyer.count({
        where: { supermarketId, status: 'ACTIVE', endDate: { gte: new Date() } },
      }),
    ])
    return { productOffers, flyers }
  },
  ['retailer-content-counts'],
  { revalidate: TTL_COUNTS, tags: ['offers', 'retailers'] }
)

/**
 * Cap how many rows any one retailer contributes to a featured section, keeping
 * the original order otherwise.
 *
 * `أكبر الخصومات` is `orderBy: discountPercent desc, take: 4` with no cap, and
 * site-wide there are exactly 12 offers above 80% off — 9 of them Nahdi, a
 * pharmacy. So a supermarket-deals homepage led with nursing wraps, gummy
 * vitamins and anti-dandruff shampoo, and no food at all. Verified against
 * sourceUrl: the prices are real clearance, not a multipack extraction bug, so
 * this is a presentation fix and there is nothing to correct in the data.
 *
 * Over-fetch before calling this — capping a list of 4 can only shrink it.
 */
export function capPerRetailer<T extends { supermarket?: { slug: string } | null }>(
  rows: T[],
  maxPerRetailer: number,
  limit: number
): T[] {
  const seen = new Map<string, number>()
  const out: T[] = []
  for (const row of rows) {
    if (out.length >= limit) break
    const slug = row.supermarket?.slug ?? '∅'
    const n = seen.get(slug) ?? 0
    if (n >= maxPerRetailer) continue
    seen.set(slug, n + 1)
    out.push(row)
  }
  return out
}

/**
 * Category slugs that are actually groceries. Kept as a SECONDARY signal only.
 *
 * On its own this does not work, which is why groceryFirst() exists: the category
 * data is itself wrong. Nahdi's pharmacy stock is filed INTO food categories — a
 * nursing wrap as `canned-dry`, gummy vitamins as `snacks` — so a category filter
 * cannot see the very rows it needs to demote. Categories are re-derived as
 * products arrive nightly, so this rots continuously.
 */
const FOOD_CATEGORY_SLUGS = new Set([
  'dairy', 'meat-poultry', 'vegetables', 'fruits', 'bakery',
  'beverages', 'snacks', 'canned-dry',
])

const isFoodCategory = (slug?: string | null) => !!slug && FOOD_CATEGORY_SLUGS.has(slug)

/** Stable partition on category. Secondary signal — see groceryFirst(). */
export function foodFirst<T extends { category?: { slug?: string | null } | null }>(rows: T[]): T[] {
  const food: T[] = []
  const rest: T[] = []
  for (const r of rows) (isFoodCategory(r.category?.slug) ? food : rest).push(r)
  return [...food, ...rest]
}

type RankableRow = {
  supermarket?: { retailerType?: string | null } | null
  category?: { slug?: string | null } | null
}

/**
 * Rank rows for a featured section on a SUPERMARKET site: grocery retailers
 * first, then food-categorised rows within each tier, original order preserved
 * otherwise.
 *
 * Keyed on `supermarket.retailerType` because retailer identity is stable while
 * product categorisation is not. Without it the homepage's biggest-discount
 * section was four Nahdi rows (a nursing wrap, two gummy-vitamin packs, an
 * anti-dandruff shampoo) purely because a pharmacy runs the steepest percentage
 * discounts on the site — and eXtra would do the same with laptops.
 *
 * A demotion, not a filter: a genuinely good pharmacy deal can still surface once
 * grocery rows are exhausted.
 */
export function groceryFirst<T extends RankableRow>(rows: T[]): T[] {
  const tier = (r: T) => {
    const grocery = (r.supermarket?.retailerType ?? 'grocery') === 'grocery'
    if (grocery) return isFoodCategory(r.category?.slug) ? 0 : 1
    return isFoodCategory(r.category?.slug) ? 2 : 3
  }
  return rows
    .map((row, i) => ({ row, i, t: tier(row) }))
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map(x => x.row)
}

export interface StaleRetailer {
  slug: string
  /** Which detector fired. A retailer can trip both. */
  reasons: Array<'active-flyer-zero-offers' | 'scraper-wrote-zero-rows'>
  activeOffers: number
  activeFlyers: number
  lastScrapeAt: string | null
  lastScrapeFound: number | null
  lastScrapeCreated: number | null
  lastScrapeSkipped: number | null
  lastScrapeSucceeded: boolean | null
}

/**
 * Retailers whose data pipeline looks broken.
 *
 * THIS is where a dead scraper gets noticed — not the sitemap gate. Al Othaim had
 * been extracting zero offers behind an ACTIVE PDF flyer for an unknown period,
 * and nothing anywhere surfaced it: the flyer kept the page alive, the page kept
 * the store in the sitemap, and the scrape cron reported success.
 *
 * Two independent detectors:
 *
 *  1. `active-flyer-zero-offers` — a live flyer but no live offers. Either the
 *     extraction is broken, or the retailer is intentionally flyer-only. Both are
 *     worth seeing; the caller decides. nesto (36-page leaflet) and farm (64-page)
 *     are the known-intentional cases, so they are reported rather than filtered —
 *     hiding known cases is how the unknown ones stay hidden.
 *  2. `scraper-wrote-zero-rows` — the scrape ran (a ScrapeLog row exists in the
 *     window) and created nothing. Catches silent extraction failures that report
 *     `success: true`, which is exactly what Al Othaim was doing.
 *
 * Not cached: this is an operational read behind a diagnostics endpoint, and a
 * stale answer defeats the purpose.
 */
export async function findStaleRetailers(
  country: string = DEFAULT_COUNTRY,
  windowHours = 48
): Promise<StaleRetailer[]> {
  const since = new Date(Date.now() - windowHours * 3600_000)

  const stores = await prisma.supermarket.findMany({
    where: { isActive: true, country },
    select: {
      slug: true,
      _count: {
        select: {
          flyers: { where: { status: 'ACTIVE', endDate: { gte: new Date() } } },
        },
      },
    },
  })

  const out: StaleRetailer[] = []

  for (const s of stores) {
    const [activeOffers, log] = await Promise.all([
      prisma.productOffer.count({
        where: { ...activeOfferWhere(country), supermarket: { slug: s.slug } },
      }),
      prisma.scrapeLog.findFirst({
        where: { supermarketSlug: s.slug, scrapedAt: { gte: since } },
        orderBy: { scrapedAt: 'desc' },
        select: {
          scrapedAt: true,
          offersFound: true,
          offersCreated: true,
          offersSkipped: true,
          success: true,
        },
      }),
    ])

    const reasons: StaleRetailer['reasons'] = []
    if (s._count.flyers > 0 && activeOffers === 0) reasons.push('active-flyer-zero-offers')

    // "Ran but wrote zero rows" has to key off what LANDED, not what was found.
    // Al Othaim is the reason: its scraper finds plenty of catalog entries
    // (`offersFound` > 0) but emits every one with `price: 0`, and
    // offer-ingest.ts rejects those as non-products — so `offersCreated` is 0
    // every night while the run reports `success: true`. A rule keyed on
    // `offersFound === 0` would have missed exactly the case it was built for.
    //
    // `offersSkipped` is the guard against false positives: a healthy retailer
    // whose offers simply haven't changed writes 0 new rows but skips many as
    // duplicates. Created-nothing AND skipped-nothing means it genuinely
    // produced nothing.
    if (log && log.offersCreated === 0 && log.offersSkipped === 0) {
      reasons.push('scraper-wrote-zero-rows')
    }

    if (reasons.length) {
      out.push({
        slug: s.slug,
        reasons,
        activeOffers,
        activeFlyers: s._count.flyers,
        lastScrapeAt: log?.scrapedAt.toISOString() ?? null,
        lastScrapeFound: log?.offersFound ?? null,
        lastScrapeCreated: log?.offersCreated ?? null,
        lastScrapeSkipped: log?.offersSkipped ?? null,
        lastScrapeSucceeded: log?.success ?? null,
      })
    }
  }

  return out
}

/** Most recent successful scrape across all retailers, for /api/health. */
export async function getLastScrapeAt(): Promise<string | null> {
  const row = await prisma.scrapeLog.findFirst({
    where: { success: true },
    orderBy: { scrapedAt: 'desc' },
    select: { scrapedAt: true },
  })
  return row?.scrapedAt.toISOString() ?? null
}

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
