import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import CouponCard from '@/components/CouponCard'

interface Props {
  params: Promise<{ slug: string }>
}

export const revalidate = 300

async function getStore(slug: string) {
  return prisma.store.findUnique({
    where: { slug },
    include: {
      coupons: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const store = await getStore(slug)
  // A store with no page is a real 404, not a soft one.
  if (!store) notFound()

  const n = store.coupons.length
  const title = `كوبونات ${store.name} وأكواد الخصم${n ? ` (${n} كوبون)` : ''}`
  const desc =
    `أحدث كوبونات وأكواد خصم ${store.name} في السعودية${n ? ` — ${n} كوبون ساري` : ''}. ` +
    `انسخ الكود واحصل على خصم فوري عند الشراء من ${store.name}.`

  return {
    title,
    description: desc,
    keywords: `كوبونات ${store.name}, كود خصم ${store.name}, اكواد خصم ${store.name}, عروض ${store.name}, خصومات ${store.name}`,
    alternates: { canonical: `https://sa.smartcopons.com/store/${store.slug}` },
    // A store whose coupons all expired keeps its permalink but should not
    // compete in the index with stores that have live codes.
    robots: n === 0 ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description: desc,
      locale: 'ar_SA',
      type: 'website',
      url: `https://sa.smartcopons.com/store/${store.slug}`,
      ...(store.logo && { images: [store.logo] }),
    },
  }
}

export default async function StorePage({ params }: Props) {
  const { slug } = await params
  const store = await getStore(slug)
  if (!store) notFound()

  const coupons = store.coupons

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: 'https://sa.smartcopons.com' },
          { '@type': 'ListItem', position: 2, name: 'كوبونات', item: 'https://sa.smartcopons.com/coupons' },
          { '@type': 'ListItem', position: 3, name: `كوبونات ${store.name}`, item: `https://sa.smartcopons.com/store/${store.slug}` },
        ],
      },
      // One list, each coupon an Offer — the store page's whole value is that it
      // aggregates a retailer's live codes, and this states that to crawlers.
      {
        '@type': 'ItemList',
        name: `كوبونات ${store.name}`,
        numberOfItems: coupons.length,
        itemListElement: coupons.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Offer',
            name: c.title,
            description: c.description || `${c.discountText} في ${store.name}`,
            url: `https://sa.smartcopons.com/coupon/${c.id}`,
            category: 'DiscountCoupon',
            seller: { '@type': 'Organization', name: store.name },
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
          <span className="text-gray-900 font-semibold">{store.name}</span>
        </nav>

        <div className="bg-gradient-to-l from-pink-600 to-pink-700 rounded-xl p-6 mb-6 text-white">
          <div className="flex items-center gap-3">
            {store.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logo} alt={store.name} className="w-12 h-12 rounded-lg bg-white object-contain p-1" />
            )}
            <div>
              <h1 className="text-2xl font-bold">كوبونات {store.name}</h1>
              <p className="text-sm opacity-90 mt-1">
                {coupons.length > 0 ? `${coupons.length} كوبون وكود خصم ساري` : 'لا توجد كوبونات سارية حالياً'}
              </p>
            </div>
          </div>
        </div>

        {coupons.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <span className="text-5xl block mb-4">🎟️</span>
            <p className="text-gray-500">لا توجد كوبونات متاحة حالياً</p>
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
                storeName={store.name}
                storeSlug={store.slug}
                storeLogo={store.logo}
              />
            ))}
          </div>
        )}

        {/* SEO body */}
        <section className="mt-10 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-bold text-gray-900 mb-2">كوبونات وأكواد خصم {store.name}</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            تصفّح أحدث كوبونات {store.name} وأكواد الخصم السارية في السعودية. نحرص على تحديث الأكواد
            باستمرار لضمان حصولك على خصم فعّال. اختر الكوبون المناسب، انسخ الكود، ثم استخدمه عند إتمام
            طلبك في {store.name} لتوفير المزيد.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  )
}
