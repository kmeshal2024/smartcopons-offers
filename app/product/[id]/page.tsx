import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ProductCard from '@/components/ProductCard'
import ExpiryBadge from '@/components/ExpiryBadge'
import { getValidity, formatRangeAr } from '@/lib/flyer-utils'
import { arabicContainsFilter } from '@/lib/arabic-search'

interface Props {
  params: Promise<{ id: string }>
}

export const revalidate = 300

async function getProduct(id: string) {
  return prisma.productOffer.findFirst({
    // price 0 rows are flyer placeholders, not products — no page for them.
    where: { id, isHidden: false, price: { gt: 0 } },
    include: {
      supermarket: { select: { id: true, nameAr: true, name: true, slug: true, logo: true } },
      category: { select: { nameAr: true, slug: true, icon: true } },
      flyer: { select: { startDate: true, endDate: true, supermarketId: true } },
    },
  })
}

/**
 * The same item is usually sold by several retailers. Listing those side by
 * side is what makes a product page worth indexing — without it each page
 * would just restate one price.
 */
async function getPriceComparison(name: string, excludeId: string) {
  const term = name.trim().slice(0, 40)
  if (term.length < 4) return []

  const rows = await prisma.productOffer.findMany({
    where: {
      isHidden: false,
      id: { not: excludeId },
      flyer: { endDate: { gte: new Date() } },
      OR: arabicContainsFilter(term, ['nameAr', 'nameEn']),
    },
    select: {
      id: true,
      price: true,
      oldPrice: true,
      discountPercent: true,
      supermarket: { select: { nameAr: true, slug: true, logo: true } },
      flyer: { select: { endDate: true } },
    },
    orderBy: { price: 'asc' },
    take: 20,
  })

  // One row per retailer — the cheapest current price they offer.
  const perStore = new Map<string, (typeof rows)[number]>()
  for (const r of rows) {
    const key = r.supermarket.slug
    if (!perStore.has(key)) perStore.set(key, r)
  }
  return Array.from(perStore.values()).slice(0, 6)
}

