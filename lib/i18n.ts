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
  'nav.list': { ar: 'قائمتي', en: 'My list' },
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

  // Common (shared)
  'common.copy': { ar: 'نسخ', en: 'Copy' },
  'common.copied': { ar: 'تم!', en: 'Copied!' },
  'common.prev': { ar: 'السابق', en: 'Previous' },
  'common.next': { ar: 'التالي', en: 'Next' },
  'common.clearAll': { ar: 'مسح الكل', en: 'Clear all' },
  'common.all': { ar: 'الكل', en: 'All' },
  'common.close': { ar: 'إغلاق', en: 'Close' },

  // Install prompt
  'install.title': { ar: 'ثبّت تطبيق سمارت كوبونز', en: 'Install the SmartCopons app' },
  'install.subtitle': { ar: 'أسرع، ويعمل من شاشتك الرئيسية', en: 'Faster, and works from your home screen' },
  'install.button': { ar: 'تثبيت', en: 'Install' },

  // Shopping list widget
  'cart.title': { ar: 'قائمة التسوق', en: 'Shopping list' },
  'cart.empty': { ar: 'قائمتك فارغة', en: 'Your list is empty' },
  'cart.emptyHint': { ar: 'أضف العروض التي تنوي شراءها', en: 'Add the offers you plan to buy' },
  'cart.total': { ar: 'الإجمالي', en: 'Total' },
  'cart.savings': { ar: 'إجمالي التوفير 🎉', en: 'Total savings 🎉' },
  'cart.shareWhatsapp': { ar: 'مشاركة القائمة عبر واتساب', en: 'Share list on WhatsApp' },
  'cart.clearPurchased': { ar: 'حذف المشترى ({n})', en: 'Clear purchased ({n})' },
  'cart.clearAll': { ar: 'إفراغ القائمة', en: 'Clear list' },
  'cart.decrease': { ar: 'إنقاص', en: 'Decrease' },
  'cart.increase': { ar: 'زيادة', en: 'Increase' },
  'cart.remove': { ar: 'حذف', en: 'Remove' },
  'cart.share.title': { ar: '🛒 *قائمة التسوق - SmartCopons*', en: '🛒 *Shopping list - SmartCopons*' },
  'cart.share.total': { ar: '💰 الإجمالي:', en: '💰 Total:' },
  'cart.share.saved': { ar: '🎉 وفّرت:', en: '🎉 You saved:' },
  'cart.share.via': { ar: 'عبر sa.smartcopons.com', en: 'via sa.smartcopons.com' },

  // Category listing
  'category.none': { ar: 'لا توجد منتجات في هذا التصنيف', en: 'No products in this category' },
  'category.couponsNone': { ar: 'لا توجد كوبونات في هذا التصنيف حالياً', en: 'No coupons in this category right now' },

  // Retailer page
  'retailer.results': { ar: '{n} نتيجة', en: '{n} results' },
  'retailer.productsCount': { ar: '{n} منتج', en: '{n} products' },
  'retailer.endsOn': { ar: 'ينتهي {date}', en: 'ends {date}' },
  'retailer.flyerSoon': { ar: 'تصفّح العروض أدناه، وسنضيف النشرة فور صدورها', en: "Browse the offers below — we'll add the flyer as soon as it's out" },
  'retailer.flyerPage': { ar: 'صفحة هذه النشرة ←', en: "This flyer's page →" },
  'retailer.noResults': { ar: 'لم يتم العثور على نتائج', en: 'No results found' },
  'retailer.noOffers': { ar: 'لا توجد عروض حالياً', en: 'No offers right now' },
  'retailer.noMatch': { ar: 'لا توجد منتجات تطابق "{q}"', en: 'No products match "{q}"' },
  'retailer.tryFilters': { ar: 'جرب تغيير الفلاتر أو البحث', en: 'Try changing the filters or search' },
  'retailer.clearFiltersSearch': { ar: 'مسح الفلاتر والبحث', en: 'Clear filters and search' },

  // Offers page + filters
  'offers.title': { ar: 'عروض السوبرماركت', en: 'Supermarket offers' },
  'offers.subtitle': { ar: 'اكتشف أفضل العروض والخصومات', en: 'Discover the best deals and discounts' },
  'offers.searchPlaceholder': { ar: 'ابحث عن منتج، علامة تجارية...', en: 'Search products, brands…' },
  'offers.searchChip': { ar: 'بحث: {q}', en: 'Search: {q}' },
  'offers.couponsLatest': { ar: 'أحدث كوبونات الخصم', en: 'Latest coupons' },
  'offers.couponsOf': { ar: 'كوبونات {name}', en: '{name} coupons' },
  'offers.matchingCoupons': { ar: 'كوبونات خصم مطابقة ({n})', en: 'Matching coupons ({n})' },
  'offers.showing': { ar: 'عرض {shown} من {total} منتج', en: 'Showing {shown} of {total} products' },
  'offers.pageOf': { ar: 'صفحة {page} من {total}', en: 'Page {page} of {total}' },
  'offers.noProducts': { ar: 'لا توجد منتجات متطابقة', en: 'No matching products' },
  'offers.clearFilters': { ar: 'مسح الفلاتر', en: 'Clear filters' },
  'offers.showResults': { ar: 'عرض النتائج', en: 'Show results' },
  'offers.bestWeek': { ar: 'أفضل عروض الأسبوع', en: 'Best deals of the week' },
  'offers.discountUpTo': { ar: 'خصم حتى {n}%', en: 'Up to {n}% off' },
  'offers.shopByStore': { ar: 'تسوق حسب المتجر', en: 'Shop by store' },
  'offers.available': { ar: '{n} عرض متوفر', en: '{n} live offers' },
  'offers.loadingFilters': { ar: 'جاري تحميل الفلاتر...', en: 'Loading filters…' },
  'common.loading': { ar: 'جارٍ التحميل…', en: 'Loading…' },
  'filters.title': { ar: 'الفلاتر', en: 'Filters' },
  'filters.stores': { ar: 'المتاجر', en: 'Stores' },
  'filters.allStores': { ar: 'جميع المتاجر', en: 'All stores' },
  'filters.categories': { ar: 'الفئات', en: 'Categories' },
  'filters.allCategories': { ar: 'جميع الفئات', en: 'All categories' },
  'filters.price': { ar: 'السعر', en: 'Price' },
  'sort.by': { ar: 'ترتيب حسب:', en: 'Sort by:' },
  'sort.discount': { ar: 'الأكثر خصماً', en: 'Biggest discount' },
  'sort.ending': { ar: 'ينتهي قريباً', en: 'Ending soon' },
  'sort.priceLow': { ar: 'السعر: الأقل', en: 'Price: low to high' },
  'sort.priceHigh': { ar: 'السعر: الأعلى', en: 'Price: high to low' },
  'sort.newest': { ar: 'الأحدث', en: 'Newest' },
  'sort.popular': { ar: 'الأكثر مشاهدة', en: 'Most viewed' },

  // Coupons page + card
  'coupons.title': { ar: 'كوبونات الخصم والعروض', en: 'Discount coupons & deals' },
  'coupons.subtitle': { ar: 'وفر أكثر مع أحدث أكواد الخصم — {n} كوبون متوفر', en: 'Save more with the latest codes — {n} coupons available' },
  'coupons.browseCategory': { ar: 'تصفّح حسب الفئة', en: 'Browse by category' },
  'coupons.allCoupons': { ar: 'كل الكوبونات', en: 'All coupons' },
  'coupons.aeTitle': { ar: 'كوبونات الخصم في الإمارات', en: 'Discount coupons in the UAE' },
  'coupons.aeSubtitle': { ar: '{n} كوبون فعّال — انسخ الكود واستخدمه عند الدفع', en: '{n} active coupons — copy the code and use it at checkout' },
  'coupons.aeNone': { ar: 'لا توجد كوبونات متاحة للإمارات حالياً.', en: 'No coupons available for the UAE right now.' },
  'coupons.all': { ar: 'الكل ({n})', en: 'All ({n})' },
  'coupons.none': { ar: 'لا توجد كوبونات حالياً', en: 'No coupons right now' },
  'coupons.followUs': { ar: 'تابعنا للحصول على أحدث الكوبونات', en: 'Follow us for the latest coupons' },
  'coupons.seoTitle': { ar: 'كوبونات خصم السعودية', en: 'Saudi discount coupons' },
  'coupons.seoP1': {
    ar: 'اكتشف أحدث كوبونات الخصم وأكواد التخفيض من أشهر المتاجر في السعودية. نوفر لك كوبونات نون، نمشي، أمازون وغيرها من المتاجر الإلكترونية. انسخ الكود واستخدمه عند الدفع للحصول على خصم فوري.',
    en: 'Discover the latest discount coupons and promo codes from the top stores in Saudi Arabia — Noon, Namshi, Amazon and more. Copy the code and use it at checkout for an instant discount.',
  },
  'couponCard.details': { ar: 'عرض التفاصيل', en: 'View details' },
  'coupon.codeLabel': { ar: 'كود الكوبون:', en: 'Coupon code:' },
  'coupon.detailsHeading': { ar: 'تفاصيل الكوبون', en: 'Coupon details' },
  'coupon.useNow': { ar: 'استخدم الكوبون الآن ←', en: 'Use the coupon now →' },
  'coupon.copyHint': { ar: 'انسخ الكود «{code}» ثم الصقه عند إتمام الطلب في {store}', en: 'Copy the code "{code}" and paste it at checkout with {store}' },
  'coupon.seoTitle': { ar: 'كود خصم {store}', en: '{store} discount code' },
  'coupon.seoP1': {
    ar: 'وفّر على مشترياتك من {store} باستخدام كود الخصم «{code}» للحصول على {discount}. نحدّث كوبونات وأكواد خصم {store} أولاً بأول لتحصل على أحدث العروض السارية في السعودية. انسخ الكود، انتقل إلى المتجر، والصقه في خانة كود الخصم عند الدفع.',
    en: 'Save on your {store} purchases with the code "{code}" to get {discount}. We keep {store} coupons and codes up to date so you get the latest working offers in Saudi Arabia. Copy the code, go to the store, and paste it in the promo-code field at checkout.',
  },
  'coupon.moreFrom': { ar: 'كوبونات {store} الأخرى', en: 'More {store} coupons' },

  // Favourites
  'fav.priceWatches': { ar: 'متابعة الأسعار', en: 'Price watches' },
  'fav.unavailable': { ar: 'غير متوفر حالياً', en: 'Not available now' },
  'fav.priceDropped': { ar: 'نزل السعر ↓', en: 'Price dropped ↓' },
  'fav.empty': { ar: 'لا توجد منتجات في مفضّلتك بعد', en: 'No products in your favourites yet' },
  'fav.emptyHint': { ar: 'اضغط على القلب في أي منتج لحفظه هنا', en: 'Tap the heart on any product to save it here' },
  'fav.browseOffers': { ar: 'تصفّح العروض', en: 'Browse offers' },

  // Coupon-store page
  'store.couponsOf': { ar: 'كوبونات {name}', en: '{name} coupons' },
  'store.activeCount': { ar: '{n} كوبون وكود خصم ساري', en: '{n} active coupons & codes' },
  'store.noneNow': { ar: 'لا توجد كوبونات سارية حالياً', en: 'No active coupons right now' },
  'store.noneAvailable': { ar: 'لا توجد كوبونات متاحة حالياً', en: 'No coupons available right now' },
  'store.browseAll': { ar: 'تصفّح كل الكوبونات', en: 'Browse all coupons' },
  'store.seoTitle': { ar: 'كوبونات وأكواد خصم {name}', en: '{name} coupons & discount codes' },
  'store.seoP1': {
    ar: 'تصفّح أحدث كوبونات {name} وأكواد الخصم السارية في السعودية. نحرص على تحديث الأكواد باستمرار لضمان حصولك على خصم فعّال. اختر الكوبون المناسب، انسخ الكود، ثم استخدمه عند إتمام طلبك في {name} لتوفير المزيد.',
    en: 'Browse the latest {name} coupons and active discount codes in Saudi Arabia. We keep the codes updated so you always get a working discount. Pick the right coupon, copy the code, then use it at checkout with {name} to save more.',
  },

  // Supermarkets directory
  'stores.title': { ar: 'المتاجر في السعودية', en: 'Stores in Saudi Arabia' },
  'stores.subtitle': { ar: 'اختر المتجر لتصفح أحدث العروض والخصومات', en: 'Pick a store to browse its latest deals and discounts' },
  'stores.flyers': { ar: '{n} نشرة', en: '{n} flyers' },
  'stores.none': { ar: 'لا توجد متاجر حالياً', en: 'No stores right now' },

  // Deal validity (ExpiryBadge, cards, flyer status pill)
  'validity.active': { ar: 'عرض ساري', en: 'Active offer' },
  'validity.startsIn': { ar: 'يبدأ خلال {days}', en: 'Starts in {days}' },
  'validity.expired': { ar: 'انتهى العرض', en: 'Offer ended' },
  'validity.today': { ar: 'ينتهي اليوم!', en: 'Ends today!' },
  'validity.endsIn': { ar: 'ينتهي خلال {days}', en: 'Ends in {days}' },
  'validity.day1': { ar: 'يوم واحد', en: '1 day' },
  'validity.day2': { ar: 'يومين', en: '2 days' },
  'validity.daysFew': { ar: '{n} أيام', en: '{n} days' },
  'validity.daysMany': { ar: '{n} يوماً', en: '{n} days' },

  // Flyer
  'flyer.breadcrumb': { ar: 'نشرة {date}', en: 'Flyer {date}' },
  'flyer.headingOf': { ar: 'عروض {store} — {date}', en: '{store} offers — {date}' },
  'flyer.highlights': { ar: 'أبرز عروض هذه النشرة', en: 'Top offers in this flyer' },
  'flyer.allOffersOf': { ar: 'كل عروض {store}', en: 'All {store} offers' },
  'flyer.none': { ar: 'لا توجد نشرة متاحة حالياً', en: 'No flyer available right now' },
  'flyer.openExternally': { ar: 'النشرة متاحة كملف PDF من موقع المتجر', en: 'This flyer is available as a PDF from the retailer' },
  'flyer.openPdf': { ar: 'افتح النشرة', en: 'Open the flyer' },
  'flyer.browseBelow': { ar: 'تصفّح العروض أدناه', en: 'Browse the offers below' },
  'flyer.pages': { ar: '{n} صفحة', en: '{n} pages' },
  'flyer.prevPage': { ar: 'الصفحة السابقة', en: 'Previous page' },
  'flyer.nextPage': { ar: 'الصفحة التالية', en: 'Next page' },
  'flyer.of': { ar: 'من', en: 'of' },
  'flyer.loading': { ar: 'جاري تحميل النشرة...', en: 'Loading flyer…' },
  'flyer.openFull': { ar: 'فتح الصورة بالحجم الكامل', en: 'Open full-size image' },
  'flyer.pageAria': { ar: 'صفحة {n}', en: 'Page {n}' },
  'flyer.browseWeekly': { ar: 'تصفّح النشرة الأسبوعية', en: 'Browse the weekly flyer' },
  'flyer.pageByPage': { ar: 'عروض {store} صفحة بصفحة', en: '{store} offers, page by page' },

  // Privacy policy
  'privacy.title': { ar: 'سياسة الخصوصية', en: 'Privacy policy' },
  'privacy.updated': { ar: 'آخر تحديث: {date}', en: 'Last updated: {date}' },
  'privacy.intro': {
    ar: 'تشرح هذه السياسة ما تجمعه منصة سمارت كوبونز (الموقع sa.smartcopons.com وتطبيق الجوال) وكيف نستخدمه. باستخدامك المنصة فإنك توافق على ما ورد هنا.',
    en: 'This policy explains what SmartCopons (the site sa.smartcopons.com and the mobile app) collects and how we use it. By using the platform you agree to what is described here.',
  },
  'privacy.h.noAccount': { ar: 'لا نطلب حساباً ولا بيانات شخصية', en: 'No account or personal data required' },
  'privacy.p.noAccount': {
    ar: 'لا يتطلب استخدام سمارت كوبونز التسجيل أو تسجيل الدخول. لا نجمع الاسم أو البريد الإلكتروني أو رقم الجوال أو العنوان أو أي بيانات دفع، ولا نطلب صلاحيات الكاميرا أو جهات الاتصال أو الموقع الجغرافي.',
    en: 'Using SmartCopons requires no sign-up or login. We do not collect your name, email, phone number, address or any payment details, and we do not request camera, contacts or location permissions.',
  },
  'privacy.h.store': { ar: 'ما الذي نخزّنه فعلاً', en: 'What we actually store' },
  'privacy.li.device': {
    ar: 'مُعرّف جهاز مجهول: رقم عشوائي يُنشأ في متصفحك/تطبيقك لحفظ المفضّلة ومتابعة الأسعار. هذا المعرّف لا يرتبط بهويتك ولا يمكننا من معرفة من أنت.',
    en: 'An anonymous device id: a random number generated in your browser/app to save your favourites and price watches. It is not tied to your identity and does not let us know who you are.',
  },
  'privacy.li.local': {
    ar: 'قائمة التسوّق وعمليات البحث السابقة: تُحفظ داخل جهازك فقط (Local Storage) ولا تُرسل إلى خوادمنا.',
    en: 'Your shopping list and recent searches: stored on your device only (Local Storage) and never sent to our servers.',
  },
  'privacy.li.usage': {
    ar: 'بيانات استخدام مجمّعة: عدد مشاهدات المنتجات وإحصاءات زيارة عامة، لتحسين ترتيب العروض والأداء.',
    en: 'Aggregated usage data: product view counts and general visit statistics, used to improve offer ranking and performance.',
  },
  'privacy.h.analytics': { ar: 'أدوات التحليل', en: 'Analytics' },
  'privacy.p.analytics': {
    ar: 'نستخدم Google Analytics لفهم كيفية استخدام المنصة بشكل إجمالي (الصفحات الأكثر زيارة، نوع الجهاز، مصدر الزيارة). قد تضع هذه الأداة ملفات تعريف ارتباط أو معرّفات مشابهة. البيانات مجمّعة ولا تُستخدم لتحديد هويتك. يمكنك الاطلاع على',
    en: 'We use Google Analytics to understand how the platform is used in aggregate (most-visited pages, device type, traffic source). It may set cookies or similar identifiers. The data is aggregated and is not used to identify you. You can read',
  },
  'privacy.link.google': { ar: 'سياسة خصوصية Google', en: "Google's privacy policy" },
  'privacy.h.external': { ar: 'روابط المتاجر الخارجية', en: 'External store links' },
  'privacy.p.external': {
    ar: 'نعرض عروضاً وكوبونات من متاجر خارجية (بنده، كارفور، التميمي، لولو، النهدي، الدواء، وغيرها). عند الضغط على عرض أو كوبون قد تنتقل إلى موقع المتجر، وعندها تسري سياسة خصوصية ذلك المتجر لا سياستنا. الأسعار والعروض مملوكة لأصحابها ونعرضها للمقارنة فقط.',
    en: 'We show offers and coupons from external stores (Panda, Carrefour, Tamimi, LuLu, Nahdi, Al Dawaa and others). Tapping an offer or coupon may take you to the store’s site, where that store’s privacy policy applies, not ours. Prices and offers belong to their owners and are shown for comparison only.',
  },
  'privacy.h.sharing': { ar: 'مشاركة البيانات', en: 'Data sharing' },
  'privacy.p.sharing': {
    ar: 'لا نبيع بياناتك ولا نؤجّرها ولا نشاركها لأغراض تسويقية. نستعين بمزوّدي خدمة تقنيين لتشغيل المنصة (الاستضافة وقاعدة البيانات وأدوات التحليل) ضمن ما يلزم لتشغيلها فقط.',
    en: 'We do not sell, rent or share your data for marketing. We rely on technical service providers to run the platform (hosting, database and analytics) only as needed to operate it.',
  },
  'privacy.h.rights': { ar: 'حقوقك', en: 'Your rights' },
  'privacy.p.rights': {
    ar: 'يمكنك في أي وقت حذف مفضّلتك ومتابعاتك من داخل التطبيق، أو مسح بيانات التطبيق/المتصفح — وبذلك يُحذف مُعرّف الجهاز المجهول وتُفقد المفضّلة المرتبطة به. كما يمكنك مراسلتنا لطلب حذف أي بيانات مرتبطة بمعرّف جهازك.',
    en: 'You can delete your favourites and watches from within the app at any time, or clear the app/browser data — which removes the anonymous device id and the favourites linked to it. You can also email us to request deletion of any data linked to your device id.',
  },
  'privacy.h.children': { ar: 'خصوصية الأطفال', en: 'Children’s privacy' },
  'privacy.p.children': {
    ar: 'المنصة موجّهة للجمهور العام ولا نجمع عن قصد أي بيانات من الأطفال دون سن 13 عاماً.',
    en: 'The platform is intended for a general audience and we do not knowingly collect data from children under 13.',
  },
  'privacy.h.changes': { ar: 'التعديلات', en: 'Changes' },
  'privacy.p.changes': {
    ar: 'قد نحدّث هذه السياسة، وسيظهر تاريخ آخر تحديث أعلى الصفحة. استمرارك في استخدام المنصة بعد التحديث يعني موافقتك على النسخة المحدّثة.',
    en: 'We may update this policy; the last-updated date at the top of the page will reflect it. Continuing to use the platform after an update means you accept the updated version.',
  },
  'privacy.h.contact': { ar: 'التواصل', en: 'Contact' },
  'privacy.p.contact': { ar: 'لأي استفسار بخصوص الخصوصية:', en: 'For any privacy question:' },

  // Compare page
  'compare.title': { ar: 'مقارنة الأسعار', en: 'Price comparison' },
  'compare.subtitle': { ar: 'قارن سعر المنتج بين جميع المتاجر واعثر على الأرخص', en: "Compare a product's price across all stores and find the cheapest" },
  'compare.searchPlaceholder': { ar: 'قارن سعر منتج… مثال: أرز بسمتي', en: "Compare a product's price… e.g. basmati rice" },
  'compare.compareBtn': { ar: 'قارن', en: 'Compare' },
  'compare.discount': { ar: 'الخصم', en: 'Discount' },
  'compare.prompt': { ar: 'ابحث عن منتج لمقارنة أسعاره بين المتاجر', en: 'Search for a product to compare its price across stores' },
  'compare.noResults': { ar: 'لا توجد عروض حالية لـ «{q}» للمقارنة', en: 'No current offers to compare for "{q}"' },
  'compare.oldPrice': { ar: 'السعر الأصلي', en: 'Original price' },
  'compare.validUntil': { ar: 'ساري حتى', en: 'Valid until' },
  'compare.validUntilShort': { ar: 'ساري حتى {date}', en: 'Valid until {date}' },
  'compare.last30': { ar: 'آخر 30 يوم', en: 'Last 30 days' },
  'common.storesCount': { ar: '{n} متاجر', en: '{n} stores' },

  // Product page
  'product.cheapest': { ar: 'الأرخص 🏆', en: 'Cheapest 🏆' },
  'product.cheapestShort': { ar: 'الأرخص', en: 'Cheapest' },
  'product.compareTitle': { ar: 'مقارنة السعر في متاجر أخرى', en: 'Price comparison across stores' },
  'product.storesCount': { ar: '({n} متاجر)', en: '({n} stores)' },
  'product.thStore': { ar: 'المتجر', en: 'Store' },
  'product.thPrice': { ar: 'السعر', en: 'Price' },
  'product.thDiff': { ar: 'الفرق', en: 'Difference' },
  'product.thisPage': { ar: '(هذه الصفحة)', en: '(this page)' },
  'product.related': { ar: 'عروض مشابهة', en: 'Similar offers' },
  'product.relatedIn': { ar: 'عروض مشابهة في {cat}', en: 'Similar offers in {cat}' },

  // Product card
  'card.noImage': { ar: 'لا توجد صورة', en: 'No image' },
  'card.addToList': { ar: '＋ أضف للقائمة', en: '＋ Add to list' },
  'card.inList': { ar: 'في القائمة ✓', en: 'In list ✓' },
  'card.favAdd': { ar: 'إضافة إلى المفضّلة', en: 'Add to favourites' },
  'card.favRemove': { ar: 'إزالة من المفضّلة', en: 'Remove from favourites' },
  'card.shareWhatsapp': { ar: 'مشاركة عبر واتساب', en: 'Share on WhatsApp' },
  'card.price': { ar: 'السعر', en: 'Price' },
  'card.was': { ar: 'كان', en: 'was' },
  'card.product': { ar: 'منتج', en: 'Product' },
  // Coupon surfaces (a) / (b) / (c)
  'listCoupon.heading': { ar: 'كود خصم يوفّر لك أكثر', en: 'A code to save even more' },
  'listCoupon.headingStore': { ar: 'كود خصم {store}', en: '{store} discount code' },
  'listCoupon.exclusive': { ar: 'حصري', en: 'Exclusive' },
  'listCoupon.copyAndGo': { ar: 'انسخ وتسوّق', en: 'Copy & shop' },
  'listCoupon.copyOnly': { ar: 'انسخ الكود', en: 'Copy code' },
  'listCoupon.copied': { ar: '✓ تم النسخ', en: '✓ Copied' },
  'cart.share.coupon': { ar: 'كود خصم {store}: {code}', en: '{store} discount code: {code}' },
  'retailerCoupon.heading': { ar: 'أكواد خصم لهذا المتجر', en: 'Discount codes for this store' },
  'couponsPage.title': { ar: 'كوبونات الخصم', en: 'Discount coupons' },
  'couponsPage.subtitle': { ar: '{n} كوبون منتقى', en: '{n} curated coupons' },
  'couponsPage.empty': { ar: 'لا توجد كوبونات نشطة حالياً', en: 'No active coupons right now' },
  'flyer.downloadPdf': { ar: 'تحميل PDF', en: 'Download PDF' },
  'couponsPage.search': { ar: 'ابحث عن متجر أو كود…', en: 'Search a store or code…' },
  'couponsPage.all': { ar: 'الكل', en: 'All' },
  'couponsPage.noResults': { ar: 'لا نتائج مطابقة لبحثك', en: 'No results match your search' },
  'couponsPage.exclusive': { ar: 'حصري', en: 'Exclusive' },
  'couponsPage.nCodes': { ar: '{n} كود', en: '{n} codes' },
  'couponsPage.browseOffers': { ar: 'تصفح عروض السوبرماركت', en: 'Browse supermarket offers' },
  // Shareable list (D-lite)
  'cart.share.open': { ar: 'افتح القائمة:', en: 'Open the list:' },
  'sharedList.title': { ar: 'قائمة تسوق مشتركة', en: 'Shared shopping list' },
  'sharedList.subtitle': { ar: '{n} منتج في هذه القائمة', en: '{n} items in this list' },
  'sharedList.adopt': { ar: 'أضف القائمة إلى قائمتي', en: 'Add this list to mine' },
  'sharedList.adopted': { ar: 'تمت الإضافة إلى قائمتك ✓', en: 'Added to your list ✓' },
  'sharedList.browse': { ar: 'تصفّح عروض السوبرماركت', en: 'Browse supermarket offers' },
  'home.divider': { ar: 'عروض السعودية', en: 'KSA offers' },
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

