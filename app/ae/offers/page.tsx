import { Suspense } from 'react'
import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import OffersClient from '@/app/offers/OffersClient'
import { COUNTRIES, urlFor } from '@/lib/countries'

/**
 * UAE offers listing. Reuses the Saudi OffersClient — it takes a `country` and
 * threads it through every API call, so the two markets share one filter/search
 * UI rather than drifting apart as copies.
 */
const COUNTRY = COUNTRIES.AE

export const metadata: Metadata = {
  title: 'كل عروض السوبرماركت في الإمارات | سمارت كوبونز',
  description:
    'تصفّح كل عروض كارفور ولولو في الإمارات مع الفلترة حسب المتجر والفئة والسعر. أسعار بالدرهم محدّثة يومياً.',
  keywords: 'عروض الامارات اليوم, عروض كارفور الامارات, عروض لولو, تخفيضات الامارات',
  alternates: { canonical: urlFor('AE', '/offers') },
  openGraph: {
    title: 'كل عروض السوبرماركت في الإمارات',
    description: 'عروض كارفور ولولو في الإمارات، محدّثة يومياً',
    locale: 'ar_AE',
    type: 'website',
    url: urlFor('AE', '/offers'),
  },
}

export const dynamic = 'force-dynamic'

export default function UaeOffersPage() {
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header />
      <Suspense
        fallback={<div className="py-20 text-center text-gray-400">جارٍ التحميل…</div>}
      >
        <OffersClient country={COUNTRY.code} />
      </Suspense>
      <Footer />
    </div>
  )
}
