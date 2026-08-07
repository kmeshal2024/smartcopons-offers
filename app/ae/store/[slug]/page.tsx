import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ProductCard from '@/components/ProductCard'
import { COUNTRIES, urlFor } from '@/lib/countries'
import { getLang } from '@/lib/i18n-server'
import { t as translate, dirOf } from '@/lib/i18n'

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
  // A current weekly flyer to link, if this store has one (LuLu UAE publishes
  // page-image promotions). Newest still-valid flyer that actually has an asset.
  const flyer = await prisma.flyer.findFirst({
    where: {
      supermarketId: store.id,
      endDate: { gte: now },
      OR: [{ pageImages: { not: null } }, { pdfUrl: { not: null } }],
    },
    orderBy: { startDate: 'desc' },
    select: { startDate: true, totalPages: true, coverImage: true },
  })
  const flyerDate = flyer ? new Date(flyer.startDate).toISOString().slice(0, 10) : null

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

  const lang = getLang()
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars)

  return (
    <div className="min-h-screen bg-gray-50" dir={dirOf(lang)}>
      <Header />
      <main className="container mx-auto px-4 py-6">
        <nav className="mb-5 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/ae" className="hover:text-pink-600">{lang === 'en' ? COUNTRY.nameEn : COUNTRY.nameAr}</Link>
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
            <h1 className="text-lg font-extrabold text-gray-900">{t('common.offersOf', { name: store.nameAr })}</h1>
            <p className="text-sm text-gray-500">{t('offers.available', { n: total.toLocaleString('en') })}</p>
          </div>
        </header>

        {flyerDate && (
          <Link
            href={`/ae/flyers/${store.slug}/${flyerDate}`}
            className="mb-5 flex items-center gap-4 rounded-2xl border border-pink-100 bg-pink-50 p-4 transition hover:border-pink-300 hover:bg-pink-100"
          >
            {flyer?.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={flyer.coverImage} alt="" className="h-20 w-16 flex-shrink-0 rounded-lg object-cover shadow-sm" />
            ) : (
              <span className="text-3xl">📄</span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-gray-900">{t('flyer.browseWeekly')}</p>
              <p className="mt-0.5 text-xs text-gray-500">
                {t('flyer.pageByPage', { store: store.nameAr })}{flyer?.totalPages ? ` — ${t('flyer.pages', { n: flyer.totalPages })}` : ''}
              </p>
            </div>
            <svg className="h-5 w-5 flex-shrink-0 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
        )}

        {offers.length === 0 ? (
          <p className="rounded-xl border border-gray-100 bg-white py-14 text-center text-gray-500">
            {t('home.ae.noOffers')}
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
