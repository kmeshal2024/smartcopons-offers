import { prisma } from '@/lib/db'
import { unstable_cache } from 'next/cache'
import {
  TTL_LISTING,
  listVisibleRetailers,
  countAllActiveOffers,
  capPerRetailer,
  foodFirst,
} from '@/lib/offer-queries'
import Link from 'next/link'
import Header from '@/components/Header'
import ProductCard from '@/components/ProductCard'
import Footer from '@/components/Footer'
import type { Metadata } from 'next'
import { DEFAULT_COUNTRY } from '@/lib/countries'
import { getLang } from '@/lib/i18n-server'
import { t as translate, dirOf } from '@/lib/i18n'

export const metadata: Metadata = {
  // `absolute` bypasses the layout's `%s | SmartCopons` template so the brand
  // isn't repeated twice on the homepage.
  title: { absolute: 'SmartCopons | عروض وكوبونات السوبرماركت في السعودية' },
  description: 'اكتشف أحدث عروض السوبرماركت وكوبونات الخصم في السعودية. عروض بنده، كارفور، لولو، الدانوب وأكثر. وفر أكثر مع SmartCopons.',
  keywords: 'عروض السوبرماركت, كوبونات خصم, عروض بنده, عروض كارفور, عروض لولو, عروض الدانوب, خصومات السعودية',
  // The homepage emitted no canonical at all, as did /offers, /coupons and
  // /supermarkets — four of the site's highest-value URLs, each reachable with
  // assorted tracking and UTM query strings.
  alternates: { canonical: 'https://sa.smartcopons.com' },
  openGraph: {
    title: 'SmartCopons - عروض السوبرماركت في السعودية',
    description: 'أحدث عروض السوبرماركت وكوبونات الخصم',
    locale: 'ar_SA',
    type: 'website',
    url: 'https://sa.smartcopons.com',
  },
}

// Rendered per request, not prerendered at build. The Neon DB auto-suspends
// when idle, and a build that lands during a suspend can't reach it — which
// repeatedly failed deploys on this and the other DB-backed pages. Functions
// are pinned to Frankfurt next to the DB (see vercel.json), so the per-request
// query cost is small.
export const dynamic = 'force-dynamic'

