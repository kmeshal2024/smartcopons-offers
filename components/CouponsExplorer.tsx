'use client'

import { useMemo, useState } from 'react'
import { useI18n } from '@/components/I18nProvider'

export interface ExplorerCoupon {
  id: string
  title: string
  code: string
  discountText: string
  isExclusive?: boolean
  storeName: string
  storeSlug: string
  storeLogo?: string | null
}

/**
 * Interactive coupon browser: store chips + text search, results grouped by
 * store. Rendered from a server page with the full list as props, so the
 * initial HTML still carries every coupon for SEO — interactivity is an
 * enhancement, not a data dependency.
 */
export default function CouponsExplorer({ coupons }: { coupons: ExplorerCoupon[] }) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [activeStore, setActiveStore] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const stores = useMemo(() => {
    const map = new Map<string, { slug: string; name: string; logo?: string | null; count: number }>()
    for (const c of coupons) {
      const s = map.get(c.storeSlug)
      if (s) s.count++
      else map.set(c.storeSlug, { slug: c.storeSlug, name: c.storeName, logo: c.storeLogo, count: 1 })
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ar'))
  }, [coupons])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = coupons.filter(c => {
      if (activeStore && c.storeSlug !== activeStore) return false
      if (!q) return true
      return (
        c.storeName.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q)
      )
    })
    const bySlug = new Map<string, ExplorerCoupon[]>()
    for (const c of filtered) {
      const list = bySlug.get(c.storeSlug)
      if (list) list.push(c)
      else bySlug.set(c.storeSlug, [c])
    }
    // keep the store-popularity order
    return stores
      .filter(s => bySlug.has(s.slug))
      .map(s => ({ store: s, coupons: bySlug.get(s.slug)! }))
  }, [coupons, stores, query, activeStore])

  const handleCopy = (id: string, code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div>
      {/* Search */}
      <div className="relative mb-4">
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('couponsPage.search')}
          className="w-full rounded-xl border border-gray-200 bg-white py-3 ps-11 pe-4 text-sm shadow-sm outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
        />
        <svg
          className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
        </svg>
      </div>

      {/* Store chips */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveStore(null)}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
            activeStore === null
              ? 'bg-pink-600 text-white shadow-sm'
              : 'border border-gray-200 bg-white text-gray-600 hover:border-pink-300 hover:text-pink-700'
          }`}
        >
          {t('couponsPage.all')} ({coupons.length})
        </button>
        {stores.map(s => (
          <button
            key={s.slug}
            onClick={() => setActiveStore(activeStore === s.slug ? null : s.slug)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
              activeStore === s.slug
                ? 'bg-pink-600 text-white shadow-sm'
                : 'border border-gray-200 bg-white text-gray-600 hover:border-pink-300 hover:text-pink-700'
            }`}
          >
            {s.logo ? (
              <img src={s.logo} alt="" className="h-4 w-4 rounded object-contain" />
            ) : (
              <span aria-hidden>🏷️</span>
            )}
            {s.name}
            {s.count > 1 && <span className="opacity-60">({s.count})</span>}
          </button>
        ))}
      </div>

      {/* Grouped results */}
      {groups.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-10 text-center text-gray-400">
          <span className="mb-3 block text-5xl">🔍</span>
          <p>{t('couponsPage.noResults')}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(({ store, coupons: list }) => (
            <section key={store.slug}>
              <div className="mb-3 flex items-center gap-2.5">
                {store.logo ? (
                  <img src={store.logo} alt={store.name} className="h-8 w-8 rounded-lg object-contain" />
                ) : (
                  <span className="text-2xl" aria-hidden>🏷️</span>
                )}
                <h2 className="text-lg font-bold text-gray-900">{store.name}</h2>
                <span className="rounded-full bg-pink-50 px-2.5 py-0.5 text-xs font-semibold text-pink-700">
                  {t('couponsPage.nCodes', { n: list.length })}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {list.map(c => (
                  <div
                    key={c.id}
                    className="relative flex flex-col items-center rounded-2xl border border-gray-100 bg-white p-5 text-center shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {c.isExclusive && (
                      <span className="absolute top-3 start-3 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                        {t('couponsPage.exclusive')}
                      </span>
                    )}

                    {c.storeLogo ? (
                      <img
                        src={c.storeLogo}
                        alt={c.storeName}
                        className="mb-3 h-16 w-16 rounded-2xl object-contain shadow-sm"
                      />
                    ) : (
                      <span className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-50 text-3xl" aria-hidden>
                        🏷️
                      </span>
                    )}

                    <div className="text-xs font-semibold text-gray-400">{c.storeName}</div>
                    <div className="mt-1 text-xl font-extrabold text-pink-700">{c.discountText}</div>
                    <div className="mt-0.5 line-clamp-1 text-sm text-gray-500">{c.title}</div>

                    <div className="mt-4 w-full rounded-lg border border-dashed border-pink-300 bg-gray-50 px-3 py-2.5 text-center font-mono text-base font-bold text-pink-700">
                      {c.code}
                    </div>
                    <button
                      onClick={() => handleCopy(c.id, c.code)}
                      className={`mt-2 w-full rounded-lg py-2.5 text-sm font-semibold transition-all active:scale-95 ${
                        copiedId === c.id
                          ? 'bg-green-500 text-white'
                          : 'bg-pink-600 text-white hover:bg-pink-700'
                      }`}
                    >
                      {copiedId === c.id ? t('home.coupons.copied') : t('common.copy')}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
