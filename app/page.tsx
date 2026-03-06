import { prisma } from '@/lib/db'
import Link from 'next/link'
import Header from '@/components/Header'
import ProductCard from '@/components/ProductCard'
import Footer from '@/components/Footer'
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

export const revalidate = 60

async function getHomeData() {
  const [coupons, supermarkets, latestProducts, topDiscounts, mostViewed, categories, totalProducts, totalStores] = await Promise.all([
    prisma.coupon.findMany({
      where: { isActive: true },
      include: { store: { select: { name: true, slug: true, logo: true } } },
      orderBy: { createdAt: 'desc' },
      take: 8,
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
      take: 10,
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
    prisma.productOffer.findMany({
      where: { isHidden: false, viewCount: { gt: 0 } },
      include: {
        supermarket: { select: { nameAr: true, slug: true, logo: true } },
        category: { select: { nameAr: true, icon: true } },
      },
      orderBy: { viewCount: 'desc' },
      take: 5,
    }),
    prisma.category.findMany({
      where: { isActive: true, parentId: null },
      include: {
        _count: { select: { products: { where: { isHidden: false } } } },
      },
      orderBy: { order: 'asc' },
      take: 8,
    }),
    prisma.productOffer.count({ where: { isHidden: false } }),
    prisma.supermarket.count({ where: { isActive: true } }),
  ])

  return { coupons, supermarkets, latestProducts, topDiscounts, mostViewed, categories, totalProducts, totalStores }
}

export default async function HomePage() {
  const { coupons, supermarkets, latestProducts, topDiscounts, mostViewed, categories, totalProducts, totalStores } = await getHomeData()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'SmartCopons',
    url: 'https://sa.smartcopons.com',
    description: 'عروض السوبرماركت وكوبونات الخصم في السعودية',
    inLanguage: 'ar',
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main>
        {/* Brand Banner with Stats */}
        <div className="bg-gradient-to-l from-pink-600 to-pink-700 text-white py-4">
          <div className="container mx-auto px-4">
            <div className="text-center mb-2">
              <span className="text-sm font-medium opacity-90">
                اكتشف أفضل عروض وخصومات السوبرماركت في السعودية
              </span>
            </div>
            <div className="flex justify-center gap-6 sm:gap-10">
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold">{totalProducts.toLocaleString()}+</div>
                <div className="text-[10px] sm:text-xs opacity-80">عرض متوفر</div>
              </div>
              <div className="w-px bg-white/20" />
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold">{totalStores}</div>
                <div className="text-[10px] sm:text-xs opacity-80">متجر</div>
              </div>
              <div className="w-px bg-white/20" />
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold">{coupons.length}</div>
                <div className="text-[10px] sm:text-xs opacity-80">كوبون خصم</div>
              </div>
            </div>
          </div>
        </div>

        {/* Retailers Section */}
        {supermarkets.length > 0 && (
          <section className="container mx-auto px-4 mt-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">المتاجر</h2>
                <Link href="/supermarkets" className="text-pink-600 hover:text-pink-700 text-sm font-semibold">
                  عرض الكل
                </Link>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                  {supermarkets.map(sm => (
                    <Link
                      key={sm.id}
                      href={`/offers/retailer/${sm.slug}`}
                      className="group text-center p-3 rounded-lg border border-gray-100 hover:border-pink-200 hover:shadow-md transition-all"
                    >
                      <div className="w-14 h-14 mx-auto mb-2 bg-gray-50 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform overflow-hidden">
                        {sm.logo ? (
                          <img src={sm.logo} alt={sm.nameAr} className="w-10 h-10 object-contain" />
                        ) : (
                          <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-gray-700 line-clamp-1 block">{sm.nameAr}</span>
                      {sm._count.productOffers > 0 && (
                        <span className="text-[10px] text-pink-600 font-medium">{sm._count.productOffers} عرض</span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ===== COUPONS & DEALS Section (ClicFlyer style - prominent) ===== */}
        {coupons.length > 0 && (
          <section className="container mx-auto px-4 mt-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎟️</span>
                  <h2 className="font-bold text-gray-900">كوبونات وخصومات</h2>
                  <span className="bg-pink-100 text-pink-700 text-[10px] font-bold px-2 py-0.5 rounded-full">COUPONS &amp; DEALS</span>
                </div>
                <Link href="/coupons" className="text-pink-600 hover:text-pink-700 text-sm font-semibold">
                  عرض الكل
                </Link>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {coupons.slice(0, 4).map(coupon => (
                    <div key={coupon.id} className="bg-gradient-to-br from-pink-50 to-white rounded-lg border border-pink-100 p-4 relative overflow-hidden group hover:shadow-md transition-all">
                      {/* Decorative corner */}
                      <div className="absolute top-0 left-0 w-16 h-16 bg-pink-100/50 rounded-br-full" />

                      {/* Store name */}
                      <div className="relative flex items-center gap-2 mb-2">
                        {coupon.store.logo ? (
                          <img src={coupon.store.logo} alt={coupon.store.name} className="w-5 h-5 rounded object-contain" />
                        ) : null}
                        <span className="text-[11px] font-semibold text-pink-700">{coupon.store.name}</span>
                      </div>

                      {/* Discount text */}
                      <div className="relative text-xl font-black text-gray-900 mb-1">{coupon.discountText}</div>

                      {/* Title */}
                      <p className="relative text-xs text-gray-500 mb-3 line-clamp-1">{coupon.title}</p>

                      {/* Code + Copy */}
                      <div className="relative flex gap-2">
                        <div className="flex-1 bg-white border border-dashed border-pink-300 rounded-md px-2 py-1.5 font-mono text-xs font-bold text-center text-pink-700 truncate">
                          {coupon.code}
                        </div>
                        <button
                          className="coupon-copy-btn bg-pink-600 text-white px-3 py-1.5 rounded-md text-xs font-bold hover:bg-pink-700 transition active:scale-95 whitespace-nowrap"
                          data-code={coupon.code}
                        >
                          نسخ الكود
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Show more coupons as smaller chips if we have more than 4 */}
                {coupons.length > 4 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {coupons.slice(4).map(coupon => (
                      <div key={coupon.id} className="inline-flex items-center gap-2 bg-gray-50 rounded-full px-3 py-1.5 border border-gray-100 hover:border-pink-200 transition">
                        <span className="text-[10px] text-gray-500">{coupon.store.name}</span>
                        <span className="font-mono text-xs font-bold text-pink-700">{coupon.code}</span>
                        <span className="text-[10px] text-pink-600 font-semibold">{coupon.discountText}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Categories Section + Coupons & Deals link */}
        {categories.length > 0 && (
          <section className="container mx-auto px-4 mt-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">التصنيفات</h2>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                  {/* Coupons & Deals category card - first item like ClicFlyer */}
                  <Link
                    href="/coupons"
                    className="group text-center p-3 rounded-lg bg-pink-50 hover:bg-pink-100 border border-pink-200 hover:border-pink-300 transition-all"
                  >
                    <div className="text-2xl mb-1.5">🎟️</div>
                    <span className="text-xs font-bold text-pink-700 block">كوبونات وخصومات</span>
                    <span className="text-[10px] text-pink-500">{coupons.length} كوبون</span>
                  </Link>

                  {categories.map(cat => (
                    <Link
                      key={cat.id}
                      href={`/offers?category=${cat.slug}`}
                      className="group text-center p-3 rounded-lg bg-gray-50 hover:bg-pink-50 border border-transparent hover:border-pink-200 transition-all"
                    >
                      <div className="text-2xl mb-1.5">{cat.icon || '📦'}</div>
                      <span className="text-xs font-semibold text-gray-700 group-hover:text-pink-700 line-clamp-1 block">
                        {cat.nameAr}
                      </span>
                      {cat._count.products > 0 && (
                        <span className="text-[10px] text-gray-400">{cat._count.products} عرض</span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Top Discounts */}
        {topDiscounts.length > 0 && (
          <section className="container mx-auto px-4 mt-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-pink-600 rounded-full" />
                <h2 className="text-lg font-bold text-gray-900">أكبر الخصومات</h2>
              </div>
              <Link href="/offers?sort=discount" className="text-pink-600 hover:text-pink-700 text-sm font-semibold">
                عرض المزيد
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {topDiscounts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* Most Viewed Products */}
        {mostViewed.length > 0 && (
          <section className="container mx-auto px-4 mt-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-orange-500 rounded-full" />
                <h2 className="text-lg font-bold text-gray-900">الأكثر مشاهدة</h2>
                <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">TRENDING</span>
              </div>
              <Link href="/offers?sort=popular" className="text-pink-600 hover:text-pink-700 text-sm font-semibold">
                عرض المزيد
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {mostViewed.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* Section Divider */}
        <div className="container mx-auto px-4 mt-8">
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">KSA OFFERS</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        </div>

        {/* Latest Products */}
        {latestProducts.length > 0 && (
          <section className="container mx-auto px-4 mt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-pink-600 rounded-full" />
                <h2 className="text-lg font-bold text-gray-900">أحدث العروض</h2>
              </div>
              <Link href="/offers" className="text-pink-600 hover:text-pink-700 text-sm font-semibold">
                عرض الكل
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {latestProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* SEO Content */}
        <section className="container mx-auto px-4 mt-12 mb-8">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 md:p-8 text-gray-600 leading-relaxed">
            <h2 className="text-lg font-bold text-gray-900 mb-3">عروض السوبرماركت في السعودية</h2>
            <p className="mb-3 text-sm">
              موقع SmartCopons يقدم لك أحدث عروض وخصومات السوبرماركت في المملكة العربية السعودية.
              تصفح عروض بنده، كارفور، لولو هايبرماركت، الدانوب وغيرها من المتاجر الكبرى.
            </p>
            <p className="text-sm">
              نحدث العروض يوميا لنوفر لك أفضل الأسعار على المنتجات الغذائية، المنظفات،
              الإلكترونيات وكل ما تحتاجه لمنزلك. وفر أكثر مع كوبونات الخصم الحصرية.
            </p>
          </div>
        </section>
      </main>

      {/* Coupon copy script */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.addEventListener('click',function(e){var btn=e.target.closest('.coupon-copy-btn');if(btn){var code=btn.getAttribute('data-code');navigator.clipboard.writeText(code).then(function(){var orig=btn.textContent;btn.textContent='\\u2713 \\u062A\\u0645!';btn.style.backgroundColor='#16a34a';setTimeout(function(){btn.textContent=orig;btn.style.backgroundColor='';},2000);});}});`,
        }}
      />

      <Footer />
    </div>
  )
}
