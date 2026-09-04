import { revalidateTag } from 'next/cache'

/**
 * Cache invalidation for the write paths.
 *
 * The public read layer (lib/offer-queries.ts and the per-page `unstable_cache`
 * wrappers) holds offer data for up to 6 hours. Without this, the nightly
 * scrapers would land new prices in Postgres and shoppers would keep seeing the
 * previous flyer until the TTL happened to lapse — trading a cost problem for a
 * correctness one. Any cron or admin route that mutates offers, flyers, stores or
 * coupons must call the matching function here before returning.
 *
 * Tags must stay in sync with the `tags` arrays in lib/offer-queries.ts.
 */

/** Offers, flyers or retailer content changed — the nightly scrape path. */
export function invalidateOffers() {
  revalidateTag('offers')
  revalidateTag('retailers')
}

/** Coupon rows changed. */
export function invalidateCoupons() {
  revalidateTag('coupons')
}

/** Banner rows changed — the admin banners CRUD. */
export function invalidateBanners() {
  revalidateTag('banners')
}

/** Everything. Use after a bulk import or migration of unknown scope. */
export function invalidateAll() {
  invalidateOffers()
  invalidateCoupons()
  invalidateBanners()
}
