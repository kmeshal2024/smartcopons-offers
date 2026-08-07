import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import FlyerScreen from '@/components/FlyerScreen'
import type { Metadata } from 'next'
import { formatDateAr, formatRangeAr, getValidity } from '@/lib/flyer-utils'
import { getFlyerBySlugDate } from '@/lib/flyer-query'
import { COUNTRIES, urlFor } from '@/lib/countries'
import { getLang } from '@/lib/i18n-server'
import { dirOf } from '@/lib/i18n'

const COUNTRY = COUNTRIES.AE

interface Props {
  params: Promise<{ slug: string; date: string }>
}

export const revalidate = 300

/**
 * UAE weekly flyer, scoped to AE so "carrefour"/"lulu" resolve to the Emirati
 * store rather than the Saudi one that shares the slug. Mirrors /flyers but
 * pins the market to AE.
 */
async function getAeFlyer(slug: string, date: string) {
  const flyer = await getFlyerBySlugDate(slug, date)
  if (!flyer || flyer.supermarket.country !== COUNTRY.code) return null
  return flyer
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, date } = await params
  const flyer = await getAeFlyer(slug, date)
  if (!flyer) notFound()

  const store = flyer.supermarket.nameAr
  const dateAr = formatDateAr(flyer.startDate)
  const title = `عروض ${store} ${dateAr} في الإمارات | نشرة الأسبوع`
  const validity = getValidity(flyer.startDate, flyer.endDate)
  const canonical = urlFor('AE', `/flyers/${slug}/${date}`)

  return {
    title,
    description:
      `تصفّح نشرة عروض ${store} الأسبوعية في الإمارات (${formatRangeAr(flyer.startDate, flyer.endDate)}) ` +
      `صفحة بصفحة. عروض بالدرهم على المنتجات الغذائية والمنزلية.`,
    keywords: `عروض ${store}, نشرة ${store}, عروض ${store} الامارات, ${flyer.supermarket.name} flyer UAE`,
    alternates: { canonical },
    robots: validity.isExpired ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description: `نشرة ${store} — ${formatRangeAr(flyer.startDate, flyer.endDate)}`,
      locale: 'ar_AE',
      type: 'article',
      url: canonical,
      ...(flyer.coverImage && { images: [flyer.coverImage] }),
    },
  }
}

export default async function AeWeeklyFlyerPage({ params }: Props) {
  const { slug, date } = await params
  const flyer = await getAeFlyer(slug, date)
  if (!flyer) notFound()

  const store = flyer.supermarket.nameAr
  const dateAr = formatDateAr(flyer.startDate)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SpecialAnnouncement',
    name: `عروض ${store} ${dateAr}`,
    text: `نشرة عروض ${store} الأسبوعية في الإمارات — ${formatRangeAr(flyer.startDate, flyer.endDate)}`,
    datePosted: new Date(flyer.startDate).toISOString(),
    expires: new Date(flyer.endDate).toISOString(),
    category: 'https://www.wikidata.org/wiki/Q2135',
    url: urlFor('AE', `/flyers/${slug}/${date}`),
    announcementLocation: {
      '@type': 'LocalBusiness',
      name: store,
      address: { '@type': 'PostalAddress', addressCountry: 'AE' },
    },
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={dirOf(getLang())}>
      <Header />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <FlyerScreen flyer={flyer} country="AE" />
      <Footer />
    </div>
  )
}
