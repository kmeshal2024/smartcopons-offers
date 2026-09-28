'use client'

import { useEffect, useMemo, useState } from 'react'
import AdminNav from '@/components/AdminNav'

interface CouponStat {
  id: string
  code: string
  store: string
  storeSlug: string
  discountText: string
  hasAffiliateUrl: boolean
  isExclusive: boolean
  today: number
  last7: number
  last30: number
  total: number
  lastCopied: string | null
  surfaces30: Record<string, number>
}

interface Stats {
  today: string
  tableMissing: boolean
  totals: {
    activeCodes: number
    codesCopiedLast30: number
    today: number
    last7: number
    last30: number
    total: number
  }
  bySurface30: Record<string, number>
  coupons: CouponStat[]
}

const SURFACE_LABELS: Record<string, string> = {
  coupon_store_page: 'Store coupon page',
  coupons_explorer: 'Coupons list',
  coupon_card: 'Coupon card',
  offers_page: 'Offers page strip',
  retailer_page: 'Retailer page',
  shopping_list: 'Shopping list',
  product_page: 'Product page',
  category_page: 'Category page',
  home: 'Homepage featured row',
}

type SortKey = 'last30' | 'last7' | 'today' | 'total'

export default function CouponStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState('')
  const [sort, setSort] = useState<SortKey>('last30')
  const [onlyUnused, setOnlyUnused] = useState(false)

  useEffect(() => {
    fetch('/api/admin/coupon-stats')
      .then(async r => {
        if (r.status === 401) {
          window.location.href = '/admin/login'
          return
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        setStats(await r.json())
      })
      .catch(e => setError(String(e?.message || e)))
  }, [])

  const rows = useMemo(() => {
    if (!stats) return []
    const list = onlyUnused ? stats.coupons.filter(c => c.last30 === 0) : stats.coupons
    return [...list].sort((a, b) => b[sort] - a[sort] || a.store.localeCompare(b.store))
  }, [stats, sort, onlyUnused])

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="mb-1 text-2xl font-bold text-gray-900">Coupon copies</h1>
        <p className="mb-5 text-sm text-gray-500">
          Counted on this site, per code per day. Repeat copies by the same person are not
          de-duplicated, so read these as relative figures. Counting began when this page
          was deployed — there is no history before that.
        </p>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!stats && !error && <p className="text-sm text-gray-400">Loading…</p>}

        {stats?.tableMissing && (
          <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            The coupon_copies table does not exist yet. Run POST
            /api/admin/migrate-coupon-copies.
          </p>
        )}

        {stats && (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ['Today', stats.totals.today],
                ['Last 7 days', stats.totals.last7],
                ['Last 30 days', stats.totals.last30],
                ['All time', stats.totals.total],
                ['Codes copied (30d)', `${stats.totals.codesCopiedLast30} / ${stats.totals.activeCodes}`],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="text-xs text-gray-500">{label}</div>
                  <div className="text-xl font-bold text-gray-900">{value}</div>
                </div>
              ))}
            </div>

            <div className="mb-5 rounded-lg border border-gray-200 bg-white p-3">
              <div className="mb-2 text-xs font-semibold text-gray-500">Copies by surface, last 30 days</div>
              {Object.keys(stats.bySurface30).length === 0 ? (
                <p className="text-sm text-gray-400">No copies recorded yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stats.bySurface30)
                    .sort((a, b) => b[1] - a[1])
                    .map(([s, v]) => (
                      <span key={s} className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
                        {SURFACE_LABELS[s] || s}: <b>{v}</b>
                      </span>
                    ))}
                </div>
              )}
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-gray-500">Sort by</span>
              {(['last30', 'last7', 'today', 'total'] as SortKey[]).map(k => (
                <button
                  key={k}
                  onClick={() => setSort(k)}
                  className={`rounded-full px-3 py-1 font-semibold ${
                    sort === k ? 'bg-pink-600 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200'
                  }`}
                >
                  {k === 'last30' ? '30 days' : k === 'last7' ? '7 days' : k === 'today' ? 'Today' : 'All time'}
                </button>
              ))}
              <label className="ms-auto flex items-center gap-2 text-gray-600">
                <input type="checkbox" checked={onlyUnused} onChange={e => setOnlyUnused(e.target.checked)} />
                Only codes with no copies in 30 days
              </label>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Store</th>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Discount</th>
                    <th className="px-3 py-2 text-right">Today</th>
                    <th className="px-3 py-2 text-right">7d</th>
                    <th className="px-3 py-2 text-right">30d</th>
                    <th className="px-3 py-2 text-right">All</th>
                    <th className="px-3 py-2">Last copied</th>
                    <th className="px-3 py-2">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(c => (
                    <tr key={c.id} className={c.last30 === 0 ? 'text-gray-400' : ''}>
                      <td className="px-3 py-2" dir="auto">
                        <a href={`/coupons/${c.storeSlug}`} target="_blank" rel="noreferrer" className="hover:underline">
                          {c.store}
                        </a>
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold">{c.code}</td>
                      <td className="px-3 py-2" dir="auto">{c.discountText}</td>
                      <td className="px-3 py-2 text-right">{c.today}</td>
                      <td className="px-3 py-2 text-right">{c.last7}</td>
                      <td className="px-3 py-2 text-right font-bold">{c.last30}</td>
                      <td className="px-3 py-2 text-right">{c.total}</td>
                      <td className="px-3 py-2">{c.lastCopied || '—'}</td>
                      <td className="px-3 py-2">{c.hasAffiliateUrl ? 'affiliate' : 'store site'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
