import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import CouponCard from '@/components/CouponCard'
import {
  COUPON_CATEGORIES,
  FALLBACK_CATEGORY,
  getCouponCategory,
} from '@/lib/coupon-categories'

interface Props {
  params: Promise<{ slug: string }>
}

export const revalidate = 300

/**
 * The Prisma filter for a category. `marketplace` is the catch-all: it owns its
 * listed stores plus every store not claimed by another category, so it can't
 * use a static `in` list — it excludes everyone else instead.
 */
function whereForCategory(slug: string) {
  if (slug === FALLBACK_CATEGORY) {
    const claimedElsewhere = COUPON_CATEGORIES.filter(c => c.slug !== FALLBACK_CATEGORY).flatMap(c => c.stores)
    return { isActive: true, store: { slug: { notIn: claimedElsewhere } } }
  }
  const stores = getCouponCategory(slug)?.stores ?? []
  return { isActive: true, store: { slug: { in: stores } } }
}

async function getCategoryCoupons(slug: string) {
  return prisma.coupon.findMany({
    where: whereForCategory(slug),
    include: { store: { select: { name: true, slug: true, logo: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const category = getCouponCategory(slug)
  if (!category) notFound()

  const count = await prisma.coupon.count({ where: whereForCategory(slug) })
  const title = `${category.keyword} وأكواد الخصم${count ? ` (${count} كوبون)` : ''}`

  return {
    title,
    description: category.description,
    keywords: `${category.keyword}, اكواد خصم ${category.label}, كوبونات ${category.label}, خصومات ${category.label}, كوبونات السعودية`,
    alternates: { canonical: `https://sa.smartcopons.com/coupons/category/${slug}` },
    // An empty category shouldn't compete in the index.
    robots: count === 0 ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description: category.description,
      locale: 'ar_SA',
      type: 'website',
      url: `https://sa.smartcopons.com/coupons/category/${slug}`,
    },
  }
}

export default async function CouponCategoryPage({ params }: Props) {
  const { slug } = await params
  const category = getCouponCategory(slug)
  if (!category) notFound()

  const coupons = await getCategoryCoupons(slug)
  const others = COUPON_CATEGORIES.filter(c => c.slug !== slug)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: 'https://sa.smartcopons.com' },
          { '@type': 'ListItem', position: 2, name: 'كوبونات', item: 'https://sa.smartcopons.com/coupons' },
          { '@type': 'ListItem', position: 3, name: category.label, item: `https://sa.smartcopons.com/coupons/category/${slug}` },
        ],
      },
      {
        '@type': 'ItemList',
        name: category.keyword,
        numberOfItems: coupons.length,
        itemListElement: coupons.slice(0, 40).map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Offer',
            name: c.title,
            url: `https://sa.smartcopons.com/coupon/${c.id}`,
            category: 'DiscountCoupon',
            seller: { '@type': 'Organization', name: c.store.name },
            availability: 'https://schema.org/InStock',
          },
        })),
      },
    ],
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="container mx-auto px-4 py-6">
        <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/" className="hover:text-pink-600 transition">الرئيسية</Link>
          <span className="text-gray-300">/</span>
          <Link href="/coupons" className="hover:text-pink-600 transition">كوبونات</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-900 font-semibold">{category.label}</span>
        </nav>

        <div className="bg-gradient-to-l from-pink-600 to-pink-700 rounded-xl p-6 mb-6 text-white">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{category.icon}</span>
            <div>
              <h1 className="text-2xl font-bold">{category.keyword}</h1>
              <p className="text-sm opacity-90 mt-1">
                {coupons.length > 0 ? `${coupons.length} كوبون وكود خصم ساري` : 'لا توجد كوبونات سارية حالياً'}
              </p>
            </div>
          </div>
        </div>

        {/* Sibling categories — internal links spread crawl and rank signal */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Link
            href="/coupons"
            className="bg-white text-gray-700 px-3 py-1.5 rounded-full text-xs font-medium border border-gray-200 hover:border-pink-300 hover:text-pink-600 transition"
          >
            كل الكوبونات
          </Link>
          {others.map(c => (
            <Link
              key={c.slug}
              href={`/coupons/category/${c.slug}`}
              className="bg-white text-gray-700 px-3 py-1.5 rounded-full text-xs font-medium border border-gray-200 hover:border-pink-300 hover:text-pink-600 transition"
            >
              {c.icon} {c.label}
            </Link>
          ))}
        </div>

        {coupons.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <span className="text-5xl block mb-4">🎟️</span>
            <p className="text-gray-500">لا توجد كوبونات في هذه الفئة حالياً</p>
            <Link href="/coupons" className="mt-3 inline-block text-pink-600 hover:underline font-semibold text-sm">
              تصفّح كل الكوبونات
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {coupons.map(coupon => (
              <CouponCard
                key={coupon.id}
                id={coupon.id}
                title={coupon.title}
                code={coupon.code}
                discountText={coupon.discountText}
                storeName={coupon.store.name}
                storeSlug={coupon.store.slug}
                storeLogo={coupon.store.logo}
              />
            ))}
          </div>
        )}

        {/* SEO body */}
        <section className="mt-10 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-bold text-gray-900 mb-2">{category.keyword} في السعودية</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            {category.description} نحدّث الأكواد باستمرار لنضمن لك أحدث الخصومات السارية.
            اختر الكوبون المناسب، انسخ الكود، ثم استخدمه عند إتمام طلبك للحصول على خصم فوري.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  )
}
