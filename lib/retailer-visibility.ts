/**
 * Public visibility rule for retailers.
 *
 * A retailer with 0–5 offers renders an effectively empty page: bad for users
 * who click through expecting deals, and thin content that drags on site-wide
 * SEO quality. Rather than deactivating stores by hand (which then have to be
 * remembered and re-enabled), listings filter on live content.
 *
 * A store is shown when EITHER:
 *   - it has at least MIN_VISIBLE_OFFERS active offers, or
 *   - it has a currently-valid flyer (a brochure is real content on its own,
 *     so a manually uploaded PDF brings the store back immediately).
 *
 * The rule is self-healing: a store reappears the moment its scraper succeeds
 * or a flyer is uploaded — no manual toggle needed.
 */
export const MIN_VISIBLE_OFFERS = 20

export interface RetailerContentCounts {
  productOffers?: number
  flyers?: number
}

export function hasEnoughContent(counts: RetailerContentCounts | undefined): boolean {
  if (!counts) return false
  const offers = counts.productOffers ?? 0
  const flyers = counts.flyers ?? 0
  return offers >= MIN_VISIBLE_OFFERS || flyers > 0
}

/**
 * Prisma `where` fragment selecting only retailers that meet the rule.
 * Used where filtering in SQL is preferable to filtering in JS.
 */
export const visibleRetailerWhere = {
  isActive: true,
  OR: [
    { productOffers: { some: { isHidden: false } } },
    { flyers: { some: { status: 'ACTIVE' as const, endDate: { gte: new Date() } } } },
  ],
}
