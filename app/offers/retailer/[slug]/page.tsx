import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import ProductCard from '@/components/ProductCard'
import Link from 'next/link'
import type { Metadata } from 'next'
import RetailerFilters from './RetailerFilters'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ sort?: string; category?: string; page?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supermarket = await prisma.supermarket.findUnique({
    where: { slug },
  })

  if (!supermarket) return { title: 'متجر غير موجود' }

  return {
    title: `عروض ${supermarket.nameAr} اليوم | خصومات ${supermarket.nameAr} - SmartCopons`,
    description: `تصفح أحدث عروض وخصومات ${supermarket.nameAr} في السعودية. عروض يومية وأسبوعية على المنتجات الغذائية والمنزلية.`,
    keywords: `عروض ${supermarket.nameAr}, عروض ${supermarket.nameAr} اليوم, خصومات ${supermarket.nameAr}, ${supermarket.name} offers, ${supermarket.name} KSA`,
    openGraph: {
      title: `عروض ${supermarket.nameAr} اليوم`,
      description: `أحدث العروض والخصومات من ${supermarket.nameAr}`,
      locale: 'ar_SA',
    },
  }
}

export const revalidate = 60 // Revalidate every minute

async function getRetailerData(slug: string, sort: string, categorySlug: string, page: number) {
  const supermarket = await prisma.supermarket.findUnique({
    where: { slug },
  })

  if (!supermarket) return null

  // Increment view count
  prisma.supermarket.update({
    where: { id: supermarket.id },
    data: { viewCount: { increment: 1 } },
  }).catch(() => {})

  const limit = 24
  const skip = (page - 1) * limit

  const where: any = {
    supermarketId: supermarket.id,
    isHidden: false,
  }

  if (categorySlug) {
    const cat = await prisma.category.findUnique({ where: { slug: categorySlug } })
    if (cat) where.categoryId = cat.id
  }

  let orderBy: any = { createdAt: 'desc' }
  switch (sort) {
    case 'price-low': orderBy = { price: 'asc' }; break
    case 'price-high': orderBy = { price: 'desc' }; break
    case 'discount': orderBy = { discountPercent: 'desc' }; break
    case 'popular': orderBy = { viewCount: 'desc' }; break
  }

  const [products, total, categories, activeFlyers] = await Promise.all([
    prisma.productOffer.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        supermarket: { select: { id: true, nameAr: true, slug: true, logo: true } },
        category: { select: { nameAr: true, slug: true, icon: true } },
      },
    }),
    prisma.productOffer.count({ where }),
    prisma.category.findMany({
      where: {
        isActive: true,
        products: { some: { supermarketId: supermarket.id, isHidden: false } },
      },
      select: { nameAr: true, slug: true, icon: true },
      orderBy: { order: 'asc' },
    }),
    prisma.flyer.findMany({
      where: {
        supermarketId: supermarket.id,
        status: 'ACTIVE',
        endDate: { gte: new Date() },
      },
      select: { id: true, title: true, titleAr: true, endDate: true, _count: { select: { productOffers: true } } },
      orderBy: { startDate: 'desc' },
    }),
  ])

  return {
    supermarket,
    products,
    total,
    categories,
    activeFlyers,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
  }
}

export default async function RetailerPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = await searchParams
  const sort = sp.sort || 'newest'
  const category = sp.category || ''
  const page = parseInt(sp.page || '1')

  const data = await getRetailerData(slug, sort, category, page)

  if (!data) return notFound()

  const { supermarket, products, total, categories, activeFlyers, totalPages, currentPage } = data

  // Structured data for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: supermarket.nameAr,
    alternateName: supermarket.name,
    url: `https://sa.smartcopons.com/offers/retailer/${supermarket.slug}`,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-red-50" dir="rtl">
      <Header />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="container mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <nav className="mb-4 text-sm text-gray-600">
          <Link href="/" className="hover:text-pink-600">الرئيسية</Link>
          <span className="mx-2">/</span>
          <Link href="/supermarkets" className="hover:text-pink-600">المتاجر</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-800 font-semibold">{supermarket.nameAr}</span>
        </nav>

        {/* Supermarket Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 mb-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 bg-gradient-to-br from-pink-100 to-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
              {supermarket.logo ? (
                <img src={supermarket.logo} alt={supermarket.nameAr} className="w-14 h-14 object-contain" />
              ) : (
                <span className="text-4xl">🏪</span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-pink-600 to-red-600 bg-clip-text text-transparent mb-1">
                عروض {supermarket.nameAr}
              </h1>
              <p className="text-gray-600">{total} عرض متوفر</p>
            </div>
          </div>

          {/* Active Flyers */}
          {activeFlyers.length > 0 && (
            <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
              {activeFlyers.map(flyer => (
                <div key={flyer.id} className="flex-shrink-0 bg-pink-50 border border-pink-200 rounded-xl px-4 py-2">
                  <div className="font-semibold text-pink-700 text-sm">{flyer.titleAr || flyer.title}</div>
                  <div className="text-xs text-pink-500">
                    {flyer._count.productOffers} منتج - ينتهي {new Date(flyer.endDate).toLocaleDateString('ar-SA')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filters */}
        <RetailerFilters
          slug={slug}
          categories={categories}
          currentSort={sort}
          currentCategory={category}
        />

        {/* Products Grid */}
        {products.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-lg">
            <div className="text-6xl mb-4">🛒</div>
            <p className="text-gray-600 text-xl">لا توجد عروض حالياً</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
              {products.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                {currentPage > 1 && (
                  <Link
                    href={`/offers/retailer/${slug}?sort=${sort}&category=${category}&page=${currentPage - 1}`}
                    className="px-4 py-2 rounded-full border-2 border-pink-200 hover:border-pink-500 font-semibold"
                  >
                    السابق
                  </Link>
                )}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
                  return (
                    <Link
                      key={p}
                      href={`/offers/retailer/${slug}?sort=${sort}&category=${category}&page=${p}`}
                      className={`w-10 h-10 rounded-full font-semibold flex items-center justify-center ${
                        p === currentPage
                          ? 'bg-pink-600 text-white'
                          : 'border-2 border-pink-200 hover:border-pink-500'
                      }`}
                    >
                      {p}
                    </Link>
                  )
                })}
                {currentPage < totalPages && (
                  <Link
                    href={`/offers/retailer/${slug}?sort=${sort}&category=${category}&page=${currentPage + 1}`}
                    className="px-4 py-2 rounded-full border-2 border-pink-200 hover:border-pink-500 font-semibold"
                  >
                    التالي
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="bg-gradient-to-r from-pink-600 to-red-500 text-white mt-20 py-8">
        <div className="container mx-auto px-4 text-center">
          <p>SmartCopons {new Date().getFullYear()} - جميع الحقوق محفوظة</p>
        </div>
      </footer>
    </div>
  )
}