/**
 * A date as plain numerals, e.g. "22/8/2026".
 *
 * Two things are pinned deliberately:
 *
 *  - `calendar: 'gregory'`. Bare `toLocaleDateString('ar-SA')` returns a HIJRI
 *    date on a full-ICU runtime (Node 24 locally gives ٩‏/٣‏/١٤٤٨ هـ) but a
 *    Gregorian one on Vercel's build — the same code rendering a different
 *    calendar depending on which ICU data is present. A flyer expiry silently
 *    switching calendars is worse than either choice.
 *  - `numberingSystem: 'latn'`. Prices across the site use Western digits, so
 *    expiry dates rendering as ٢٢‏/٨‏/٢٠٢٦ next to "12.50" was inconsistent, and
 *    the project standard is Western numerals everywhere.
 */
export function formatDateNumeric(lang: Lang, date: string | Date | null | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'ar-SA', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      calendar: 'gregory',
      numberingSystem: 'latn',
    }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

/**
 * A number with grouping separators, always in Western digits: "23,939".
 *
 * Pinned for the same reason as formatDateNumeric: `n.toLocaleString()` with no
 * locale uses the RUNTIME's default, so the same code can emit Arabic-Indic
 * digits on one host and Western on another. Every price on the site is Western,
 * so the counts beside them must be too.
 */
export function formatNumber(n: number, lang: Lang = 'ar'): string {
  try {
    return new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'ar-SA', {
      numberingSystem: 'latn',
    }).format(n)
  } catch {
    return String(n)
  }
}

/**
 * A date + time for internal/admin screens: "22/8/2026, 14:05".
 *
 * `en-SA` looks safe but is not — the SA region's preferred calendar is
 * islamic-umalqura, so `toLocaleString('en-SA')` can render a Hijri date on a
 * full-ICU runtime while showing Gregorian in development. Admin screens read
 * these against scrape logs and flyer windows, so a silently switching calendar
 * is worse here than on the public site.
 */
export function formatDateTimeAdmin(date: string | Date | null | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      calendar: 'gregory',
      numberingSystem: 'latn',
      timeZone: 'Asia/Riyadh',
    }).format(d)
  } catch {
    return d.toISOString().slice(0, 16).replace('T', ' ')
  }
}
