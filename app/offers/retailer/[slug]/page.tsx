import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import ProductCard from '@/components/ProductCard'
import Footer from '@/components/Footer'
import Link from 'next/link'
import type { Metadata } from 'next'
import RetailerFilters from './RetailerFilters'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ sort?: string; category?: string; page?: string; search?: string }>
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params
  const sp = await searchParams
  const supermarket = await prisma.supermarket.findUnique({
    where: { slug },
  })

  if (!supermarket) return { title: 'متجر غير موجود' }

  const search = sp.search || ''
  return {
    title: search
      ? `بحث "${search}" في عروض ${supermarket.nameAr} | SmartCopons`
      : `عروض ${supermarket.nameAr} اليوم | خصومات ${supermarket.nameAr} - SmartCopons`,
    description: `تصفح أحدث عروض وخصومات ${supermarket.nameAr} في السعودية. عروض يومية وأسبوعية على المنتجات الغذائية والمنزلية.`,
    keywords: `عروض ${supermarket.nameAr}, عروض ${supermarket.nameAr} اليوم, خصومات ${supermarket.nameAr}, ${supermarket.name} offers, ${supermarket.name} KSA`,
    openGraph: {
      title: `عروض ${supermarket.nameAr} اليوم`,
      description: `أحدث العروض والخصومات من ${supermarket.nameAr}`,
      locale: 'ar_SA',
    },
  }
}

export const revalidate = 60

async function getRetailerData(slug: string, sort: string, categorySlug: string, page: number, search: string) {
  const supermarket = await prisma.supermarket.findUnique({
    where: { slug },
  })

  if (!supermarket) return null

  // Increment view count (fire-and-forget)
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

  // Search filter
  if (search) {
    where.OR = [
      { nameAr: { contains: search } },
      { nameEn: { contains: search } },
      { brand: { contains: search } },
      { tags: { contains: search } },
    ]
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
  const search = sp.search || ''

  const data = await getRetailerData(slug, sort, category, page, search)

  if (!data) return notFound()

  const { supermarket, products, total, categories, activeFlyers, totalPages, currentPage } = data

  // Helper to build pagination URLs
  function buildPageUrl(pageNum: number) {
    const params = new URLSearchParams()
    if (sort !== 'newest') params.set('sort', sort)
    if (category) params.set('category', category)
    if (search) params.set('search', search)
    params.set('page', String(pageNum))
    return `/offers/retailer/${slug}?${params.toString()}`
  }

  // Structured data for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: supermarket.nameAr,
    alternateName: supermarket.name,
    url: `https://sa.smartcopons.com/offers/retailer/${supermarket.slug}`,
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="container mx-auto px-4 py-5">
        {/* Breadcrumb */}
        <nav className="mb-4 text-sm text-gray-500 flex items-center gap-1.5">
          <Link href="/" className="hover:text-pink-600 transition">الرئيسية</Link>
          <svg className="w-3.5 h-3.5 text-gray-300 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <Link href="/supermarkets" className="hover:text-pink-600 transition">المتاجر</Link>
          <svg className="w-3.5 h-3.5 text-gray-300 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-800 font-medium">{supermarket.nameAr}</span>
        </nav>

        {/* Supermarket Header */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5 mb-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-full border-2 border-gray-100 flex items-center justify-center flex-shrink-0">
              {supermarket.logo ? (
                <img src={supermarket.logo} alt={supermarket.nameAr} className="w-10 h-10 sm:w-11 sm:h-11 object-contain" />
              ) : (
                <span className="text-2xl sm:text-3xl">🏪</span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-0.5">
                عروض {supermarket.nameAr}
              </h1>
              <p className="text-sm text-gray-500">{total} عرض متوفر</p>
            </div>
          </div>

          {/* Active Flyers */}
          {activeFlyers.length > 0 && (
            <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {activeFlyers.map(flyer => (
                <div key={flyer.id} className="flex-shrink-0 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <div className="font-medium text-gray-700 text-sm whitespace-nowrap">{flyer.titleAr || flyer.title}</div>
                  <div className="text-xs text-gray-500">
                    {flyer._count.productOffers} منتج · ينتهي {new Date(flyer.endDate).toLocaleDateString('ar-SA')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filters + Search */}
        <RetailerFilters
          slug={slug}
          categories={categories}
          currentSort={sort}
          currentCategory={category}
          currentSearch={search}
          totalResults={total}
        />

        {/* Products Grid */}
        {products.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <svg className="w-16 h-16 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-gray-500 text-lg font-medium mb-1">
              {search ? 'لم يتم العثور على نتائج' : 'لا توجد عروض حالياً'}
            </p>
            <p className="text-gray-400 text-sm">
              {search ? `لا توجد منتجات تطابق "${search}"` : 'جرب تغيير الفلاتر أو البحث'}
            </p>
            {(search || category) && (
              <Link
                href={`/offers/retailer/${slug}`}
                className="inline-block mt-4 text-pink-600 hover:text-pink-700 text-sm font-medium transition"
              >
                مسح الفلاتر والبحث
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Results summary */}
            <div className="flex items-center justify-between mb-3 px-0.5">
              <span className="text-xs sm:text-sm text-gray-400">
                عرض {products.length} من {total} منتج
              </span>
              {totalPages > 1 && (
                <span className="text-xs text-gray-400">
                  صفحة {currentPage} من {totalPages}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
              {products.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-1.5 mt-8">
                {currentPage > 1 && (
                  <Link
                    href={buildPageUrl(currentPage - 1)}
                    className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
                  >
                    السابق
                  </Link>
                )}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
                  if (p < 1 || p > totalPages) return null
                  return (
                    <Link
                      key={p}
                      href={buildPageUrl(p)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium flex items-center justify-center transition ${
                        p === currentPage
                          ? 'bg-pink-600 text-white'
                          : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </Link>
                  )
                })}
                {currentPage < totalPages && (
                  <Link
                    href={buildPageUrl(currentPage + 1)}
                    className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
                  >
                    التالي
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}
