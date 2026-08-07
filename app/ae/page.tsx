import { prisma } from '@/lib/db'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ProductCard from '@/components/ProductCard'
import { COUNTRIES, urlFor } from '@/lib/countries'
import { getLang } from '@/lib/i18n-server'
import { t as translate, dirOf } from '@/lib/i18n'

/**
 * UAE landing page.
 *
 * Served today at /ae on whichever host is pointed at this deployment, and
 * intended to live at smartcopons.com/ae once the apex points at Vercel.
 * Everything reads through COUNTRY.code, so nothing here has to change when
 * that happens — see lib/countries.ts.
 */
const COUNTRY = COUNTRIES.AE

export const metadata: Metadata = {
  title: 'عروض السوبرماركت اليوم في الإمارات | سمارت كوبونز',
  description:
    'أحدث عروض السوبرماركت في الإمارات — كارفور ولولو هايبرماركت. أسعار مخفّضة يومياً بالدرهم على المواد الغذائية والمنزلية.',
  keywords:
    'عروض الامارات, عروض كارفور الامارات, عروض لولو الامارات, تخفيضات دبي, عروض السوبرماركت الامارات, اسعار الامارات',
  alternates: { canonical: urlFor('AE', '/') },
  openGraph: {
    title: 'عروض السوبرماركت اليوم في الإمارات',
    description: 'أفضل العروض والخصومات من كارفور ولولو في الإمارات',
    locale: 'ar_AE',
    type: 'website',
    url: urlFor('AE', '/'),
  },
}

// Same reason as the Saudi pages: Neon auto-suspends, so a build-time render
// can't reach it.
export const dynamic = 'force-dynamic'

async function getData() {
  const now = new Date()
  const [stores, deals, total] = await Promise.all([
    prisma.supermarket.findMany({
      where: { isActive: true, country: COUNTRY.code },
      select: {
        nameAr: true,
        slug: true,
        logo: true,
        _count: {
          select: { productOffers: { where: { isHidden: false, country: COUNTRY.code } } },
        },
      },
    }),
    prisma.productOffer.findMany({
      where: {
        isHidden: false,
        country: COUNTRY.code,
        discountPercent: { gt: 0 },
        flyer: { endDate: { gte: now } },
      },
      include: {
        supermarket: { select: { nameAr: true, slug: true, logo: true } },
        category: { select: { nameAr: true, icon: true } },
        flyer: { select: { startDate: true, endDate: true } },
      },
      orderBy: { discountPercent: 'desc' },
      take: 24,
    }),
    prisma.productOffer.count({
      where: { isHidden: false, country: COUNTRY.code, flyer: { endDate: { gte: now } } },
    }),
  ])
  return { stores, deals, total }
}

export default async function UaeHome() {
  const { stores, deals, total } = await getData()
  const lang = getLang()
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars)

  return (
    <div className="min-h-screen bg-gray-50" dir={dirOf(lang)}>
      <Header />

      <main className="container mx-auto px-4 py-6">
        <section className="mb-8 rounded-2xl bg-gradient-to-l from-[#E91E8C] to-[#f4608f] px-5 py-7 text-white">
          <h1 className="text-xl font-extrabold sm:text-2xl">
            {t('home.ae.hero')}
          </h1>
          <p className="mt-2 text-sm text-white/90">
            {t('home.ae.sub')}
          </p>
          <div className="mt-5 flex gap-8">
            <div>
              <div className="text-2xl font-extrabold">+{total.toLocaleString('en')}</div>
              <div className="text-xs text-white/80">{t('home.stat.offers')}</div>
            </div>
            <div>
              <div className="text-2xl font-extrabold">{stores.length}</div>
              <div className="text-xs text-white/80">{t('home.stat.stores')}</div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold text-gray-900">{t('home.section.stores')}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stores.map(s => (
              <Link
                key={s.slug}
                href={`/ae/store/${s.slug}`}
                className="flex flex-col items-center gap-2 rounded-xl border border-gray-100 bg-white p-4 transition hover:shadow-sm"
              >
                {s.logo ? (
                  <Image
                    src={s.logo}
                    alt={s.nameAr}
                    width={64}
                    height={40}
                    className="h-10 w-16 object-contain"
                  />
                ) : (
                  <span className="text-2xl">🛒</span>
                )}
                <span className="text-sm font-semibold text-gray-800">{s.nameAr}</span>
                <span className="text-xs text-pink-600">
                  {s._count.productOffers.toLocaleString('en')} {t('common.offer')}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">{t('home.ae.topDeals')}</h2>
            <Link href="/ae/offers" className="text-sm font-semibold text-pink-600 hover:underline">
              {t('common.viewAll')}
            </Link>
          </div>
          {deals.length === 0 ? (
            <p className="rounded-xl border border-gray-100 bg-white py-12 text-center text-gray-500">
              {t('home.ae.noOffers')}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {deals.map(p => (
                <ProductCard key={p.id} product={p as any} />
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  )
}
