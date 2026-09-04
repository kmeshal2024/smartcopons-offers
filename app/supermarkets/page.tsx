import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import BannerSlot from '@/components/BannerSlot'
import { listVisibleRetailers } from '@/lib/offer-queries'
import type { Metadata } from 'next'
import { DEFAULT_COUNTRY } from '@/lib/countries'
import { getLang } from '@/lib/i18n-server'
import { t as translate, dirOf } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'عروض السوبرماركت في السعودية',
  description: 'تصفح عروض وخصومات جميع السوبرماركت في السعودية - بنده، كارفور، لولو، الدانوب وغيرها. عروض يومية وأسبوعية محدثة.',
  keywords: 'عروض بنده, عروض كارفور, عروض لولو, عروض الدانوب, عروض السوبرماركت السعودية, خصومات',
  alternates: { canonical: 'https://sa.smartcopons.com/supermarkets' },
  openGraph: {
    title: 'عروض السوبرماركت في السعودية',
    description: 'تصفح عروض وخصومات جميع السوبرماركت في السعودية',
    locale: 'ar_SA',
    type: 'website',
    url: 'https://sa.smartcopons.com/supermarkets',
  },
}

// Dynamic, not build-prerendered: the Neon DB auto-suspends and a build during
// a suspend can't reach it. Functions sit next to the DB in Frankfurt.
export const dynamic = 'force-dynamic'

// Uses the shared cached helper, so this directory, each retailer page's own
// noindex decision and sitemap-pages.xml all apply one definition of "has real
// content" — and none of them re-queries Postgres per view.
async function getSupermarkets() {
  const rows = await listVisibleRetailers(DEFAULT_COUNTRY)
  return rows.map(sm => ({
    ...sm,
    _count: { productOffers: sm.activeOffers, flyers: sm.activeFlyers },
  }))
}

export default async function SupermarketsPage() {
  const supermarkets = await getSupermarkets()
  const lang = getLang()
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars)

  return (
    <div className="min-h-screen bg-gray-50" dir={dirOf(lang)}>
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            {t('stores.title')}
          </h1>
          <p className="text-gray-500 text-sm">
            {t('stores.subtitle')}
          </p>
        </div>

        <BannerSlot placement="stores" country={DEFAULT_COUNTRY} className="mb-6" />

        {/* Supermarkets Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {supermarkets.map(sm => (
            <Link
              key={sm.id}
              href={`/offers/${sm.slug}`}
              className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-pink-200 transition-all duration-200 p-5 text-center group"
            >
              {/* Logo */}
              <div className="w-18 h-18 mx-auto mb-3 bg-gray-50 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform w-[72px] h-[72px]">
                {sm.logo ? (
                  <img src={sm.logo} alt={sm.nameAr} className="w-12 h-12 object-contain" />
                ) : (
                  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                )}
              </div>

              {/* Name */}
              <h2 className="font-bold text-gray-800 text-base mb-0.5">{sm.nameAr}</h2>
              <p className="text-gray-400 text-xs mb-3">{sm.name}</p>

              {/* Stats */}
              <div className="flex justify-center gap-2 text-xs">
                {sm._count.flyers > 0 && (
                  <span className="bg-pink-50 text-pink-600 px-2.5 py-1 rounded-full font-semibold">
                    {t('stores.flyers', { n: sm._count.flyers })}
                  </span>
                )}
                {sm._count.productOffers > 0 && (
                  <span className="bg-green-50 text-green-600 px-2.5 py-1 rounded-full font-semibold">
                    {sm._count.productOffers} {t('common.offer')}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>

        {supermarkets.length === 0 && (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-100 shadow-sm">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p className="text-gray-500 text-lg">{t('stores.none')}</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
