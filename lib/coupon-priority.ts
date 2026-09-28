/**
 * The coupon stores that earn, as reported by the owner on 2026-09-28 from the
 * affiliate dashboards (which this codebase cannot see):
 *
 *   highest commission per sale:  Magrabi, Metro Brazil, Level Shoes
 *   highest number of sales:      iHerb, Noon, Namshi, Kinguin
 *
 * About 95% of commission is attributed by the CODE entered at checkout.
 * Kinguin is the exception — it is attributed by its tracking LINK, so its
 * button must always open the link stored on the coupon.
 *
 * Everything that ranks or features coupons reads this list, so changing who is
 * promoted is a one-file edit. Order matters: earlier is more prominent. Slugs
 * are coupon STORE slugs (`stores.slug`). Noon appears under two slugs because
 * the table holds it twice.
 */
export const FEATURED_COUPON_STORES: string[] = [
  'مغربي-للنظارات',
  'مترو-برازيل',
  'ليفل-شوز',
  'اي-هيرب',
  'نون',
  'نمشي',
  'kinguin',
  'noon',
]

const RANK = new Map(FEATURED_COUPON_STORES.map((slug, i) => [slug, i]))

export function isFeaturedStore(slug?: string | null): boolean {
  return !!slug && RANK.has(slug)
}

/** Sort key: featured stores first in list order, everything else after. */
export function featuredRank(slug?: string | null): number {
  const r = slug ? RANK.get(slug) : undefined
  return r === undefined ? FEATURED_COUPON_STORES.length : r
}

/**
 * How many slots a store gets in a daily rotation. A featured store is three
 * times as likely to be the one shown, without ever shutting the others out.
 */
export function rotationWeight(slug?: string | null): number {
  return isFeaturedStore(slug) ? 3 : 1
}
