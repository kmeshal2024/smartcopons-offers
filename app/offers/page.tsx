import { Suspense } from 'react'
import { prisma } from '@/lib/db'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ProductCard from '@/components/ProductCard'
import OffersClient from './OffersClient'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'أفضل عروض السوبرماركت اليوم في السعودية (خصومات تصل إلى 80%)',
  description: 'اكتشف أقوى عروض بنده وكارفور اليوم في السعودية. خصومات حقيقية يومية تصل إلى 80% على المواد الغذائية والمنتجات.',
  keywords: 'عروض اليوم, عروض السوبرماركت, خصومات, عروض بنده اليوم, عروض كارفور اليوم, عروض الدانوب, عروض التميمي, عروض لولو',
  openGraph: {
    title: 'أفضل عروض السوبرماركت اليوم في السعودية (خصومات تصل إلى 80%)',
    description: 'اكتشف أقوى عروض بنده وكارفور اليوم في السعودية. خصومات حقيقية يومية تصل إلى 80% على المواد الغذائية والمنتجات.',
    locale: 'ar_SA',
    type: 'website',
  },
}

export const revalidate = 60

// Quality filter baseline — shared across all queries
const qualityWhere = {
  isHidden: false,
  price: { gt: 0 },
  discountPercent: { gte: 5 },
  imageUrl: { not: null },
}

// Fetch top discounts (>= 50%) for the discovery hero section
async function getTopDiscounts() {
  return prisma.productOffer.findMany({
    where: {
      ...qualityWhere,
      discountPercent: { gte: 50 },
    },
    include: {
      supermarket: { select: { nameAr: true, slug: true, logo: true } },
    },
    orderBy: { discountPercent: 'desc' },
    take: 8,
  })
}

// Fetch best deals (>= 20%) for SSR section
async function getBestDeals() {
  return prisma.productOffer.findMany({
    where: {
      ...qualityWhere,
      discountPercent: { gte: 20 },
    },
    include: {
      supermarket: { select: { nameAr: true, slug: true, logo: true } },
      category: { select: { nameAr: true, icon: true } },
    },
    orderBy: { discountPercent: 'desc' },
    take: 8,
  })
}

// Fetch supermarkets with quality offer counts for the store strip
async function getActiveStores() {
  return prisma.supermarket.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      nameAr: true,
      slug: true,
      logo: true,
      _count: {
        select: {
          productOffers: {
            where: qualityWhere,
          },
        },
      },
    },
    orderBy: { viewCount: 'desc' },
  })
}

