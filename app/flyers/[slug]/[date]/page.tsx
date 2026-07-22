import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import FlyerViewer from '@/components/FlyerViewer'
import ProductCard from '@/components/ProductCard'
import Link from 'next/link'
import type { Metadata } from 'next'
import { formatDateAr, formatRangeAr, getValidity } from '@/lib/flyer-utils'

interface Props {
  params: Promise<{ slug: string; date: string }>
}

export const revalidate = 300

/** Match a flyer by retailer slug + the YYYY-MM-DD of its start date. */
async function getFlyer(slug: string, date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null

  const dayStart = new Date(`${date}T00:00:00.000Z`)
  if (Number.isNaN(dayStart.getTime())) return null
  const dayEnd = new Date(dayStart)
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)

  return prisma.flyer.findFirst({
    where: {
      supermarket: { slug },
      startDate: { gte: dayStart, lt: dayEnd },
    },
    include: {
      supermarket: { select: { nameAr: true, name: true, slug: true, logo: true } },
      productOffers: {
        where: { isHidden: false },
        take: 24,
        orderBy: { discountPercent: 'desc' },
        include: {
          supermarket: { select: { nameAr: true, slug: true, logo: true } },
          category: { select: { nameAr: true, icon: true } },
        },
      },
      _count: { select: { productOffers: { where: { isHidden: false } } } },
    },
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, date } = await params
  const flyer = await getFlyer(slug, date)
  if (!flyer) return { title: 'النشرة غير متاحة' }

  const store = flyer.supermarket.nameAr
  const dateAr = formatDateAr(flyer.startDate)
  const title = `عروض ${store} ${dateAr} | نشرة الأسبوع`
  const validity = getValidity(flyer.startDate, flyer.endDate)

  return {
    title,
    description:
      `تصفّح نشرة عروض ${store} الأسبوعية (${formatRangeAr(flyer.startDate, flyer.endDate)}) ` +
      `صفحة بصفحة. ${flyer._count.productOffers} عرضاً على المنتجات الغذائية والمنزلية في السعودية.`,
    keywords: `عروض ${store}, نشرة ${store}, عروض ${store} الاسبوعية, ${flyer.supermarket.name} flyer, عروض السعودية`,
    alternates: { canonical: `https://sa.smartcopons.com/flyers/${slug}/${date}` },
    // An expired flyer stays reachable for its permalink but shouldn't compete
    // in the index with the current week's page.
    robots: validity.isExpired ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description: `نشرة ${store} — ${formatRangeAr(flyer.startDate, flyer.endDate)}`,
      locale: 'ar_SA',
      type: 'article',
      url: `https://sa.smartcopons.com/flyers/${slug}/${date}`,
      ...(flyer.coverImage && { images: [flyer.coverImage] }),
    },
  }
}

export default async function WeeklyFlyerPage({ params }: Props) {
  const { slug, date } = await params
  const flyer = await getFlyer(slug, date)
  if (!flyer) notFound()

  const store = flyer.supermarket.nameAr
  const validity = getValidity(flyer.startDate, flyer.endDate)
  const dateAr = formatDateAr(flyer.startDate)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SpecialAnnouncement',
    name: `عروض ${store} ${dateAr}`,
    text: `نشرة عروض ${store} الأسبوعية — ${formatRangeAr(flyer.startDate, flyer.endDate)}`,
    datePosted: new Date(flyer.startDate).toISOString(),
    expires: new Date(flyer.endDate).toISOString(),
    category: 'https://www.wikidata.org/wiki/Q2135',
    url: `https://sa.smartcopons.com/flyers/${slug}/${date}`,
    announcementLocation: {
      '@type': 'LocalBusiness',
      name: store,
      address: { '@type': 'PostalAddress', addressCountry: 'SA' },
    },
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="container mx-auto px-4 py-5">
        {/* Breadcrumb */}
        <nav className="mb-4 text-xs text-gray-500">
          <Link href="/" className="hover:text-pink-600">الرئيسية</Link>
          <span className="mx-1.5">/</span>
          <Link href={`/offers/${slug}`} className="hover:text-pink-600">عروض {store}</Link>
          <span className="mx-1.5">/</span>
          <span className="text-gray-700">نشرة {dateAr}</span>
        </nav>

        <div className="mb-5 flex flex-wrap items-center gap-3">
          {flyer.supermarket.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={flyer.supermarket.logo} alt={store} className="h-10 w-10 rounded-full bg-white object-contain p-1 shadow-sm" />
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900">عروض {store} — {dateAr}</h1>
            <p className="text-sm text-gray-500">{formatRangeAr(flyer.startDate, flyer.endDate)}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${validity.badgeClass}`}>
            {validity.label}
          </span>
        </div>

        {flyer.pdfUrl ? (
          <div className="mb-6">
            <FlyerViewer
              pdfUrl={flyer.pdfUrl}
              title={flyer.titleAr || flyer.title}
              startDate={flyer.startDate as unknown as string}
              endDate={flyer.endDate as unknown as string}
            />
          </div>
        ) : (
          <div className="mb-6 rounded-xl border border-gray-200 bg-white px-4 py-8 text-center">
            <p className="text-sm text-gray-500">لا توجد نشرة متاحة حالياً</p>
            <p className="mt-1 text-xs text-gray-400">تصفّح العروض أدناه</p>
          </div>
        )}

        {flyer.productOffers.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">
                أبرز عروض هذه النشرة
                <span className="mr-2 text-sm font-normal text-gray-400">({flyer._count.productOffers})</span>
              </h2>
              <Link href={`/offers/${slug}`} className="text-sm font-semibold text-pink-600 hover:text-pink-700">
                كل عروض {store}
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {flyer.productOffers.map(p => (
                <ProductCard
                  key={p.id}
                  product={{ ...p, flyer: { startDate: flyer.startDate, endDate: flyer.endDate } }}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  )
}
