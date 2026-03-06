import { prisma } from '@/lib/db'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import CouponCard from '@/components/CouponCard'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'كوبونات الخصم والعروض | SmartCopons',
  description: 'أحدث كوبونات الخصم وأكواد الخصم في السعودية. وفر أكثر مع كوبونات نون، نمشي، أمازون وغيرها.',
  keywords: 'كوبونات خصم, أكواد خصم, كوبون نون, كوبون نمشي, كوبون أمازون, خصومات السعودية',
}

export const revalidate = 60

async function getCouponsData() {
  const [coupons, stores] = await Promise.all([
    prisma.coupon.findMany({
      where: { isActive: true },
      include: {
        store: { select: { name: true, slug: true, logo: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.store.findMany({
      include: {
        _count: { select: { coupons: { where: { isActive: true } } } },
      },
      orderBy: { name: 'asc' },
    }),
  ])

  return { coupons, stores }
}

export default async function CouponsPage() {
  const { coupons, stores } = await getCouponsData()

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header />

      <main className="container mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-pink-600 transition">الرئيسية</Link>
          <svg className="w-3 h-3 text-gray-400 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-gray-900 font-semibold">كوبونات وخصومات</span>
        </nav>

        {/* Page Header */}
        <div className="bg-gradient-to-l from-pink-600 to-pink-700 rounded-xl p-6 mb-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🎟️</span>
            <div>
              <h1 className="text-2xl font-bold">كوبونات الخصم والعروض</h1>
              <p className="text-sm opacity-90 mt-1">وفر أكثر مع أحدث أكواد الخصم — {coupons.length} كوبون متوفر</p>
            </div>
          </div>
        </div>

        {/* Store Filter Chips */}
        {stores.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="bg-pink-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold">
              الكل ({coupons.length})
            </span>
            {stores.filter(s => s._count.coupons > 0).map(store => (
              <span
                key={store.id}
                className="bg-white text-gray-700 px-3 py-1.5 rounded-full text-xs font-medium border border-gray-200 hover:border-pink-300 hover:text-pink-600 transition cursor-pointer"
              >
                {store.name} ({store._count.coupons})
              </span>
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
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <span className="text-5xl block mb-4">🎟️</span>
            <p className="text-gray-500 text-lg">لا توجد كوبونات حالياً</p>
            <p className="text-gray-400 text-sm mt-1">تابعنا للحصول على أحدث الكوبونات</p>
          </div>
        )}

        {/* SEO Content */}
        <section className="mt-10">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-gray-600 leading-relaxed">
            <h2 className="text-base font-bold text-gray-900 mb-2">كوبونات خصم السعودية</h2>
            <p className="text-sm">
              اكتشف أحدث كوبونات الخصم وأكواد التخفيض من أشهر المتاجر في السعودية.
              نوفر لك كوبونات نون، نمشي، أمازون وغيرها من المتاجر الإلكترونية.
              انسخ الكود واستخدمه عند الدفع للحصول على خصم فوري.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
