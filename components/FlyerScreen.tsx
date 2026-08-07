import Link from 'next/link'
import FlyerViewer from '@/components/FlyerViewer'
import ImageFlyerViewer from '@/components/ImageFlyerViewer'
import ProductCard from '@/components/ProductCard'
import { formatDateAr, formatRangeAr, getValidity } from '@/lib/flyer-utils'
import { parsePageImages, type FlyerWithStore } from '@/lib/flyer-query'
import { pathFor, type CountryCode } from '@/lib/countries'
import { getLang } from '@/lib/i18n-server'
import { t as translate } from '@/lib/i18n'

/**
 * The flyer page body, shared by the Saudi (/flyers) and UAE (/ae/flyers)
 * routes so the two markets stay in lock-step. Picks the viewer by asset:
 * page images (ImageFlyerViewer) → PDF (FlyerViewer) → an empty state.
 */
export default function FlyerScreen({ flyer, country }: { flyer: FlyerWithStore; country: CountryCode }) {
  const lang = getLang()
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars)
  const store = flyer.supermarket.nameAr
  const validity = getValidity(flyer.startDate, flyer.endDate, undefined, lang)
  const dateAr = formatDateAr(flyer.startDate)
  const pageImages = parsePageImages((flyer as any).pageImages)

  const homeHref = pathFor(country, '/')
  const storeHref = country === 'AE' ? pathFor('AE', `/store/${flyer.supermarket.slug}`) : `/offers/${flyer.supermarket.slug}`

  return (
    <main className="container mx-auto px-4 py-5">
      {/* Breadcrumb */}
      <nav className="mb-4 text-xs text-gray-500">
        <Link href={homeHref} className="hover:text-pink-600">{t('nav.home')}</Link>
        <span className="mx-1.5">/</span>
        <Link href={storeHref} className="hover:text-pink-600">{t('common.offersOf', { name: store })}</Link>
        <span className="mx-1.5">/</span>
        <span className="text-gray-700">{t('flyer.breadcrumb', { date: dateAr })}</span>
      </nav>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        {flyer.supermarket.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={flyer.supermarket.logo} alt={store} className="h-10 w-10 rounded-full bg-white object-contain p-1 shadow-sm" />
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900">{t('flyer.headingOf', { store, date: dateAr })}</h1>
          <p className="text-sm text-gray-500">{formatRangeAr(flyer.startDate, flyer.endDate)}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${validity.badgeClass}`}>
          {validity.label}
        </span>
      </div>

      {pageImages.length > 0 ? (
        <div className="mb-6">
          <ImageFlyerViewer
            pages={pageImages}
            title={flyer.titleAr || flyer.title}
            startDate={flyer.startDate as unknown as string}
            endDate={flyer.endDate as unknown as string}
          />
        </div>
      ) : flyer.pdfUrl ? (
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
          <p className="text-sm text-gray-500">{t('flyer.none')}</p>
          <p className="mt-1 text-xs text-gray-400">{t('flyer.browseBelow')}</p>
        </div>
      )}

      {flyer.productOffers.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">
              {t('flyer.highlights')}
              <span className="mr-2 text-sm font-normal text-gray-400">({flyer._count.productOffers})</span>
            </h2>
            <Link href={storeHref} className="text-sm font-semibold text-pink-600 hover:text-pink-700">
              {t('flyer.allOffersOf', { store })}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {flyer.productOffers.map(p => (
              <ProductCard
                key={p.id}
                product={{ ...p, flyer: { startDate: flyer.startDate, endDate: flyer.endDate } } as any}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
