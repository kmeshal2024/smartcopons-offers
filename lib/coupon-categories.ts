/**
 * Coupon categories.
 *
 * Coupons belong to a Store, and a Store has no category column — the codes are
 * for online retailers (Noon, Namshi, AliExpress…) unrelated to the supermarket
 * catalogue. Rather than migrate the schema, we map store slug → category here.
 * It is reversible, reviewable in one file, and a store that isn't listed simply
 * falls into "general shopping" instead of being orphaned.
 *
 * The point is SEO: "كوبونات أزياء" / "كوبونات العاب" / "كوبونات مكياج" are real,
 * high-intent Arabic searches that a flat /coupons list can't rank for. Each
 * category becomes its own indexable page.
 *
 * When a new store gets coupons, add its slug to the right category below;
 * until then it shows up under "تسوق عام".
 */

export interface CouponCategory {
  slug: string
  label: string // page H1, e.g. "أزياء وموضة"
  keyword: string // the phrase people search, e.g. "كوبونات أزياء"
  icon: string
  description: string
  stores: string[]
}

// Order matters: it's the display order on /coupons and the first match wins.
export const COUPON_CATEGORIES: CouponCategory[] = [
  {
    slug: 'fashion',
    label: 'أزياء وموضة',
    keyword: 'كوبونات أزياء',
    icon: '👗',
    description: 'كوبونات وأكواد خصم متاجر الأزياء والأحذية والإكسسوارات والنظارات في السعودية.',
    stores: [
      '6th-street', 'american-eagle', 'clarks', 'defacto', 'diesel', 'foot-locker',
      'g-star-raw', 'gap', 'h-m', 'hummel', 'namshi', 'ounass', 'sivvi', 'squatwolf',
      'styli', 'sun-sand-sports', 'reebok', 'under-armour', 'vogacloset', 'wayrates',
      'toyo', 'white', 'new', 'centrepoint', 'bloomingdale-s', 'jashanmal', 'nayomi',
      'victoria-s-secret', 'victorias', 'swarovski', 'eyewa', 'fashion-eyewear', 'magrabi',
    ],
  },
  {
    slug: 'beauty',
    label: 'الجمال والعطور',
    keyword: 'كوبونات العناية والتجميل',
    icon: '💄',
    description: 'كوبونات وأكواد خصم متاجر مستحضرات التجميل والعناية بالبشرة والعطور في السعودية.',
    stores: ['basharacare', 'the-body-shop', 'nice-one', 'sonbol', 'al-dakheel-oud'],
  },
  {
    slug: 'baby',
    label: 'الأطفال والأمومة',
    keyword: 'كوبونات مستلزمات الأطفال',
    icon: '🍼',
    description: 'كوبونات وأكواد خصم متاجر مستلزمات الأطفال والأمومة والألعاب في السعودية.',
    stores: ['mamas-papas', 'mothercare', 'mumzworld', 'patpat', 'dabdoob'],
  },
  {
    slug: 'home',
    label: 'المنزل والأثاث',
    keyword: 'كوبونات المنزل والأثاث',
    icon: '🏠',
    description: 'كوبونات وأكواد خصم متاجر الأثاث والمفروشات وأدوات المنزل والمطبخ في السعودية.',
    stores: [
      'blends-home', 'homes-mart', 'west-elm', 'sedar', 'qasr-al-awani',
      'pitonia', 'ace', 'better-life', 'bath',
    ],
  },
  {
    slug: 'electronics',
    label: 'إلكترونيات وألعاب',
    keyword: 'كوبونات الإلكترونيات',
    icon: '📱',
    description: 'كوبونات وأكواد خصم متاجر الإلكترونيات والأجهزة والألعاب والخدمات الرقمية في السعودية.',
    stores: [
      'huawei', 'govee', 'dyson', 'one-card', 'metro-brazil', 'raya-shop',
      'kinguin', 'gamivo', 'hostinger',
    ],
  },
  {
    slug: 'health',
    label: 'الصحة والمكملات',
    keyword: 'كوبونات المكملات الغذائية',
    icon: '💊',
    description: 'كوبونات وأكواد خصم متاجر المكملات الغذائية والصحة والعافية في السعودية.',
    stores: ['iherb', 'sporter', 'altibbi'],
  },
  {
    slug: 'travel',
    label: 'السفر والمطاعم',
    keyword: 'كوبونات السفر والمطاعم',
    icon: '✈️',
    description: 'كوبونات وأكواد خصم الطيران والفنادق والمطاعم وتوصيل الطعام في السعودية.',
    stores: ['airalo', 'flyin', 'dubai', 'the-entertainer', 'hello-chef', 'delicut'],
  },
  {
    slug: 'marketplace',
    label: 'تسوق عام وماركت بليس',
    keyword: 'كوبونات المتاجر الإلكترونية',
    icon: '🛒',
    description: 'كوبونات وأكواد خصم أشهر المتاجر الإلكترونية والأسواق العامة في السعودية.',
    stores: [
      'noon', 'noon-nownow', 'aliexpress', 'dhgate', 'fordeal', 'wish',
      'saramart', 'ubuy', 'storeus', 'coupon', 'best',
    ],
  },
]

/** The catch-all every unmapped store lands in — never leave a store orphaned. */
export const FALLBACK_CATEGORY = 'marketplace'

const STORE_TO_CATEGORY: Map<string, string> = (() => {
  const m = new Map<string, string>()
  for (const cat of COUPON_CATEGORIES) {
    for (const store of cat.stores) m.set(store, cat.slug)
  }
  return m
})()

export function categoryForStore(storeSlug: string): string {
  return STORE_TO_CATEGORY.get(storeSlug) ?? FALLBACK_CATEGORY
}

export function getCouponCategory(slug: string): CouponCategory | undefined {
  return COUPON_CATEGORIES.find(c => c.slug === slug)
}

/**
 * Store slugs to match for a category page. `marketplace` is special: it owns
 * both its listed stores AND anything unmapped, so the page query can't just
 * use the static list — the route resolves that case against the live stores.
 */
export function storeSlugsForCategory(slug: string): string[] {
  return getCouponCategory(slug)?.stores ?? []
}
