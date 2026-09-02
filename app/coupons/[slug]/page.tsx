import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import CouponCopyButton from '@/components/CouponCopyButton'
import { getCouponStore, getCouponsData } from '@/lib/coupons'
import { COUPON_STORE_CONTENT } from '@/lib/coupon-store-content'
import { getLang } from '@/lib/i18n-server'
import { t as translate, dirOf, formatNumber } from '@/lib/i18n'

/**
 * The coupon STORE landing page — /coupons/نمشي and friends. These are the
 * revenue/SEO pages: the search demand is brand-level («كود خصم نمشي»), so one
 * strong, content-rich page per store beats thin per-code pages (the previous
 * per-code generation earned 4 clicks from 8,743 impressions before it was
 * retired — that lesson is why this page exists at STORE granularity, with
 * per-code anchors instead of per-code URLs).
 *
 * Everything except the copy buttons is server-rendered: codes, prices, FAQ
 * and schema are real text in the initial HTML.
 */
export const dynamic = 'force-dynamic'

const SITE = 'https://sa.smartcopons.com'

/** «أغسطس 2026» — freshness the title/H1 carry for free. */
function monthYearAr(): string {
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric' }).format(new Date())
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const slug = decodeURIComponent(params.slug)
  const data = await getCouponStore(slug)
  if (!data) return { title: 'كوبونات | سمارت كوبونز' }
  const { store, coupons } = data
  const my = monthYearAr()
  const title = `كود خصم ${store.name} ${my} فعال ومجرب`
  const description = coupons.length
    ? `أحدث أكواد خصم ${store.name} — ${coupons.length} ${coupons.length === 1 ? 'كود فعال' : 'أكواد فعالة'} ومجربة (${coupons
        .slice(0, 3)
        .map(c => c.code)
        .join('، ')}). انسخ الكود ووفّر الآن.`
    : `تابع أحدث أكواد وكوبونات خصم ${store.name} على سمارت كوبونز.`
  return {
    title,
    description,
    alternates: { canonical: `${SITE}/coupons/${encodeURIComponent(store.slug)}` },
    // A store whose codes all lapsed must not sit in the index as an empty page.
    robots: coupons.length ? undefined : { index: false, follow: true },
    openGraph: {
      title: `كود خصم ${store.name} ${my}`,
      description,
      url: `${SITE}/coupons/${encodeURIComponent(store.slug)}`,
      type: 'website',
      locale: 'ar_SA',
      ...(store.logo ? { images: [{ url: store.logo.startsWith('http') ? store.logo : `${SITE}${store.logo}` }] } : {}),
    },
  }
}

