import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ProductCard from '@/components/ProductCard'
import { COUNTRIES, urlFor } from '@/lib/countries'

const COUNTRY = COUNTRIES.AE

interface Props {
  params: Promise<{ slug: string }>
}

export const dynamic = 'force-dynamic'

/**
 * Scoped by country as well as slug: "carrefour" exists in both markets, and
 * looking up by slug alone would serve the Saudi store under a /ae URL.
 */
async function getStore(slug: string) {
  return prisma.supermarket.findFirst({
    where: { slug, country: COUNTRY.code, isActive: true },
    select: { id: true, nameAr: true, name: true, slug: true, logo: true, website: true },
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const store = await getStore(slug)
  if (!store) notFound()

  const title = `عروض ${store.nameAr} اليوم في الإمارات`
  const description = `أحدث عروض وتخفيضات ${store.nameAr} في الإمارات بالدرهم، محدّثة يومياً.`
  return {
    title,
    description,
    keywords: `عروض ${store.nameAr}, ${store.nameAr} الامارات, تخفيضات ${store.nameAr}`,
    alternates: { canonical: urlFor('AE', `/store/${store.slug}`) },
    openGraph: {
      title,
      description,
      locale: 'ar_AE',
      type: 'website',
      url: urlFor('AE', `/store/${store.slug}`),
    },
  }
}

export default async function UaeStorePage({ params }: Props) {
  const { slug } = await params
  const store = await getStore(slug)
  if (!store) notFound()

  const now = new Date()
  const [offers, total] = await Promise.all([
    prisma.productOffer.findMany({
      where: {
        supermarketId: store.id,
        isHidden: false,
        country: COUNTRY.code,
        flyer: { endDate: { gte: now } },
      },
      include: {
        supermarket: { select: { nameAr: true, slug: true, logo: true } },
        category: { select: { nameAr: true, icon: true } },
        flyer: { select: { startDate: true, endDate: true } },
      },
      orderBy: [{ discountPercent: 'desc' }, { createdAt: 'desc' }],
      take: 48,
    }),
    prisma.productOffer.count({
      where: {
        supermarketId: store.id,
        isHidden: false,
        country: COUNTRY.code,
        flyer: { endDate: { gte: now } },
      },
    }),
  ])

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <nav className="mb-5 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/ae" className="hover:text-pink-600">الإمارات</Link>
          <span className="text-gray-300">/</span>
          <span className="font-semibold text-gray-900">{store.nameAr}</span>
        </nav>

        <header className="mb-6 flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5">
          {store.logo ? (
            <Image src={store.logo} alt={store.nameAr} width={80} height={48} className="h-12 w-20 object-contain" />
          ) : (
            <span className="text-3xl">🛒</span>
          )}
          <div>
            <h1 className="text-lg font-extrabold text-gray-900">عروض {store.nameAr}</h1>
            <p className="text-sm text-gray-500">{total.toLocaleString('en')} عرض متوفر</p>
          </div>
        </header>

        {offers.length === 0 ? (
          <p className="rounded-xl border border-gray-100 bg-white py-14 text-center text-gray-500">
            لا توجد عروض متاحة حالياً — تُحدَّث يومياً.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {offers.map(p => (
              <ProductCard key={p.id} product={p as any} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
