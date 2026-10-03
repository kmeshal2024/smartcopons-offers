import Link from 'next/link'
import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import AmazonProductCard from '@/components/AmazonProductCard'
import {
  getActiveAmazonProducts,
  liveDiscount,
  AMAZON_CATEGORIES,
  AMAZON_DISCLOSURE,
} from '@/lib/amazon'

/**
 * Hand-picked Amazon.sa essentials, grouped by aisle.
 *
 * Arabic-only like the coupon store pages: the content is Arabic product names
 * and Amazon's disclosure, so there is nothing for the EN toggle to translate.
 * Shows the discount, never a price — see components/AmazonProductCard.tsx.
 * The freshness gate runs here, per request, OUTSIDE the cached query, so a
 * discount disappears on time even while the row list is served from cache.
 */
export const metadata: Metadata = {
  title: 'عروض وخصومات أمازون السعودية على المنتجات الأساسية',
  description: 'خصومات أمازون السعودية على الأرز والزيت والحليب والحفاضات ومنظفات المنزل والعناية الشخصية — الأكثر طلباً.',
  alternates: { canonical: 'https://sa.smartcopons.com/amazon' },
  openGraph: {
    title: 'عروض وخصومات أمازون السعودية على المنتجات الأساسية',
    description: 'خصومات أمازون السعودية على المنتجات الأساسية الأكثر طلباً.',
    locale: 'ar_SA',
    type: 'website',
    url: 'https://sa.smartcopons.com/amazon',
  },
}

export const dynamic = 'force-dynamic'

const TOP_DEALS = 10

export default async function AmazonPage() {
  const now = Date.now()
  const products = (await getActiveAmazonProducts()).map(p => ({
    ...p,
    discount: liveDiscount(p.discountPercent, p.discountCheckedAt, now),
  }))

  const groups = AMAZON_CATEGORIES.map(c => ({
    ...c,
    items: products.filter(p => p.category === c.slug),
  })).filter(g => g.items.length > 0)

  const topDeals = products
    .filter(p => p.discount)
    .sort((a, b) => (b.discount ?? 0) - (a.discount ?? 0))
    .slice(0, TOP_DEALS)

  const card = (p: (typeof products)[number]) => (
    <AmazonProductCard
      key={p.id}
      id={p.id}
      asin={p.asin}
      title={p.title}
      note={p.note}
      imageUrl={p.imageUrl}
      category={p.category}
      discount={p.discount}
    />
  )

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header />

      <main className="container mx-auto px-4 py-6 pb-24">
        <div className="mb-6">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-2xl">📦</span>
            <h1 className="text-2xl font-bold text-gray-900">عروض أمازون على المنتجات الأساسية</h1>
          </div>
          <p className="text-sm text-gray-500">
            الأكثر طلباً على أمازون السعودية مع نسبة الخصم الحالية. السعر النهائي يظهر عند فتح المنتج على أمازون.
          </p>
        </div>

        {groups.length > 1 && (
          <nav className="mb-6 flex flex-wrap gap-2" aria-label="الأقسام">
            {topDeals.length > 0 && (
              <a
                href="#top-deals"
                className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 hover:border-red-300"
              >
                🔥 أقوى الخصومات
              </a>
            )}
            {groups.map(g => (
              <a
                key={g.slug}
                href={`#${g.slug}`}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:border-pink-300 hover:text-pink-700"
              >
                {g.emoji} {g.label}
              </a>
            ))}
          </nav>
        )}

        {groups.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white p-10 text-center text-gray-400">
            <span className="mb-3 block text-5xl">📦</span>
            <p>لا توجد منتجات بعد.</p>
            <Link href="/" className="mt-4 inline-block text-sm font-semibold text-pink-600 hover:text-pink-700">
              تصفح عروض السوبرماركت
            </Link>
          </div>
        ) : (
          <>
            {topDeals.length > 0 && (
              <section id="top-deals" className="mb-10 scroll-mt-20">
                <h2 className="mb-3 text-lg font-bold text-gray-900">🔥 أقوى الخصومات</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {topDeals.map(card)}
                </div>
              </section>
            )}
            {groups.map(g => (
              <section key={g.slug} id={g.slug} className="mb-10 scroll-mt-20">
                <h2 className="mb-3 text-lg font-bold text-gray-900">
                  {g.emoji} {g.label}
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {g.items.map(card)}
                </div>
              </section>
            ))}
          </>
        )}

        <p className="mt-8 border-t border-gray-200 pt-4 text-xs leading-relaxed text-gray-400">
          نسبة الخصم محسوبة من سعر القائمة على أمازون وقت آخر تحقق، وقد تتغير في أي وقت.
          <br />
          {AMAZON_DISCLOSURE}
        </p>
      </main>

      <Footer />
    </div>
  )
}
