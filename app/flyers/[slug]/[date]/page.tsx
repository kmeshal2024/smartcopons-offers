import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import FlyerScreen from '@/components/FlyerScreen'
import type { Metadata } from 'next'
import { formatDateAr, formatRangeAr, getValidity } from '@/lib/flyer-utils'
import { getFlyerBySlugDate } from '@/lib/flyer-query'
import { resolveCountry, urlFor } from '@/lib/countries'
import { getLang } from '@/lib/i18n-server'
import { dirOf } from '@/lib/i18n'

interface Props {
  params: Promise<{ slug: string; date: string }>
}

export const revalidate = 300

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, date } = await params
  const flyer = await getFlyerBySlugDate(slug, date)
  // Signal the 404 from metadata too. Returning a plain title here let the
  // render complete with a 200, so a bad slug served a "not found" page that
  // search engines read as a real page (a soft 404).
  if (!flyer) notFound()

  const country = resolveCountry(flyer.supermarket.country)
  const store = flyer.supermarket.nameAr
  const dateAr = formatDateAr(flyer.startDate)
  const title = `عروض ${store} ${dateAr} | نشرة الأسبوع`
  const validity = getValidity(flyer.startDate, flyer.endDate)
  // Canonical follows the store's own market — a UAE flyer reached via /flyers
  // canonicalises to smartcopons.com/ae/flyers, so it never competes with or
  // mislabels itself as a Saudi page.
  const canonical = urlFor(country.code, `/flyers/${slug}/${date}`)

  return {
    title,
    description:
      `تصفّح نشرة عروض ${store} الأسبوعية (${formatRangeAr(flyer.startDate, flyer.endDate)}) ` +
      `صفحة بصفحة. ${flyer._count.productOffers} عرضاً على المنتجات الغذائية والمنزلية في ${country.nameAr}.`,
    keywords: `عروض ${store}, نشرة ${store}, عروض ${store} الاسبوعية, ${flyer.supermarket.name} flyer, عروض ${country.nameAr}`,
    alternates: { canonical },
    robots: validity.isExpired ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description: `نشرة ${store} — ${formatRangeAr(flyer.startDate, flyer.endDate)}`,
      locale: country.locale.replace('-', '_'),
      type: 'article',
      url: canonical,
      ...(flyer.coverImage && { images: [flyer.coverImage] }),
    },
  }
}

export default async function WeeklyFlyerPage({ params }: Props) {
  const { slug, date } = await params
  const flyer = await getFlyerBySlugDate(slug, date)
  if (!flyer) notFound()

  const country = resolveCountry(flyer.supermarket.country)
  const store = flyer.supermarket.nameAr
  const dateAr = formatDateAr(flyer.startDate)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SpecialAnnouncement',
    name: `عروض ${store} ${dateAr}`,
    text: `نشرة عروض ${store} الأسبوعية — ${formatRangeAr(flyer.startDate, flyer.endDate)}`,
    datePosted: new Date(flyer.startDate).toISOString(),
    expires: new Date(flyer.endDate).toISOString(),
    category: 'https://www.wikidata.org/wiki/Q2135',
    url: urlFor(country.code, `/flyers/${slug}/${date}`),
    announcementLocation: {
      '@type': 'LocalBusiness',
      name: store,
      address: { '@type': 'PostalAddress', addressCountry: country.code },
    },
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={dirOf(getLang())}>
      <Header />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <FlyerScreen flyer={flyer} country={country.code} />
      <Footer />
    </div>
  )
}
