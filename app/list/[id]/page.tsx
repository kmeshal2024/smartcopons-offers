import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import AdoptListButton from './AdoptListButton'
import { currencyOf } from '@/lib/countries'
import { getLang } from '@/lib/i18n-server'
import { t as translate, dirOf, formatNumber } from '@/lib/i18n'

interface Props {
  params: Promise<{ id: string }>
}

export interface SharedItem {
  name: string
  price: number
  oldPrice: number | null
  qty: number
  storeName: string | null
}

/**
 * A shared list is NEVER indexable. It can name a household's weekly shop, and
 * the id is the only thing protecting it, so it must not reach a search result.
 * Enforced in three places on purpose: here, in robots.ts, and by omission from
 * every sitemap.
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'قائمة التسوق المشتركة',
    robots: { index: false, follow: false, nocache: true },
  }
}

/**
 * Snapshots are immutable, so this caches on the id effectively forever — a link
 * forwarded to thirty people in a family group costs ONE database read, not
 * thirty. That is what makes the acquisition loop cheap.
 */
const getSharedList = unstable_cache(
  async (id: string) =>
    prisma.sharedList.findUnique({
      where: { id },
      select: {
        id: true,
        itemsJson: true,
        total: true,
        savings: true,
        country: true,
        createdAt: true,
        expiresAt: true,
      },
    }),
  ['shared-list'],
  { revalidate: 86_400, tags: ['shared-lists'] }
)

export default async function SharedListPage({ params }: Props) {
  const { id } = await params
  const list = await getSharedList(id)

  // Expired lists 404 rather than rendering stale prices. The retention sweep
  // deletes them eventually; this makes the boundary immediate and correct even
  // between sweeps.
  if (!list || list.expiresAt < new Date()) return notFound()

  let items: SharedItem[] = []
  try {
    items = JSON.parse(list.itemsJson)
  } catch {
    return notFound()
  }

  const lang = getLang()
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars)
  const CUR = currencyOf(list.country)

  return (
    <div className="min-h-screen bg-gray-50" dir={dirOf(lang)}>
      <Header />

      <main className="container mx-auto max-w-2xl px-4 py-6 pb-28">
        <div className="mb-5 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛒</span>
            <h1 className="text-xl font-bold text-gray-900">{t('sharedList.title')}</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {t('sharedList.subtitle', { n: formatNumber(items.length, lang) })}
          </p>
        </div>

        <ul className="space-y-2">
          {items.map((i, idx) => (
            <li
              key={`${i.name}-${idx}`}
              className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold text-gray-800">{i.name}</p>
                {i.storeName && <p className="truncate text-xs text-gray-400">{i.storeName}</p>}
              </div>
              <div className="flex-shrink-0 text-left">
                <div className="text-sm font-bold text-[#E91E8C]">
                  <bdi>{(i.price * i.qty).toFixed(2)}</bdi> {CUR}
                </div>
                {i.oldPrice && (
                  <del className="text-xs text-gray-400">
                    <bdi>{(i.oldPrice * i.qty).toFixed(2)}</bdi>
                  </del>
                )}
              </div>
              <span className="w-8 flex-shrink-0 text-center text-sm font-semibold text-gray-500">
                ×<bdi>{i.qty}</bdi>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-5 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>{t('cart.total')}</span>
            <span className="text-lg font-extrabold text-gray-900">
              <bdi>{list.total.toFixed(2)}</bdi> {CUR}
            </span>
          </div>
          {list.savings > 0 && (
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-emerald-600">{t('cart.savings')}</span>
              <span className="font-bold text-emerald-600">
                <bdi>{list.savings.toFixed(2)}</bdi> {CUR}
              </span>
            </div>
          )}
        </div>

        {/* The loop closing: the recipient takes the list into their own copy.
            Pure client-side merge into localStorage — no extra database work. */}
        <AdoptListButton items={items} />

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm font-semibold text-pink-600 hover:text-pink-700">
            {t('sharedList.browse')}
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  )
}
