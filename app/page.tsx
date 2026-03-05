import { prisma } from '@/lib/db'
import Link from 'next/link'
import Header from '@/components/Header'
import CouponCard from '@/components/CouponCard'
import ProductCard from '@/components/ProductCard'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SmartCopons | عروض وكوبونات السوبرماركت في السعودية',
  description: 'اكتشف أحدث عروض السوبرماركت وكوبونات الخصم في السعودية. عروض بنده، كارفور، لولو، الدانوب وأكثر. وفر أكثر مع SmartCopons.',
  keywords: 'عروض السوبرماركت, كوبونات خصم, عروض بنده, عروض كارفور, عروض لولو, عروض الدانوب, خصومات السعودية',
  openGraph: {
    title: 'SmartCopons - عروض السوبرماركت في السعودية',
    description: 'أحدث عروض السوبرماركت وكوبونات الخصم',
    locale: 'ar_SA',
    type: 'website',
  },
}

export const revalidate = 60 // Cache for 60 seconds, ISR

async function getHomeData() {
  const [coupons, supermarkets, latestProducts, topDiscounts] = await Promise.all([
    prisma.coupon.findMany({
      where: { isActive: true },
      include: { store: { select: { name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    prisma.supermarket.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            productOffers: { where: { isHidden: false } },
            flyers: { where: { status: 'ACTIVE', endDate: { gte: new Date() } } },
          },
        },
      },
      orderBy: { viewCount: 'desc' },
      take: 8,
    }),
    prisma.productOffer.findMany({
      where: { isHidden: false },
      include: {
        supermarket: { select: { nameAr: true, slug: true, logo: true } },
        category: { select: { nameAr: true, icon: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.productOffer.findMany({
      where: { isHidden: false, discountPercent: { gt: 0 } },
      include: {
        supermarket: { select: { nameAr: true, slug: true, logo: true } },
        category: { select: { nameAr: true, icon: true } },
      },
      orderBy: { discountPercent: 'desc' },
      take: 4,
    }),
  ])

  return { coupons, supermarkets, latestProducts, topDiscounts }
}

export default async function HomePage() {
  const { coupons, supermarkets, latestProducts, topDiscounts } = await getHomeData()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'SmartCopons',
    url: 'https://sa.smartcopons.com',
    description: 'عروض السوبرماركت وكوبونات الخصم في السعودية',
    inLanguage: 'ar',
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-red-50" dir="rtl">
      <Header />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main>
        {/* Hero Section */}
        <section className="bg-gradient-to-r from-pink-600 to-red-500 text-white py-12 md:py-16">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-extrabold mb-4 leading-tight">
              عروض وخصومات
              <br />
              <span className="text-pink-200">السوبرماركت في السعودية</span>
            </h1>
            <p className="text-lg md:text-xl text-pink-100 mb-8 max-w-2xl mx-auto">
              اكتشف أحدث العروض من بنده، كارفور، لولو، الدانوب وغيرها. وفر أكثر كل يوم.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/offers"
                className="bg-white text-pink-600 px-8 py-4 rounded-full font-bold text-lg hover:bg-pink-50 transition shadow-lg"
              >
                تصفح العروض
              </Link>
              <Link
                href="/supermarkets"
                className="border-2 border-white text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-white/10 transition"
              >
                المتاجر
              </Link>
            </div>
          </div>
        </section>

        {/* Supermarkets Strip */}
        {supermarkets.length > 0 && (
          <section className="container mx-auto px-4 -mt-8 relative z-10">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-xl text-gray-800">المتاجر</h2>
                <Link href="/supermarkets" className="text-pink-600 hover:underline text-sm font-semibold">
                  عرض الكل
                </Link>
              </div>
              <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                {supermarkets.map(sm => (
                  <Link
                    key={sm.id}
                    href={`/offers/retailer/${sm.slug}`}
                    className="text-center group"
                  >
                    <div className="w-14 h-14 mx-auto mb-2 bg-gradient-to-br from-pink-50 to-red-50 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      {sm.logo ? (
                        <img src={sm.logo} alt={sm.nameAr} className="w-10 h-10 object-contain" />
                      ) : (
                        <span className="text-2xl">🏪</span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-gray-700 line-clamp-1">{sm.nameAr}</span>
                    {sm._count.productOffers > 0 && (
                      <span className="text-[10px] text-pink-500">{sm._count.productOffers} عرض</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Top Discounts */}
        {topDiscounts.length > 0 && (
          <section className="container mx-auto px-4 mt-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-bold text-gray-800">
                <span className="text-pink-600">اكبر</span> الخصومات
              </h2>
              <Link href="/offers?sort=discount" className="text-pink-600 hover:underline text-sm font-semibold">
                عرض المزيد
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {topDiscounts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* Latest Products */}
        {latestProducts.length > 0 && (
          <section className="container mx-auto px-4 mt-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-bold text-gray-800">
                <span className="text-pink-600">أحدث</span> العروض
              </h2>
              <Link href="/offers" className="text-pink-600 hover:underline text-sm font-semibold">
                عرض الكل
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {latestProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* Coupons Section */}
        {coupons.length > 0 && (
          <section className="container mx-auto px-4 mt-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-bold text-gray-800">
                <span className="text-pink-600">كوبونات</span> الخصم
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          </section>
        )}

        {/* SEO Content */}
        <section className="container mx-auto px-4 mt-16 mb-10">
          <div className="bg-white rounded-2xl shadow p-8 text-gray-700 leading-relaxed">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">عروض السوبرماركت في السعودية</h2>
            <p className="mb-3">
              موقع SmartCopons يقدم لك أحدث عروض وخصومات السوبرماركت في المملكة العربية السعودية.
              تصفح عروض بنده، كارفور، لولو هايبرماركت، الدانوب وغيرها من المتاجر الكبرى.
            </p>
            <p>
              نحدث العروض يوميا لنوفر لك أفضل الأسعار على المنتجات الغذائية، المنظفات،
              الإلكترونيات وكل ما تحتاجه لمنزلك. وفر أكثر مع كوبونات الخصم الحصرية.
            </p>
          </div>
        </section>
      </main>

      <footer className="bg-gradient-to-r from-pink-600 to-red-500 text-white py-10 pb-24 md:pb-10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-bold text-lg mb-3">SmartCopons</h3>
              <p className="text-pink-100 text-sm">
                أفضل عروض السوبرماركت وكوبونات الخصم في السعودية
              </p>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-3">روابط سريعة</h3>
              <div className="space-y-2 text-sm text-pink-100">
                <Link href="/offers" className="block hover:text-white">العروض</Link>
                <Link href="/supermarkets" className="block hover:text-white">المتاجر</Link>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-3">المتاجر</h3>
              <div className="space-y-2 text-sm text-pink-100">
                {supermarkets.slice(0, 4).map(sm => (
                  <Link key={sm.id} href={`/offers/retailer/${sm.slug}`} className="block hover:text-white">
                    عروض {sm.nameAr}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <div className="border-t border-white/20 mt-8 pt-6 text-center text-sm text-pink-100">
            SmartCopons {new Date().getFullYear()} - جميع الحقوق محفوظة
          </div>
        </div>
      </footer>
    </div>
  )
}
