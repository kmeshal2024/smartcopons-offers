import { prisma } from '@/lib/db'
import Link from 'next/link'
import Header from '@/components/Header'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'عروض السوبرماركت في السعودية | SmartCopons',
  description: 'تصفح عروض وخصومات جميع السوبرماركت في السعودية - بنده، كارفور، لولو، الدانوب وغيرها. عروض يومية وأسبوعية محدثة.',
  keywords: 'عروض بنده, عروض كارفور, عروض لولو, عروض الدانوب, عروض السوبرماركت السعودية, خصومات',
}

export const revalidate = 60 // Cache for 60 seconds, ISR

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
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-red-50" dir="rtl">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-pink-600 to-red-600 bg-clip-text text-transparent mb-3">
            عروض السوبرماركت
          </h1>
          <p className="text-gray-600 text-lg">
            اختر المتجر لتصفح أحدث العروض والخصومات
          </p>
        </div>

        {/* Supermarkets Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {supermarkets.map(sm => (
            <Link
              key={sm.id}
              href={`/offers/retailer/${sm.slug}`}
              className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 p-6 text-center group"
            >
              {/* Logo Placeholder */}
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-pink-100 to-red-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                {sm.logo ? (
                  <img src={sm.logo} alt={sm.nameAr} className="w-14 h-14 object-contain" />
                ) : (
                  <span className="text-3xl">🏪</span>
                )}
              </div>

              {/* Name */}
              <h2 className="font-bold text-gray-800 text-lg mb-1">{sm.nameAr}</h2>
              <p className="text-gray-500 text-sm mb-3">{sm.name}</p>

              {/* Stats */}
              <div className="flex justify-center gap-4 text-xs text-gray-500">
                {sm._count.flyers > 0 && (
                  <span className="bg-pink-50 text-pink-600 px-2 py-1 rounded-full font-semibold">
                    {sm._count.flyers} نشرة
                  </span>
                )}
                {sm._count.productOffers > 0 && (
                  <span className="bg-green-50 text-green-600 px-2 py-1 rounded-full font-semibold">
                    {sm._count.productOffers} عرض
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>

        {supermarkets.length === 0 && (
          <div className="text-center py-20 bg-white rounded-2xl shadow">
            <div className="text-6xl mb-4">🏪</div>
            <p className="text-gray-500 text-xl">لا توجد متاجر حالياً</p>
          </div>
        )}
      </main>

      <footer className="bg-gradient-to-r from-pink-600 to-red-500 text-white mt-20 py-8 pb-20 md:pb-8">
        <div className="container mx-auto px-4 text-center">
          <p>SmartCopons {new Date().getFullYear()} - جميع الحقوق محفوظة</p>
        </div>
      </footer>
    </div>
  )
}
