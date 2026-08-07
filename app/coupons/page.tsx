import { prisma } from '@/lib/db'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import CouponCard from '@/components/CouponCard'
import Link from 'next/link'
import type { Metadata } from 'next'
import { COUPON_CATEGORIES } from '@/lib/coupon-categories'
import { DEFAULT_COUNTRY } from '@/lib/countries'
import { getCouponsData } from '@/lib/coupons'
import { getLang } from '@/lib/i18n-server'
import { t as translate, dirOf } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'كوبونات الخصم والعروض',
  description: 'أحدث كوبونات الخصم وأكواد الخصم في السعودية. وفر أكثر مع كوبونات نون، نمشي، أمازون وغيرها.',
  keywords: 'كوبونات خصم, أكواد خصم, كوبون نون, كوبون نمشي, كوبون أمازون, خصومات السعودية',
}

// Dynamic, not build-prerendered: the Neon DB auto-suspends and a build during
// a suspend can't reach it. Functions sit next to the DB in Frankfurt.
export const dynamic = 'force-dynamic'


export default async function CouponsPage() {
  const { coupons, stores } = await getCouponsData(DEFAULT_COUNTRY)
  const lang = getLang()
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: 'https://sa.smartcopons.com' },
          { '@type': 'ListItem', position: 2, name: 'كوبونات وخصومات', item: 'https://sa.smartcopons.com/coupons' },
        ],
      },
      {
        '@type': 'ItemList',
        name: 'كوبونات الخصم والعروض في السعودية',
        numberOfItems: coupons.length,
        // Cap the list — a few dozen describes the page without shipping a
        // 100-item blob into every response.
        itemListElement: coupons.slice(0, 40).map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Offer',
            name: c.title,
            url: `https://sa.smartcopons.com/coupon/${c.id}`,
            category: 'DiscountCoupon',
            seller: { '@type': 'Organization', name: c.store.name },
            availability: 'https://schema.org/InStock',
          },
        })),
      },
    ],
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={dirOf(lang)}>
      <Header />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="container mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-pink-600 transition">{t('nav.home')}</Link>
          <svg className="w-3 h-3 text-gray-400 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-gray-900 font-semibold">{t('home.section.coupons')}</span>
        </nav>

        {/* Page Header */}
        <div className="bg-gradient-to-l from-pink-600 to-pink-700 rounded-xl p-6 mb-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🎟️</span>
            <div>
              <h1 className="text-2xl font-bold">{t('coupons.title')}</h1>
              <p className="text-sm opacity-90 mt-1">{t('coupons.subtitle', { n: coupons.length })}</p>
            </div>
          </div>
        </div>

        {/* Category links — the SEO win: each targets a broad query like
            "كوبونات أزياء" that a flat coupon list can't rank for. */}
        <div className="mb-6">
          <h2 className="text-sm font-bold text-gray-800 mb-3">{t('coupons.browseCategory')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {COUPON_CATEGORIES.map(cat => (
              <Link
                key={cat.slug}
                href={`/coupons/category/${cat.slug}`}
                className="flex items-center gap-2 bg-white rounded-lg border border-gray-100 hover:border-pink-200 hover:shadow-sm transition px-3 py-2.5"
              >
                <span className="text-lg">{cat.icon}</span>
                <span className="text-xs font-semibold text-gray-700">{cat.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Store Filter Chips — each links to that store's own coupon page.
            They used to be inert <span>s: clicking a brand did nothing, which
            read as "the filter is broken". Linking is also better for SEO than
            client-side filtering — every store gets its own indexable URL. */}
        {stores.filter(s => s._count.coupons > 0).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="bg-pink-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold">
              {t('coupons.all', { n: coupons.length })}
            </span>
            {stores.filter(s => s._count.coupons > 0).map(store => (
              <Link
                key={store.id}
                href={`/store/${store.slug}`}
                className="bg-white text-gray-700 px-3 py-1.5 rounded-full text-xs font-medium border border-gray-200 hover:border-pink-300 hover:text-pink-600 transition"
              >
                {store.name} ({store._count.coupons})
              </Link>
            ))}
          </div>
        )}

        {/* Coupons Grid */}
        {coupons.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {coupons.map(coupon => (
              <CouponCard
                key={coupon.id}
                id={coupon.id}
                title={coupon.title}
                code={coupon.code}
                discountText={coupon.discountText}
                storeName={coupon.store.name}
                storeSlug={coupon.store.slug}
                storeLogo={coupon.store.logo}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <span className="text-5xl block mb-4">🎟️</span>
            <p className="text-gray-500 text-lg">{t('coupons.none')}</p>
            <p className="text-gray-400 text-sm mt-1">{t('coupons.followUs')}</p>
          </div>
        )}

        {/* SEO Content */}
        <section className="mt-10">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-gray-600 leading-relaxed">
            <h2 className="text-base font-bold text-gray-900 mb-2">{t('coupons.seoTitle')}</h2>
            <p className="text-sm">{t('coupons.seoP1')}</p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