// SSR fallback: pre-render latest products for instant FCP + SEO
async function getInitialProducts() {
  const [products, total] = await Promise.all([
    prisma.productOffer.findMany({
      where: qualityWhere,
      include: {
        supermarket: { select: { nameAr: true, slug: true, logo: true } },
        category: { select: { nameAr: true, icon: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 24,
    }),
    prisma.productOffer.count({ where: qualityWhere }),
  ])
  return { products, total }
}

// --- Phase 2: Top Discounts Discovery (horizontal scroll, >= 50%) ---
function TopDiscountsSection({ deals }: { deals: any[] }) {
  if (deals.length === 0) return null

  return (
    <section className="mb-6">
      <div className="bg-gradient-to-l from-red-50 via-orange-50 to-yellow-50 rounded-xl border border-red-100 p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🔥</span>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">أقوى خصومات اليوم</h2>
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
          {deals.map(product => {
            const displayName = product.nameAr || product.nameEn || 'منتج'
            return (
              <div
                key={product.id}
                className="flex-shrink-0 w-44 sm:w-52 bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="relative h-40 sm:h-48 bg-gray-50 flex items-center justify-center">
                  {product.imageUrl && (
                    <Image
                      src={product.imageUrl}
                      alt={displayName}
                      fill
                      className="object-contain p-3"
                      sizes="(max-width: 640px) 176px, 208px"
                    />
                  )}
                  <div className="absolute top-2 right-2 bg-red-600 text-white px-2.5 py-1 rounded-lg text-sm font-bold shadow-md">
                    🔥 {product.discountPercent}%-
                  </div>
                  {product.supermarket.logo && (
                    <div className="absolute bottom-2 right-2 w-7 h-7 bg-white rounded-full shadow-sm flex items-center justify-center overflow-hidden border border-gray-100">
                      <img src={product.supermarket.logo} alt={product.supermarket.nameAr} className="w-5 h-5 object-contain" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <Link
                    href={`/offers/retailer/${product.supermarket.slug}`}
                    className="text-[10px] text-gray-400 hover:text-pink-600 transition-colors font-medium"
                  >
                    {product.supermarket.nameAr}
                  </Link>
                  <h3 className="text-xs sm:text-sm font-semibold text-gray-800 line-clamp-2 mt-0.5 mb-2 min-h-[2rem] leading-snug">
                    {displayName}
                  </h3>
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-base sm:text-lg font-bold text-red-600">
                      {product.price.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-gray-400">ر.س</span>
                    {product.oldPrice && product.oldPrice > product.price && (
                      <span className="text-[10px] text-gray-400 line-through mr-auto">
                        {product.oldPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// --- Phase 3: Best Deals (>= 20%, with last-updated label) ---
function BestDealsSection({ deals }: { deals: any[] }) {
  if (deals.length === 0) return null

  return (
    <section className="mb-6">
      <div className="bg-gradient-to-l from-pink-50 to-white rounded-xl border border-pink-100 p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">🔥</span>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">أفضل عروض الأسبوع</h2>
          <span className="text-xs bg-pink-600 text-white px-2 py-0.5 rounded-full font-bold">
            خصم حتى {deals[0]?.discountPercent || 0}%
          </span>
        </div>
        <p className="text-[11px] text-gray-400 mb-4 mr-7">آخر تحديث: اليوم</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {deals.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  )
}

// --- Phase 4: Store strip — only stores with offers > 0 ---
function StoreStrip({ stores }: { stores: any[] }) {
  const activeStores = stores.filter(s => s._count.productOffers > 0)
  if (activeStores.length === 0) return null

  return (
    <section className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-5 bg-pink-600 rounded-full" />
        <h2 className="font-bold text-gray-900 text-sm">تسوق حسب المتجر</h2>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {activeStores.map(store => (
          <Link
            key={store.id}
            href={`/offers/${store.slug}`}
            className="flex-shrink-0 bg-white rounded-xl border border-gray-100 hover:border-pink-200 hover:shadow-sm transition-all px-4 py-3 flex items-center gap-3 min-w-[160px]"
          >
            <div className="w-9 h-9 bg-gray-50 rounded-full flex items-center justify-center overflow-hidden border border-gray-100">
              {store.logo ? (
                <Image src={store.logo} alt={store.nameAr} width={24} height={24} className="object-contain" />
              ) : (
                <span className="text-lg">🏪</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-gray-800 text-sm truncate">{store.nameAr}</div>
              <div className="text-[10px] text-gray-400">{store._count.productOffers} عرض</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

// --- Phase 5: JSON-LD structured data ---
function OffersJsonLd({ deals }: { deals: any[] }) {
  if (deals.length === 0) return null

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'أفضل عروض السوبرماركت اليوم في السعودية',
    numberOfItems: deals.length,
    itemListElement: deals.slice(0, 10).map((product: any, index: number) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        name: product.nameAr || product.nameEn || 'منتج',
        ...(product.imageUrl ? { image: product.imageUrl } : {}),
        offers: {
          '@type': 'Offer',
          price: product.price,
          priceCurrency: 'SAR',
          availability: 'https://schema.org/InStock',
        },
      },
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

function SSRFallback({ products, total, bestDeals, topDiscounts, stores }: {
  products: any[]
  total: number
  bestDeals: any[]
  topDiscounts: any[]
  stores: any[]
}) {
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header />
      <OffersJsonLd deals={[...topDiscounts, ...bestDeals]} />
      <main className="container mx-auto px-4 py-5">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">عروض السوبرماركت</h1>
        <p className="text-sm text-gray-500 mb-5">{total} عرض متوفر</p>

        <TopDiscountsSection deals={topDiscounts} />
        <StoreStrip stores={stores} />
        <BestDealsSection deals={bestDeals} />

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {/* Loading indicator for when filters hydrate */}
        <div className="text-center py-8 text-gray-400 text-sm animate-pulse">
          جاري تحميل الفلاتر...
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default async function OffersPage() {
  const [{ products, total }, bestDeals, topDiscounts, stores] = await Promise.all([
    getInitialProducts(),
    getBestDeals(),
    getTopDiscounts(),
    getActiveStores(),
  ])

  return (
    <Suspense fallback={<SSRFallback products={products} total={total} bestDeals={bestDeals} topDiscounts={topDiscounts} stores={stores} />}>
      <OffersClient />
    </Suspense>
  )
}