export default async function CouponStorePage({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug)
  const data = await getCouponStore(slug)
  if (!data) notFound()
  const { store, coupons } = data
  const lang = getLang()
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars)
  const content = COUPON_STORE_CONTENT[store.slug]
  const my = monthYearAr()
  const pageUrl = `${SITE}/coupons/${encodeURIComponent(store.slug)}`
  const logoAbs = store.logo ? (store.logo.startsWith('http') ? store.logo : `${SITE}${store.logo}`) : undefined

  // Related: most-coupon-rich stores, excluding this one.
  const { stores: allStores } = await getCouponsData('SA')
  const related = allStores
    .filter(s => s.slug !== store.slug && s._count.coupons > 0)
    .sort((a, b) => b._count.coupons - a._count.coupons)
    .slice(0, 8)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'كوبونات', item: `${SITE}/coupons` },
          { '@type': 'ListItem', position: 3, name: `كود خصم ${store.name}`, item: pageUrl },
        ],
      },
      {
        '@type': 'ItemList',
        name: `أكواد خصم ${store.name}`,
        numberOfItems: coupons.length,
        itemListElement: coupons.map((c, i) => ({
          '@type': 'Offer',
          position: i + 1,
          name: c.title,
          description: c.discountText,
          url: `${pageUrl}#${encodeURIComponent(c.code)}`,
          ...(c.validUntil ? { priceValidUntil: new Date(c.validUntil).toISOString().slice(0, 10) } : {}),
          seller: { '@type': 'Organization', name: store.name, ...(logoAbs ? { logo: logoAbs } : {}) },
        })),
      },
    ],
  }

  const updatedAt = coupons.reduce<Date | null>((m, c) => {
    const u = new Date(c.updatedAt as unknown as string)
    return !m || u > m ? u : m
  }, null)

  return (
    <div className="min-h-screen bg-gray-50" dir={dirOf(lang)}>
      <Header />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="container mx-auto max-w-4xl px-4 py-6">
        {/* Breadcrumb */}
        <nav className="mb-4 text-xs text-gray-500">
          <Link href="/" className="hover:text-pink-600">{t('nav.home')}</Link>
          <span className="mx-1.5">/</span>
          <Link href="/coupons" className="hover:text-pink-600">{t('couponsPage.title')}</Link>
          <span className="mx-1.5">/</span>
          <span className="text-gray-700">{store.name}</span>
        </nav>

        {/* Store header */}
        <header className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            {store.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logo} alt={store.name} className="h-16 w-16 rounded-2xl bg-white object-contain p-1 shadow-sm" />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-50 text-3xl">🏷️</span>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold text-gray-900 sm:text-2xl">
                {t('couponStore.h1', { store: store.name, my })}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {t('couponStore.subtitle', { n: formatNumber(coupons.length) })}
                {content?.category ? ` · ${content.category}` : ''}
                {updatedAt ? ` · ${t('couponStore.updated', { date: new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en', { day: 'numeric', month: 'long' }).format(updatedAt) })}` : ''}
              </p>
            </div>
          </div>
          {content?.about && <p className="mt-4 text-sm leading-relaxed text-gray-600">{content.about}</p>}
        </header>

        {/* Codes */}
        {coupons.length === 0 ? (
          <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-10 text-center">
            <span className="mb-3 block text-5xl">⏳</span>
            <p className="font-semibold text-gray-700">{t('couponStore.none', { store: store.name })}</p>
            <Link href="/coupons" className="mt-3 inline-block font-semibold text-pink-600 hover:text-pink-700">
              {t('couponStore.browseAll')}
            </Link>
          </div>
        ) : (
          <section className="mb-8 space-y-4">
            {coupons.map(c => {
              const dest = c.affiliateUrl || store.website || null
              return (
                <article
                  key={c.id}
                  id={encodeURIComponent(c.code)}
                  className="scroll-mt-24 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-extrabold text-pink-700">{c.discountText}</span>
                    {c.isExclusive && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                        {t('couponsPage.exclusive')}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-gray-500">{c.title}</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex-1 rounded-lg border border-dashed border-pink-300 bg-gray-50 px-4 py-2.5 text-center font-mono text-lg font-bold tracking-wider text-pink-700">
                      {c.code}
                    </div>
                    <CouponCopyButton code={c.code} destinationUrl={dest} />
                  </div>
                </article>
              )
            })}
          </section>
        )}

        {/* How to use */}
        <section className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-3 font-bold text-gray-900">{t('couponStore.howTitle', { store: store.name })}</h2>
          <ol className="list-inside list-decimal space-y-2 text-sm leading-relaxed text-gray-600">
            <li>{t('couponStore.how1')}</li>
            <li>{t('couponStore.how2', { store: store.name })}</li>
            <li>{t('couponStore.how3')}</li>
            <li>{t('couponStore.how4')}</li>
          </ol>
        </section>

        {/* FAQ */}
        <section className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-3 font-bold text-gray-900">{t('couponStore.faqTitle')}</h2>
          <div className="space-y-4 text-sm leading-relaxed">
            <div>
              <h3 className="font-semibold text-gray-800">{t('couponStore.q1', { store: store.name })}</h3>
              <p className="mt-1 text-gray-600">{t('couponStore.a1')}</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">{t('couponStore.q2', { store: store.name })}</h3>
              <p className="mt-1 text-gray-600">{t('couponStore.a2', { store: store.name })}</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">{t('couponStore.q3')}</h3>
              <p className="mt-1 text-gray-600">{t('couponStore.a3')}</p>
            </div>
          </div>
        </section>

        {/* Related stores */}
        {related.length > 0 && (
          <section className="mb-4">
            <h2 className="mb-3 font-bold text-gray-900">{t('couponStore.related')}</h2>
            <div className="flex flex-wrap gap-2">
              {related.map(s => (
                <Link
                  key={s.slug}
                  href={`/coupons/${encodeURIComponent(s.slug)}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-600 transition hover:border-pink-300 hover:text-pink-700"
                >
                  {s.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.logo} alt="" className="h-4 w-4 rounded object-contain" />
                  ) : (
                    <span aria-hidden>🏷️</span>
                  )}
                  {s.name}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  )
}
