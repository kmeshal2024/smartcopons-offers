import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import CouponCard from '@/components/CouponCard'
import { getCouponsData } from '@/lib/coupons'
import { COUNTRIES, urlFor } from '@/lib/countries'

/**
 * UAE coupons.
 *
 * Most coupon stores are GCC-wide, so the same codes serve both markets;
 * `stores.countries` is the comma list that decides which appear where, and it
 * can be pruned per store later without touching this page.
 */
const COUNTRY = COUNTRIES.AE

export const metadata: Metadata = {
  title: 'كوبونات وأكواد خصم الإمارات | سمارت كوبونز',
  description:
    'أحدث كوبونات الخصم وأكواد الخصم الفعّالة في الإمارات — نون، نمشي، سنتربوينت، أمازون وغيرها.',
  keywords: 'كوبونات الامارات, اكواد خصم الامارات, كوبون نون الامارات, كوبون نمشي, خصومات دبي',
  alternates: { canonical: urlFor('AE', '/coupons') },
  openGraph: {
    title: 'كوبونات وأكواد خصم الإمارات',
    description: 'أكواد خصم فعّالة لأشهر المتاجر في الإمارات',
    locale: 'ar_AE',
    type: 'website',
    url: urlFor('AE', '/coupons'),
  },
}

export const dynamic = 'force-dynamic'

export default async function UaeCouponsPage() {
  const { coupons } = await getCouponsData(COUNTRY.code)

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-extrabold text-gray-900">كوبونات الخصم في الإمارات</h1>
          <p className="mt-1 text-sm text-gray-500">
            {coupons.length.toLocaleString('en')} كوبون فعّال — انسخ الكود واستخدمه عند الدفع
          </p>
        </header>

        {coupons.length === 0 ? (
          <p className="rounded-xl border border-gray-100 bg-white py-14 text-center text-gray-500">
            لا توجد كوبونات متاحة للإمارات حالياً.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {coupons.map(c => (
              <CouponCard
                key={c.id}
                id={c.id}
                title={c.title}
                code={c.code}
                discountText={c.discountText}
                storeName={c.store.name}
                storeSlug={c.store.slug}
                storeLogo={c.store.logo}
              />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
