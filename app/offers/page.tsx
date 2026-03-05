import { Suspense } from 'react'
import { prisma } from '@/lib/db'
import Header from '@/components/Header'
import ProductCard from '@/components/ProductCard'
import OffersClient from './OffersClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'عروض السوبرماركت اليوم | SmartCopons',
  description: 'تصفح أحدث عروض السوبرماركت في السعودية. عروض بنده، كارفور، لولو، الدانوب. أسعار مخفضة يومياً.',
  keywords: 'عروض اليوم, عروض السوبرماركت, خصومات, عروض بنده اليوم, عروض كارفور اليوم',
}

export const revalidate = 60

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

function SSRFallback({ products, total }: { products: any[]; total: number }) {
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header />
      <main className="container mx-auto px-4 py-5">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">عروض السوبرماركت</h1>
        <p className="text-sm text-gray-500 mb-5">{total} عرض متوفر</p>

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
    </div>
  )
}

export default async function OffersPage() {
  const { products, total } = await getInitialProducts()

  return (
    <Suspense fallback={<SSRFallback products={products} total={total} />}>
      <OffersClient />
    </Suspense>
  )
}
