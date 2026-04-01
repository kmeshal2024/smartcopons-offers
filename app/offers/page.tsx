import { Suspense } from 'react'
import { prisma } from '@/lib/db'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ProductCard from '@/components/ProductCard'
import OffersClient from './OffersClient'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'عروض السوبرماركت اليوم في السعودية | SmartCopons',
  description: 'تصفح أحدث عروض السوبرماركت في السعودية. عروض الدانوب، بنده، كارفور، لولو، التميمي. أسعار مخفضة يومياً على المنتجات الغذائية والمنزلية.',
  keywords: 'عروض اليوم, عروض السوبرماركت, خصومات, عروض بنده اليوم, عروض كارفور اليوم, عروض الدانوب, عروض التميمي, عروض لولو',
  openGraph: {
    title: 'عروض السوبرماركت اليوم في السعودية',
    description: 'أفضل العروض والخصومات من السوبرماركت في السعودية',
    locale: 'ar_SA',
    type: 'website',
  },
}

export const revalidate = 60

// Fetch best deals (highest discounts) for SSR hero section
async function getBestDeals() {
  return prisma.productOffer.findMany({
    where: {
      isHidden: false,
      discountPercent: { gte: 10 },
      flyer: {
        status: 'ACTIVE',
        endDate: { gte: new Date() },
      },
    },
    include: {
      supermarket: { select: { nameAr: true, slug: true, logo: true } },
      category: { select: { nameAr: true, icon: true } },
    },
    orderBy: { discountPercent: 'desc' },
    take: 8,
  })
}

// Fetch supermarkets with offer counts for the store strip
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
            where: { isHidden: false },
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
      where: { isHidden: false },
      include: {
        supermarket: { select: { nameAr: true, slug: true, logo: true } },
        category: { select: { nameAr: true, icon: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 24,
    }),
    prisma.productOffer.count({ where: { isHidden: false } }),
  ])
  return { products, total }
}

function BestDealsSection({ deals }: { deals: any[] }) {
  if (deals.length === 0) return null

  return (
    <section className="mb-6">
      <div className="bg-gradient-to-l from-pink-50 to-white rounded-xl border border-pink-100 p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🔥</span>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">أفضل عروض الأسبوع</h2>
          <span className="text-xs bg-pink-600 text-white px-2 py-0.5 rounded-full font-bold">
            خصم حتى {deals[0]?.discountPercent || 0}%
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {deals.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  )
}

function StoreStrip({ stores }: { stores: any[] }) {
  if (stores.length === 0) return null

  return (
    <section className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-5 bg-pink-600 rounded-full" />
        <h2 className="font-bold text-gray-900 text-sm">تسوق حسب المتجر</h2>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {stores.map(store => (
          <Link
            key={store.id}
            href={`/offers/${store.slug}`}
            className="flex-shrink-0 bg-white rounded-xl border border-gray-100 hover:border-pink-200 hover:shadow-sm transition-all px-4 py-3 flex items-center gap-3 min-w-[160px]"
          >
            <div className="w-9 h-9 bg-gray-50 rounded-full flex items-center justify-center overflow-hidden border border-gray-100">
              {store.logo ? (
                <img src={store.logo} alt={store.nameAr} className="w-6 h-6 object-contain" />
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

function SSRFallback({ products, total, bestDeals, stores }: { products: any[]; total: number; bestDeals: any[]; stores: any[] }) {
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header />
      <main className="container mx-auto px-4 py-5">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">عروض السوبرماركت</h1>
        <p className="text-sm text-gray-500 mb-5">{total} عرض متوفر</p>

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
  const [{ products, total }, bestDeals, stores] = await Promise.all([
    getInitialProducts(),
    getBestDeals(),
    getActiveStores(),
  ])

  return (
    <Suspense fallback={<SSRFallback products={products} total={total} bestDeals={bestDeals} stores={stores} />}>
      <OffersClient />
    </Suspense>
  )
}
