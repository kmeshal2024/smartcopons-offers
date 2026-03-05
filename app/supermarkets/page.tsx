import { prisma } from '@/lib/db'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'عروض السوبرماركت في السعودية | SmartCopons',
  description: 'تصفح عروض وخصومات جميع السوبرماركت في السعودية - بنده، كارفور، لولو، الدانوب وغيرها. عروض يومية وأسبوعية محدثة.',
  keywords: 'عروض بنده, عروض كارفور, عروض لولو, عروض الدانوب, عروض السوبرماركت السعودية, خصومات',
}

export const revalidate = 60

async function getSupermarkets() {
  return prisma.supermarket.findMany({
    where: { isActive: true },
    include: {
      _count: {
        select: {
          flyers: {
            where: { status: 'ACTIVE', endDate: { gte: new Date() } },
          },
          productOffers: {
            where: { isHidden: false },
          },
        },
      },
    },
    orderBy: { viewCount: 'desc' },
  })
}

export default async function SupermarketsPage() {
  const supermarkets = await getSupermarkets()

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            المتاجر في السعودية
          </h1>
          <p className="text-gray-500 text-sm">
            اختر المتجر لتصفح أحدث العروض والخصومات
          </p>
        </div>

        {/* Supermarkets Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {supermarkets.map(sm => (
            <Link
              key={sm.id}
              href={`/offers/retailer/${sm.slug}`}
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
                    {sm._count.flyers} نشرة
                  </span>
                )}
                {sm._count.productOffers > 0 && (
                  <span className="bg-green-50 text-green-600 px-2.5 py-1 rounded-full font-semibold">
                    {sm._count.productOffers} عرض
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
            <p className="text-gray-500 text-lg">لا توجد متاجر حالياً</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
