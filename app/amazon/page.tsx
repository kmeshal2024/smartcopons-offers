import Link from 'next/link'
import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import AmazonProductCard from '@/components/AmazonProductCard'
import { getActiveAmazonProducts, AMAZON_CATEGORIES, AMAZON_DISCLOSURE } from '@/lib/amazon'

/**
 * Hand-picked Amazon.sa products, grouped by aisle.
 *
 * Arabic-only like the coupon store pages: the content is Arabic product names
 * and Amazon's disclosure, so there is nothing for the EN toggle to translate.
 * Prices are deliberately absent — see components/AmazonProductCard.tsx.
 */
export const metadata: Metadata = {
  title: 'منتجات مختارة من أمازون السعودية',
  description: 'منتجات منتقاة من أمازون السعودية للبقالة والعناية والأطفال والمنزل، بجانب عروض السوبرماركت.',
  alternates: { canonical: 'https://sa.smartcopons.com/amazon' },
  openGraph: {
    title: 'منتجات مختارة من أمازون السعودية',
    description: 'منتجات منتقاة من أمازون السعودية للبقالة والعناية والأطفال والمنزل.',
    locale: 'ar_SA',
    type: 'website',
    url: 'https://sa.smartcopons.com/amazon',
  },
}

export const dynamic = 'force-dynamic'

export default async function AmazonPage() {
  const products = await getActiveAmazonProducts()

  const groups = AMAZON_CATEGORIES.map(c => ({
    ...c,
    items: products.filter(p => p.category === c.slug),
  })).filter(g => g.items.length > 0)

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header />

      <main className="container mx-auto px-4 py-6 pb-24">
        <div className="mb-6">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-2xl">📦</span>
            <h1 className="text-2xl font-bold text-gray-900">منتجات مختارة من أمازون</h1>
          </div>
          <p className="text-sm text-gray-500">
            منتجات نختارها من أمازون السعودية، والسعر الحالي يظهر عند فتح المنتج على أمازون.
          </p>
        </div>

        {groups.length > 1 && (
          <nav className="mb-6 flex flex-wrap gap-2" aria-label="الأقسام">
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
          groups.map(g => (
            <section key={g.slug} id={g.slug} className="mb-10 scroll-mt-20">
              <h2 className="mb-3 text-lg font-bold text-gray-900">
                {g.emoji} {g.label}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {g.items.map(p => (
                  <AmazonProductCard key={p.id} {...p} />
                ))}
              </div>
            </section>
          ))
        )}

        <p className="mt-8 border-t border-gray-200 pt-4 text-xs leading-relaxed text-gray-400">
          {AMAZON_DISCLOSURE}
        </p>
      </main>

      <Footer />
    </div>
  )
}
