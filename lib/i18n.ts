/**
 * Lightweight bilingual (Arabic / English) UI layer.
 *
 * SmartCopons is Arabic-first and its catalogue is ~99% Arabic-named, so this
 * is deliberately a UI-language toggle, NOT per-locale routing: it translates
 * the chrome and page copy and flips direction (RTL/LTR), while product data
 * stays whatever the retailer gave us (English name preferred when present).
 *
 * Language is a cookie (see LANG_COOKIE). The root layout reads it server-side
 * to set <html lang dir> and seed the client provider, so there is no flash and
 * server components render in the right language too.
 *
 * This module is pure (no next/headers), so it is safe to import from both
 * server and client. `getLang()` (server, cookie) lives in lib/i18n-server.ts.
 */

export type Lang = 'ar' | 'en'

export const LANG_COOKIE = 'sc_lang'
export const DEFAULT_LANG: Lang = 'ar'

export function isLang(v: unknown): v is Lang {
  return v === 'ar' || v === 'en'
}

export function dirOf(lang: Lang): 'rtl' | 'ltr' {
  return lang === 'ar' ? 'rtl' : 'ltr'
}

/**
 * Product name for the current language. English mode prefers nameEn (the ~1%
 * that have one) and falls back to Arabic; Arabic mode is the reverse.
 */
export function productName(
  lang: Lang,
  nameAr?: string | null,
  nameEn?: string | null
): string {
  const ar = (nameAr || '').trim()
  const en = (nameEn || '').trim()
  if (lang === 'en') return en || ar || 'Product'
  return ar || en || 'منتج'
}

type Entry = { ar: string; en: string }