const getHomeData = unstable_cache(async function getHomeData() {
  const [supermarkets, latestProducts, topDiscounts, categories, totalProducts, endingSoon] = await Promise.all([
    // Shared helper — ONE definition of a live offer, and the same visibility
    // rule as /supermarkets, each retailer page's noindex decision and the
    // sitemap. The inline query this replaces omitted `price > 0` and the flyer
    // end-date bound, so these cards advertised expired stock and scraper
    // placeholder rows: Tamimi read 24,100 against its page's 9,510, Carrefour
    // 18,471 against 7,416, Panda 3,363 against 1,242.
    listVisibleRetailers(DEFAULT_COUNTRY),
    prisma.productOffer.findMany({
      where: { isHidden: false, country: DEFAULT_COUNTRY, price: { gt: 0 }, flyer: { endDate: { gte: new Date() } } },
      include: {
        supermarket: { select: { nameAr: true, slug: true, logo: true } },
        category: { select: { nameAr: true, icon: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    // Over-fetch 60: capPerRetailer + foodFirst below can only shrink the list,
    // and 4 rows of headroom is not enough to survive a cap of 2 per retailer.
    prisma.productOffer.findMany({
      where: { isHidden: false, country: DEFAULT_COUNTRY, discountPercent: { gt: 0 }, flyer: { endDate: { gte: new Date() } } },
      include: {
        supermarket: { select: { nameAr: true, slug: true, logo: true } },
        category: { select: { nameAr: true, slug: true, icon: true } },
      },
      orderBy: { discountPercent: 'desc' },
      take: 60,
    }),
    prisma.category.findMany({
      where: { isActive: true, parentId: null },
      include: {
        _count: {
          select: {
            products: { where: { isHidden: false, country: DEFAULT_COUNTRY, flyer: { endDate: { gte: new Date() } } } },
          },
        },
      },
      orderBy: { order: 'asc' },
      take: 8,
    }),
    // Same live-offer definition as everything else. (This one already matched;
    // it goes through the helper so there is no second place to drift.)
    countAllActiveOffers(DEFAULT_COUNTRY),
    // Offers whose flyer ends within three days — a "grab it before it's gone"
    // strip. Soonest-to-expire first.
    prisma.productOffer.findMany({
      where: {
        isHidden: false, country: DEFAULT_COUNTRY,
        price: { gt: 0 },
        discountPercent: { gt: 0 },
        flyer: {
          endDate: { gte: new Date(), lte: new Date(Date.now() + 3 * 86_400_000) },
        },
      },
      include: {
        supermarket: { select: { nameAr: true, slug: true, logo: true } },
        category: { select: { nameAr: true, icon: true } },
        flyer: { select: { startDate: true, endDate: true } },
      },
      orderBy: { flyer: { endDate: 'asc' } },
      take: 8,
    }),
  ])

  // listVisibleRetailers already applies the visibility rule and orders by
  // viewCount; the homepage just takes the first 8 slots.
  const visibleSupermarkets = supermarkets.slice(0, 8)

  // Groceries first, then at most 2 per retailer. Without this the section was 4
  // Nahdi pharmacy items — the 9 steepest discounts on the site are all Nahdi.
  const featuredDiscounts = capPerRetailer(foodFirst(topDiscounts), 2, 4)

  return {
    supermarkets: visibleSupermarkets,
    latestProducts,
    topDiscounts: featuredDiscounts,
    categories,
    totalProducts,
    // The stat bar used to read `supermarket.count({ isActive: true })` = 25,
    // counting BOTH countries and every empty store, while the grid beneath it
    // showed 8. Report what the site actually surfaces for this market.
    totalStores: supermarkets.length,
    endingSoon,
  }
}, ['home-data'], { revalidate: TTL_LISTING, tags: ['offers'] })

export default async function HomePage() {
  const { supermarkets, latestProducts, topDiscounts, categories, totalProducts, totalStores, endingSoon } = await getHomeData()
  const lang = getLang()
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'SmartCopons',
    url: 'https://sa.smartcopons.com',
    description: 'عروض السوبرماركت وكوبونات الخصم في السعودية',
    inLanguage: 'ar',
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={dirOf(lang)}>
      <Header />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main>
        {/* Brand Banner with Stats */}
        <div className="bg-gradient-to-l from-pink-600 to-pink-700 text-white py-4">
          <div className="container mx-auto px-4">
            <div className="text-center mb-2">
              <span className="text-sm font-medium opacity-90">
                {t('home.banner')}
              </span>
            </div>
            <div className="flex justify-center gap-6 sm:gap-10">
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold">{totalProducts.toLocaleString('en')}+</div>
                <div className="text-[10px] sm:text-xs opacity-80">{t('home.stat.offers')}</div>
              </div>
              <div className="w-px bg-white/20" />
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold">{totalStores}</div>
                <div className="text-[10px] sm:text-xs opacity-80">{t('home.stat.stores')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Retailers Section */}
        {supermarkets.length > 0 && (
          <section className="container mx-auto px-4 mt-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">{t('home.section.stores')}</h2>
                <Link href="/supermarkets" className="text-pink-600 hover:text-pink-700 text-sm font-semibold">
                  {t('common.viewAll')}
                </Link>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                  {supermarkets.map(sm => (
                    <Link
                      key={sm.id}
                      href={`/offers/${sm.slug}`}
                      className="group text-center p-3 rounded-lg border border-gray-100 hover:border-pink-200 hover:shadow-md transition-all"
                    >
                      <div className="w-14 h-14 mx-auto mb-2 bg-gray-50 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform overflow-hidden">
                        {sm.logo ? (
                          <img src={sm.logo} alt={sm.nameAr} className="w-10 h-10 object-contain" />
                        ) : (
                          <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-gray-700 line-clamp-1 block">{sm.nameAr}</span>
                      {sm.activeOffers > 0 && (
                        <span className="text-[10px] text-pink-600 font-medium">{sm.activeOffers} {t('common.offer')}</span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Categories Section */}
        {categories.length > 0 && (
          <section className="container mx-auto px-4 mt-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">{t('home.section.categories')}</h2>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                  {categories.map(cat => (
                    <Link
                      key={cat.id}
                      href={`/offers?category=${cat.slug}`}
                      className="group text-center p-3 rounded-lg bg-gray-50 hover:bg-pink-50 border border-transparent hover:border-pink-200 transition-all"
                    >
                      <div className="text-2xl mb-1.5">{cat.icon || '📦'}</div>
                      <span className="text-xs font-semibold text-gray-700 group-hover:text-pink-700 line-clamp-1 block">
                        {cat.nameAr}
                      </span>
                      {cat._count.products > 0 && (
                        <span className="text-[10px] text-gray-400">{cat._count.products} {t('common.offer')}</span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Ending soon — creates urgency, and puts the freshest expiry data up top */}
        {endingSoon.length > 0 && (
          <section className="container mx-auto px-4 mt-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-orange-500 rounded-full" />
                <span className="text-xl">⏰</span>
                <h2 className="text-lg font-bold text-gray-900">{t('home.section.endingSoon')}</h2>
                <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">
                  {t('home.section.within3')}
                </span>
              </div>
              <Link href="/offers?sort=ending" className="text-pink-600 hover:text-pink-700 text-sm font-semibold">
                {t('common.viewMore')}
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {endingSoon.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* Top Discounts */}
        {topDiscounts.length > 0 && (
          <section className="container mx-auto px-4 mt-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-pink-600 rounded-full" />
                <h2 className="text-lg font-bold text-gray-900">{t('home.section.topDiscounts')}</h2>
              </div>
              <Link href="/offers?sort=discount" className="text-pink-600 hover:text-pink-700 text-sm font-semibold">
                {t('common.viewMore')}
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {topDiscounts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* The "الأكثر مشاهدة" section was removed here.
            `ProductOffer.viewCount` never measured views: it was incremented by
            /api/offers for every row returned in a LISTING, so it recorded how
            often a row appeared in a result set — a function of sort order and
            pagination, self-reinforcing, and never incremented by /product/[id]
            where a real view happens. That write was removed for cost reasons, so
            the column now holds frozen values produced by the discredited metric.
            Rendering them would be a section that looks fixed and is not.
            Restoring a genuine signal needs a client beacon plus batched writes
            (i.e. an external counter store); until that exists there is no honest
            "most viewed". "Ending soon", "top discounts" and "latest" already
            cover this slot. */}

        {/* Section Divider */}
        <div className="container mx-auto px-4 mt-8">
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">{t('home.divider')}</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        </div>

        {/* Latest Products */}
        {latestProducts.length > 0 && (
          <section className="container mx-auto px-4 mt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-pink-600 rounded-full" />
                <h2 className="text-lg font-bold text-gray-900">{t('home.section.latest')}</h2>
              </div>
              <Link href="/offers" className="text-pink-600 hover:text-pink-700 text-sm font-semibold">
                {t('common.viewAll')}
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {latestProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* SEO Content */}
        <section className="container mx-auto px-4 mt-12 mb-8">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 md:p-8 text-gray-600 leading-relaxed">
            <h2 className="text-lg font-bold text-gray-900 mb-3">{t('home.seo.title')}</h2>
            <p className="mb-3 text-sm">{t('home.seo.p1')}</p>
            <p className="text-sm">{t('home.seo.p2')}</p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