async function getRelated(categoryId: string | null, excludeId: string) {
  if (!categoryId) return []
  return prisma.productOffer.findMany({
    where: {
      categoryId,
      isHidden: false,
      id: { not: excludeId },
      flyer: { endDate: { gte: new Date() } },
    },
    include: {
      supermarket: { select: { nameAr: true, slug: true, logo: true } },
      category: { select: { nameAr: true, icon: true } },
      flyer: { select: { startDate: true, endDate: true } },
    },
    orderBy: { discountPercent: 'desc' },
    take: 8,
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const p = await getProduct(id)
  if (!p) return { title: 'المنتج غير متاح' }

  const name = p.nameAr || p.nameEn || 'منتج'
  const store = p.supermarket.nameAr
  const validity = getValidity(p.flyer?.startDate, p.flyer?.endDate)
  const priceStr = `${p.price.toFixed(2)} ر.س`

  const title = `${name} — سعر ${priceStr} في ${store}`
  const desc = p.discountPercent
    ? `${name} بسعر ${priceStr} في ${store} (خصم ${p.discountPercent}%). قارن السعر مع باقي المتاجر في السعودية ووفّر أكثر.`
    : `${name} بسعر ${priceStr} في ${store}. قارن السعر مع باقي المتاجر في السعودية ووفّر أكثر.`

  return {
    title,
    description: desc,
    keywords: `${name}, سعر ${name}, ${name} ${store}, عروض ${store}, ${p.brand || ''}`.trim(),
    alternates: { canonical: `https://sa.smartcopons.com/product/${p.id}` },
    // An ended offer keeps its permalink but must not compete in the index —
    // a stale price is the one thing a price-comparison page must never rank on.
    robots: validity.isExpired ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description: desc,
      locale: 'ar_SA',
      type: 'website',
      url: `https://sa.smartcopons.com/product/${p.id}`,
      ...(p.imageUrl && { images: [p.imageUrl] }),
    },
  }
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params
  const p = await getProduct(id)
  if (!p) notFound()

  const name = p.nameAr || p.nameEn || 'منتج'
  const validity = getValidity(p.flyer?.startDate, p.flyer?.endDate)
  const [comparison, related] = await Promise.all([
    getPriceComparison(name, p.id),
    getRelated(p.categoryId, p.id),
  ])

  // Cheapest across this offer + the comparison rows.
  const allPrices = [p.price, ...comparison.map(c => c.price)]
  const cheapest = Math.min(...allPrices)
  const isCheapestHere = p.price === cheapest

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    ...(p.imageUrl && { image: p.imageUrl }),
    ...(p.brand && { brand: { '@type': 'Brand', name: p.brand } }),
    ...(p.category?.nameAr && { category: p.category.nameAr }),
    description: `${name}${p.sizeText ? ` — ${p.sizeText}` : ''}`,
    offers:
      comparison.length > 0
        ? {
            '@type': 'AggregateOffer',
            priceCurrency: 'SAR',
            lowPrice: cheapest,
            highPrice: Math.max(...allPrices),
            offerCount: allPrices.length,
            offers: [
              { price: p.price, seller: p.supermarket.nameAr, endDate: p.flyer?.endDate },
              ...comparison.map(c => ({
                price: c.price,
                seller: c.supermarket.nameAr,
                endDate: c.flyer?.endDate,
              })),
            ].map(o => ({
              '@type': 'Offer',
              price: o.price,
              priceCurrency: 'SAR',
              availability: 'https://schema.org/InStock',
              itemCondition: 'https://schema.org/NewCondition',
              seller: { '@type': 'Organization', name: o.seller },
              ...(o.endDate && {
                priceValidUntil: new Date(o.endDate).toISOString().split('T')[0],
              }),
            })),
          }
        : {
            '@type': 'Offer',
            price: p.price,
            priceCurrency: 'SAR',
            availability: 'https://schema.org/InStock',
            itemCondition: 'https://schema.org/NewCondition',
            seller: { '@type': 'Organization', name: p.supermarket.nameAr },
            ...(p.flyer?.endDate && {
              priceValidUntil: new Date(p.flyer.endDate).toISOString().split('T')[0],
            }),
          },
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="container mx-auto px-4 py-5">
        <nav className="mb-4 text-xs text-gray-500">
          <Link href="/" className="hover:text-pink-600">الرئيسية</Link>
          <span className="mx-1.5">/</span>
          <Link href={`/offers/${p.supermarket.slug}`} className="hover:text-pink-600">
            عروض {p.supermarket.nameAr}
          </Link>
          {p.category && (
            <>
              <span className="mx-1.5">/</span>
              <Link href={`/offers/category/${p.category.slug}`} className="hover:text-pink-600">
                {p.category.nameAr}
              </Link>
            </>
          )}
        </nav>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Image */}
          <div className="flex items-center justify-center rounded-xl border border-gray-100 bg-white p-6">
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt={name} className="max-h-80 w-auto object-contain" />
            ) : (
              <div className="flex h-64 w-full items-center justify-center text-gray-300">
                <span className="text-6xl">🛒</span>
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            {p.brand && <p className="mb-1 text-sm text-gray-400">{p.brand}</p>}
            <h1 className="mb-2 text-xl font-bold text-gray-900 sm:text-2xl">{name}</h1>
            {p.sizeText && <p className="mb-3 text-sm text-gray-500">{p.sizeText}</p>}

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <ExpiryBadge validFrom={p.flyer?.startDate as any} validTo={p.flyer?.endDate as any} size="md" />
              {isCheapestHere && comparison.length > 0 && (
                <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">
                  الأرخص 🏆
                </span>
              )}
            </div>

            <div className="mb-4 flex items-baseline gap-3">
              <span className="text-3xl font-extrabold text-pink-700">{p.price.toFixed(2)}</span>
              <span className="text-sm text-gray-400">ر.س</span>
              {p.oldPrice && p.oldPrice > p.price && (
                <span className="text-lg text-gray-400 line-through">{p.oldPrice.toFixed(2)}</span>
              )}
              {p.discountPercent ? (
                <span className="rounded-md bg-red-100 px-2 py-0.5 text-sm font-bold text-red-600">
                  -{p.discountPercent}%
                </span>
              ) : null}
            </div>

            <div className="mb-4 flex items-center gap-2 rounded-lg border border-gray-100 bg-white p-3">
              {p.supermarket.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.supermarket.logo} alt={p.supermarket.nameAr} className="h-8 w-8 rounded-full object-contain" />
              )}
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-800">{p.supermarket.nameAr}</div>
                {p.flyer && (
                  <div className="text-[11px] text-gray-400">
                    {formatRangeAr(p.flyer.startDate, p.flyer.endDate)}
                  </div>
                )}
              </div>
            </div>

            <Link
              href={`/offers/${p.supermarket.slug}`}
              className="inline-block rounded-full bg-pink-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-pink-700"
            >
              كل عروض {p.supermarket.nameAr}
            </Link>
          </div>
        </div>

        {/* Cross-store comparison — the reason this page is worth indexing */}
        {comparison.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 font-bold text-gray-900">
              مقارنة السعر في متاجر أخرى
              <span className="mr-2 text-sm font-normal text-gray-400">({comparison.length + 1} متاجر)</span>
            </h2>
            <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
              <table className="w-full text-right text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">المتجر</th>
                    <th className="px-4 py-2.5 font-semibold">السعر</th>
                    <th className="px-4 py-2.5 font-semibold">الفرق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[{ here: true, ...p }, ...comparison.map(c => ({ here: false, ...c }))]
                    .sort((a, b) => a.price - b.price)
                    .map((row: any) => {
                      const diff = +(row.price - cheapest).toFixed(2)
                      return (
                        <tr key={row.id} className={row.price === cheapest ? 'bg-emerald-50/50' : ''}>
                          <td className="px-4 py-2.5">
                            <span className="font-medium text-gray-800">{row.supermarket.nameAr}</span>
                            {row.here && <span className="mr-2 text-[10px] text-gray-400">(هذه الصفحة)</span>}
                          </td>
                          <td className="px-4 py-2.5 font-bold text-gray-900">{row.price.toFixed(2)} ر.س</td>
                          <td className="px-4 py-2.5">
                            {diff === 0 ? (
                              <span className="font-semibold text-emerald-600">الأرخص</span>
                            ) : (
                              <span className="text-red-500">+{diff.toFixed(2)}</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {related.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 font-bold text-gray-900">
              عروض مشابهة{p.category ? ` في ${p.category.nameAr}` : ''}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {related.map(r => (
                <ProductCard key={r.id} product={r} />
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  )
}
