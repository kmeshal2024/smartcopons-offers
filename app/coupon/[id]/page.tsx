import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import CouponCard from '@/components/CouponCard'
import CopyCodeButton from './CopyCodeButton'

interface Props {
  params: Promise<{ id: string }>
}

export const revalidate = 300

async function getCoupon(id: string) {
  return prisma.coupon.findFirst({
    where: { id, isActive: true },
    include: {
      store: { select: { name: true, slug: true, logo: true, website: true } },
    },
  })
}

// Other live coupons from the same store — turns a one-code page into a reason
// to index, and gives the visitor somewhere to go if this code doesn't fit.
async function getMoreFromStore(storeId: string, excludeId: string) {
  return prisma.coupon.findMany({
    where: { storeId, isActive: true, id: { not: excludeId } },
    include: { store: { select: { name: true, slug: true, logo: true } } },
    orderBy: { createdAt: 'desc' },
    take: 6,
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const coupon = await getCoupon(id)
  // Signal the 404 from metadata too, so a bad id is a real not-found rather
  // than a soft 404 that search engines index as a live page.
  if (!coupon) notFound()

  const store = coupon.store.name
  const title = `${coupon.discountText} — ${coupon.title} | كود خصم ${store}`
  const desc =
    `${coupon.title}: استخدم كود خصم ${store} «${coupon.code}» واحصل على ${coupon.discountText}. ` +
    `أحدث كوبونات وأكواد خصم ${store} في السعودية.`

  return {
    title,
    description: desc,
    keywords: `كود خصم ${store}, كوبون ${store}, ${coupon.code}, ${coupon.discountText}, خصم ${store}, كوبونات السعودية`,
    alternates: { canonical: `https://sa.smartcopons.com/coupon/${coupon.id}` },
    openGraph: {
      title,
      description: desc,
      locale: 'ar_SA',
      type: 'website',
      url: `https://sa.smartcopons.com/coupon/${coupon.id}`,
      ...(coupon.store.logo && { images: [coupon.store.logo] }),
    },
  }
}

export default async function CouponPage({ params }: Props) {
  const { id } = await params
  const coupon = await getCoupon(id)
  if (!coupon) notFound()

  const store = coupon.store.name
  const more = await getMoreFromStore(coupon.storeId, coupon.id)

  // Coupons have no first-class rich-result type, but an Offer with the store
  // as seller is valid structured data and describes the discount honestly.
  // BreadcrumbList is well supported and earns the trail in search results.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Offer',
        name: coupon.title,
        description: coupon.description || `${coupon.discountText} في ${store}`,
        url: `https://sa.smartcopons.com/coupon/${coupon.id}`,
        category: 'DiscountCoupon',
        seller: {
          '@type': 'Organization',
          name: store,
          ...(coupon.store.website && { url: coupon.store.website }),
          ...(coupon.store.logo && { logo: coupon.store.logo }),
        },
        availability: 'https://schema.org/InStock',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: 'https://sa.smartcopons.com' },
          { '@type': 'ListItem', position: 2, name: 'كوبونات', item: 'https://sa.smartcopons.com/coupons' },
          { '@type': 'ListItem', position: 3, name: `كود خصم ${store}`, item: `https://sa.smartcopons.com/coupon/${coupon.id}` },
        ],
      },
    ],
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="container mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/" className="hover:text-pink-600 transition">الرئيسية</Link>
          <span className="text-gray-300">/</span>
          <Link href="/coupons" className="hover:text-pink-600 transition">كوبونات</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-900 font-semibold line-clamp-1">{store}</span>
        </nav>

        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 sm:p-8">
            <div className="mb-6">
              <Link
                href={`/store/${coupon.store.slug}`}
                className="inline-flex items-center gap-1.5 bg-pink-50 text-pink-700 px-3 py-1 rounded-full text-xs font-semibold hover:bg-pink-100 transition"
              >
                {coupon.store.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coupon.store.logo} alt={store} className="w-4 h-4 object-contain rounded" />
                ) : (
                  <span>🏷️</span>
                )}
                {store}
              </Link>
              <h1 className="text-2xl sm:text-3xl font-bold mt-3 text-gray-900">{coupon.title}</h1>
            </div>

            <div className="bg-gradient-to-l from-pink-600 to-pink-700 text-white p-8 rounded-xl mb-6 text-center">
              <div className="text-4xl font-black">{coupon.discountText}</div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2 text-gray-700">كود الكوبون:</label>
              <div className="flex gap-2">
                <div className="flex-1 bg-gray-50 border-2 border-dashed border-pink-300 rounded-lg px-4 py-3 font-mono text-lg font-bold text-center text-pink-700">
                  {coupon.code}
                </div>
                <CopyCodeButton code={coupon.code} />
              </div>
            </div>

            {coupon.description && (
              <div className="mb-6">
                <h2 className="text-lg font-bold mb-2 text-gray-900">تفاصيل الكوبون</h2>
                <p className="text-gray-600 text-sm leading-relaxed">{coupon.description}</p>
              </div>
            )}

            <div className="pt-6 border-t border-gray-100">
              <a
                href={coupon.url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="block w-full bg-pink-600 text-white text-center px-6 py-4 rounded-lg hover:bg-pink-700 transition font-bold text-lg"
              >
                استخدم الكوبون الآن ←
              </a>
              <p className="text-center text-xs text-gray-400 mt-3">
                انسخ الكود «{coupon.code}» ثم الصقه عند إتمام الطلب في {store}
              </p>
            </div>
          </div>

          {/* SEO body: a real sentence for the query, not just a code */}
          <section className="mt-6 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-bold text-gray-900 mb-2">كود خصم {store}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              وفّر على مشترياتك من {store} باستخدام كود الخصم «{coupon.code}» للحصول على {coupon.discountText}.
              نحدّث كوبونات وأكواد خصم {store} أولاً بأول لتحصل على أحدث العروض السارية في السعودية.
              انسخ الكود، انتقل إلى المتجر، والصقه في خانة كود الخصم عند الدفع.
            </p>
          </section>

          {more.length > 0 && (
            <section className="mt-8">
              <div className="mb-3 flex items-center gap-2">
                <div className="w-1 h-5 bg-pink-600 rounded-full" />
                <h2 className="font-bold text-gray-900 text-sm">كوبونات {store} الأخرى</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {more.map(c => (
                  <CouponCard
                    key={c.id}
                    id={c.id}
                    title={c.title}
                    code={c.code}
                    discountText={c.discountText}
                    storeName={c.store.name}
                    storeSlug={c.store.slug}
                    storeLogo={c.store.logo}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
