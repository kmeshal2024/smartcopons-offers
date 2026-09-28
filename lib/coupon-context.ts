/**
 * Which coupon stores are relevant to which product aisle.
 *
 * The coupons earn the money and the product pages get the visitors — 71 of the
 * 95 search clicks in the three months to 25 Sep 2026 landed on /product/*, and
 * not one of those pages showed a code. This map is what lets a product page
 * offer ONE code that fits what the shopper is already looking at.
 *
 * RULES
 *   - Keys are product category slugs (the `categories` table). Values are
 *     coupon STORE slugs (the `stores` table, mostly Arabic), in no particular
 *     order: the pick rotates daily so every store listed gets exposure.
 *   - A store belongs here only if it actually SELLS that aisle. An electronics
 *     code under a carton of milk is an advert; a grocery-delivery code is help.
 *   - A slug with no live code is simply skipped, so listing a store before its
 *     code arrives is harmless, and an expired code drops out by itself.
 *   - No entry, no coupon. There is deliberately no site-wide fallback here:
 *     relevance is the whole point of the surface.
 *
 * To place a new store: add its slug to the aisles it sells. No deploy-time data
 * change is needed beyond this file.
 */

/** Grocery delivery and meal kits — relevant to every food aisle. */
const GROCERY = ['noon-minutes', 'noon-nownow', 'هيلو-شيف']

export const CATEGORY_COUPON_STORES: Record<string, string[]> = {
  dairy: GROCERY,
  'meat-poultry': GROCERY,
  vegetables: GROCERY,
  fruits: GROCERY,
  bakery: GROCERY,
  beverages: GROCERY,
  snacks: GROCERY,
  'canned-dry': GROCERY,
  frozen: GROCERY,

  'personal-care': [
    'اي-هيرب', 'نون', 'نايس-ون', 'صيدليات-النهدي', 'ذا-بودي-شوب', 'باث-اند-بودي-وركس', 'سيفورا',
    'بشرة-كير', 'لوكسيتان', 'الطبي',
  ],
  'baby-care': ['نون', 'مذركير', 'ماماز-اند-باباز', 'فيرست-كراي', 'بات-بات', 'ممزورلد'],
  household: ['نون', 'قصر-الأواني', 'هومز-مارت', 'بليندز-هوم', 'ويست-إلم', 'سنبل', 'ايس'],
  electronics: [
    // Kinguin sells game keys and console credit, so it belongs beside the
    // consoles and gaming gear this aisle holds at eXtra, Jarir and LuLu.
    'نون', 'kinguin', 'هواوي', 'huawei', 'lg', 'كارتلو', 'govee', 'دايسون', 'علي-اكسبريس', 'ايوا',
  ],
}

export function couponStoresForCategory(categorySlug?: string | null): string[] {
  return (categorySlug && CATEGORY_COUPON_STORES[categorySlug]) || []
}
