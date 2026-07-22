import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import Header from '@/components/Header'
import ProductCard from '@/components/ProductCard'
import CategorySidebar from '@/components/CategorySidebar'
import CategorySort from './CategorySort'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ sort?: string }>
}

export const revalidate = 300

const SORTS: Record<string, any> = {
  'price-low': { price: 'asc' },
  'price-high': { price: 'desc' },
  discount: { discountPercent: 'desc' },
  newest: { createdAt: 'desc' },
}

async function getCategoryData(slug: string, sort: string) {
  const category = await prisma.category.findUnique({
    where: { slug },
    select: { id: true, nameAr: true, nameEn: true, icon: true },
  })
  if (!category) return null

  // Only current offers — expired prices mislead shoppers.
  const where = {
    categoryId: category.id,
    isHidden: false,
    price: { gt: 0 },
    flyer: { endDate: { gte: new Date() } },
  }
  const [products, total] = await Promise.all([
    prisma.productOffer.findMany({
      where,
      orderBy: SORTS[sort] || SORTS.newest,
      take: 48,
      include: {
        supermarket: { select: { nameAr: true, slug: true, logo: true } },
        category: { select: { nameAr: true, icon: true } },
        flyer: { select: { startDate: true, endDate: true } },
      },
    }),
    prisma.productOffer.count({ where }),
  ])

  return { category, products, total }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const category = await prisma.category.findUnique({
    where: { slug },
    select: {
      nameAr: true,
      // Count live offers only — this drives both the description and the
      // noindex decision, so a stale count would keep empty pages indexed.
      _count: {
        select: {
          products: { where: { isHidden: false, flyer: { endDate: { gte: new Date() } } } },
        },
      },
    },
  })
  // Signal the 404 from metadata too. Returning a plain title here let the
  // render complete with a 200, so a bad slug served a "not found" page that
  // search engines read as a real page (a soft 404).
  if (!category) notFound()

  const count = category._count.products
  return {
    // Root layout appends `| SmartCopons`.
    title: `عروض ${category.nameAr} اليوم ${new Date().getFullYear()} | أفضل الأسعار`,
    description:
      `تصفّح ${count} عرضاً على ${category.nameAr} من بنده والدانوب وكارفور والعثيم وغيرها. ` +
      `قارن الأسعار ووفّر أكثر على ${category.nameAr} في السعودية.`,
    keywords: `عروض ${category.nameAr}, اسعار ${category.nameAr}, خصومات ${category.nameAr}, ${category.nameAr} السعودية`,
    alternates: { canonical: `https://sa.smartcopons.com/offers/category/${slug}` },
    // Empty category = thin content.
    robots: count === 0 ? { index: false, follow: true } : undefined,
    openGraph: {
      title: `عروض ${category.nameAr} — أفضل الأسعار في السعودية`,
      description: `${count} عرضاً على ${category.nameAr}`,
      locale: 'ar_SA',
      type: 'website',
      url: `https://sa.smartcopons.com/offers/category/${slug}`,
    },
  }
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { sort = 'newest' } = await searchParams

  const data = await getCategoryData(slug, sort)
  if (!data) notFound()

  const { category, products, total } = data

  const jsonLd = products.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `عروض ${category.nameAr}`,
    numberOfItems: total,
    itemListElement: products.slice(0, 10).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: p.nameAr || p.nameEn,
        ...(p.imageUrl && { image: p.imageUrl }),
        ...(p.brand && { brand: { '@type': 'Brand', name: p.brand } }),
        category: category.nameAr,
        offers: {
          '@type': 'Offer',
          price: p.price,
          priceCurrency: 'SAR',
          availability: 'https://schema.org/InStock',
          itemCondition: 'https://schema.org/NewCondition',
          ...(p.flyer?.endDate && {
            priceValidUntil: new Date(p.flyer.endDate).toISOString().split('T')[0],
          }),
          seller: { '@type': 'Organization', name: p.supermarket.nameAr },
        },
      },
    })),
  } : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-red-50" dir="rtl">
      <Header />
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}

      <main className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-gray-600">
          <Link href="/" className="hover:text-pink-600">الرئيسية</Link>
          <span className="mx-2">/</span>
          <Link href="/offers" className="hover:text-pink-600">العروض</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-800 font-semibold">{category.nameAr}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <CategorySidebar />
          </div>

          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-600 to-red-600 bg-clip-text text-transparent mb-2">
                {category.icon ? `${category.icon} ` : ''}عروض {category.nameAr}
              </h1>
              <p className="text-gray-600">{total} منتج</p>
            </div>

            <CategorySort current={sort} />

            {products.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl shadow-lg">
                <div className="text-6xl mb-4">📦</div>
                <p className="text-gray-600 text-xl">لا توجد منتجات في هذا التصنيف</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="bg-gradient-to-r from-pink-600 to-red-500 text-white mt-20 py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-lg">© {new Date().getFullYear()} SmartCopons. جميع الحقوق محفوظة 💝</p>
        </div>
      </footer>
    </div>
  )
}
