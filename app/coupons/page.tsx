import { prisma } from '@/lib/db'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import CouponsClient from './CouponsClient'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'كوبونات الخصم والعروض',
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
      select: {
        id: true,
        name: true,
        slug: true,
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

        {/* Client component handles filtering */}
        <CouponsClient coupons={coupons as any} stores={stores as any} />

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
