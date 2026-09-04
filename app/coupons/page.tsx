import Link from 'next/link'
import type { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import CouponsExplorer from '@/components/CouponsExplorer'
import BannerSlot from '@/components/BannerSlot'
import { DEFAULT_COUNTRY } from '@/lib/countries'
import { TTL_LISTING } from '@/lib/offer-queries'
import { getLang } from '@/lib/i18n-server'
import { t as translate, dirOf } from '@/lib/i18n'

/**
 * Restored 2026-08-18. The earlier retirement (23e0d05) removed this route
 * because 106 legacy third-party rows all carried url='#' and the surface
 * produced 4 clicks in three months. That schema is fixed now (affiliateUrl
 * CHECK constraint), and the page is re-published rendering only the owner's
 * curated set. Legacy rows stay isActive=false so they never surface.
 *
 * Deliberately minimal: store name, code, copy button. No article prose, no
 * detail pages, no category filter.
 */
export const metadata: Metadata = {
  title: 'كوبونات الخصم',
  description: 'أكواد خصم منتقاة من متاجر السعودية.',
  alternates: { canonical: 'https://sa.smartcopons.com/coupons' },
  openGraph: {
    title: 'كوبونات الخصم',
    description: 'أكواد خصم منتقاة من متاجر السعودية.',
    locale: 'ar_SA',
    type: 'website',
    url: 'https://sa.smartcopons.com/coupons',
  },
}

export const dynamic = 'force-dynamic'

const getCoupons = unstable_cache(
  async (country: string) =>
    prisma.coupon.findMany({
      where: {
        isActive: true,
        OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
        store: { countries: { contains: country } },
      },
      include: {
        store: { select: { name: true, slug: true, logo: true } },
      },
      orderBy: [{ isExclusive: 'desc' }, { createdAt: 'desc' }],
    }),
  ['coupons-page'],
  { revalidate: TTL_LISTING, tags: ['coupons'] }
)

export default async function CouponsPage() {
  const coupons = await getCoupons(DEFAULT_COUNTRY)
  const lang = getLang()
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'كوبونات الخصم',
    url: 'https://sa.smartcopons.com/coupons',
    numberOfItems: coupons.length,
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={dirOf(lang)}>
      <Header />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="container mx-auto px-4 py-6 pb-24">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🏷️</span>
            <h1 className="text-2xl font-bold text-gray-900">{t('couponsPage.title')}</h1>
          </div>
          <p className="text-sm text-gray-500">
            {t('couponsPage.subtitle', { n: coupons.length })}
          </p>
        </div>

        <BannerSlot placement="coupons" country={DEFAULT_COUNTRY} className="mb-6" />

        {coupons.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white p-10 text-center text-gray-400">
            <span className="mb-3 block text-5xl">🏷️</span>
            <p>{t('couponsPage.empty')}</p>
            <Link
              href="/"
              className="mt-4 inline-block text-sm font-semibold text-pink-600 hover:text-pink-700"
            >
              {t('couponsPage.browseOffers')}
            </Link>
          </div>
        ) : (
          <CouponsExplorer
            coupons={coupons.map(c => ({
              id: c.id,
              title: c.title,
              code: c.code,
              discountText: c.discountText,
              isExclusive: c.isExclusive,
              storeName: c.store.name,
              storeSlug: c.store.slug,
              storeLogo: c.store.logo,
            }))}
          />
        )}
      </main>

      <Footer />
    </div>
  )
}