// Flat, dotted-key dictionary. Keep keys grouped by surface. Only the strings
// on translated surfaces need to be here; anything missing falls back to Arabic
// then to the key itself, so a partial rollout never renders a blank.
const DICT: Record<string, Entry> = {
  // Global nav / chrome
  'nav.home': { ar: 'الرئيسية', en: 'Home' },
  'nav.offers': { ar: 'العروض', en: 'Offers' },
  'nav.coupons': { ar: 'كوبونات', en: 'Coupons' },
  'nav.stores': { ar: 'المتاجر', en: 'Stores' },
  'nav.favorites': { ar: 'المفضّلة', en: 'Favourites' },
  'search.placeholder': { ar: 'ابحث عن منتج، متجر أو تصنيف...', en: 'Search products, stores or categories…' },
  'a11y.menu': { ar: 'القائمة', en: 'Menu' },
  'a11y.changeCountry': { ar: 'تغيير الدولة', en: 'Change country' },
  'lang.switchTo': { ar: 'English', en: 'العربية' }, // label shows the OTHER language
  'lang.switchAria': { ar: 'التبديل إلى الإنجليزية', en: 'Switch to Arabic' },

  // Footer
  'footer.tagline': {
    ar: 'أفضل عروض وخصومات السوبرماركت في المملكة العربية السعودية. وفر أكثر كل يوم.',
    en: 'The best supermarket deals and discounts in Saudi Arabia. Save more every day.',
  },
  'footer.quickLinks': { ar: 'روابط سريعة', en: 'Quick links' },
  'footer.couponsFull': { ar: 'كوبونات الخصم', en: 'Discount coupons' },
  'footer.privacy': { ar: 'سياسة الخصوصية', en: 'Privacy policy' },
  'footer.contact': { ar: 'تواصل معنا', en: 'Contact us' },
  'footer.rights': { ar: 'جميع الحقوق محفوظة', en: 'All rights reserved' },

  // Common actions
  'common.viewAll': { ar: 'عرض الكل', en: 'View all' },
  'common.viewMore': { ar: 'عرض المزيد', en: 'View more' },
  'common.offer': { ar: 'عرض', en: 'offer' },
  'common.offers': { ar: 'عرض', en: 'offers' },
  'common.offersOf': { ar: 'عروض {name}', en: '{name} offers' },

  // Home — banner + sections
  'home.banner': { ar: 'اكتشف أفضل عروض وخصومات السوبرماركت في السعودية', en: 'Discover the best supermarket deals and discounts in Saudi Arabia' },
  'home.banner.ae': { ar: 'اكتشف أفضل عروض وخصومات السوبرماركت في الإمارات', en: 'Discover the best supermarket deals and discounts in the UAE' },
  'home.stat.offers': { ar: 'عرض متوفر', en: 'live offers' },
  'home.stat.stores': { ar: 'متجر', en: 'stores' },
  'home.stat.coupons': { ar: 'كوبون خصم', en: 'coupons' },
  'home.section.stores': { ar: 'المتاجر', en: 'Stores' },
  'home.section.coupons': { ar: 'كوبونات وخصومات', en: 'Coupons & deals' },
  'home.section.categories': { ar: 'التصنيفات', en: 'Categories' },
  'home.section.endingSoon': { ar: 'ينتهي قريباً', en: 'Ending soon' },
  'home.section.within3': { ar: 'خلال 3 أيام', en: 'within 3 days' },
  'home.section.topDiscounts': { ar: 'أكبر الخصومات', en: 'Biggest discounts' },
  'home.section.mostViewed': { ar: 'الأكثر مشاهدة', en: 'Most viewed' },
  'home.section.latest': { ar: 'أحدث العروض', en: 'Latest offers' },
  'home.coupons.copy': { ar: 'نسخ الكود', en: 'Copy code' },
  'home.coupons.copied': { ar: '✓ تم!', en: '✓ Copied!' },
  'home.categories.couponsCard': { ar: 'كوبونات وخصومات', en: 'Coupons & deals' },
  'home.couponCount': { ar: '{n} كوبون', en: '{n} coupons' },
  'home.seo.title': { ar: 'عروض السوبرماركت في السعودية', en: 'Supermarket offers in Saudi Arabia' },
  'home.seo.p1': {
    ar: 'موقع SmartCopons يقدم لك أحدث عروض وخصومات السوبرماركت في المملكة العربية السعودية. تصفح عروض بنده، كارفور، لولو هايبرماركت، الدانوب وغيرها من المتاجر الكبرى.',
    en: 'SmartCopons brings you the latest supermarket deals and discounts in Saudi Arabia. Browse offers from Panda, Carrefour, LuLu Hypermarket, Danube and other major retailers.',
  },
  // UAE landing
  'home.ae.hero': { ar: 'أفضل عروض وخصومات السوبرماركت في الإمارات', en: 'The best supermarket deals and discounts in the UAE' },
  'home.ae.sub': { ar: 'أسعار محدّثة يومياً بالدرهم من أكبر متاجر الإمارات', en: 'Prices updated daily in AED from the UAE’s biggest stores' },
  'home.ae.topDeals': { ar: 'أقوى الخصومات', en: 'Top discounts' },
  'home.ae.noOffers': { ar: 'لا توجد عروض متاحة حالياً — تُحدَّث يومياً.', en: 'No offers available right now — updated daily.' },
  'home.seo.p2': {
    ar: 'نحدث العروض يوميا لنوفر لك أفضل الأسعار على المنتجات الغذائية، المنظفات، الإلكترونيات وكل ما تحتاجه لمنزلك. وفر أكثر مع كوبونات الخصم الحصرية.',
    en: 'We update offers daily so you get the best prices on groceries, cleaning supplies, electronics and everything you need for your home. Save more with exclusive discount coupons.',
  },

  // Product card
  'card.noImage': { ar: 'لا توجد صورة', en: 'No image' },
  'card.addToList': { ar: '＋ أضف للقائمة', en: '＋ Add to list' },
  'card.inList': { ar: 'في القائمة ✓', en: 'In list ✓' },
  'card.favAdd': { ar: 'إضافة إلى المفضّلة', en: 'Add to favourites' },
  'card.favRemove': { ar: 'إزالة من المفضّلة', en: 'Remove from favourites' },
  'card.shareWhatsapp': { ar: 'مشاركة عبر واتساب', en: 'Share on WhatsApp' },
  'card.was': { ar: 'كان', en: 'was' },
  'card.product': { ar: 'منتج', en: 'Product' },
}

/** Translate a key. Interpolates {var} placeholders from `vars`. */
export function t(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const entry = DICT[key]
  let s = entry ? (lang === 'en' ? entry.en : entry.ar) : key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
  }
  return s
}
