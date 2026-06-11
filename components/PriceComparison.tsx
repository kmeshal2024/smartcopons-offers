'use client'

import { useEffect, useMemo, useState } from 'react'
import Sparkline from '@/components/Sparkline'
import { formatDateAr, getValidity } from '@/lib/flyer-utils'

interface CompareRow {
  productName: string
  imageUrl?: string | null
  sizeText?: string | null
  supermarket: { id: string; nameAr: string; name: string; slug: string; logo?: string | null }
  price: number
  oldPrice?: number | null
  discountPercent?: number | null
  validUntil?: string | null
  isCheapest: boolean
  diffFromCheapest: number
  history: { date: string; price: number }[]
}

interface CompareResponse {
  query: string
  productName: string
  cheapestPrice: number | null
  storeCount?: number
  rows: CompareRow[]
}

type SortKey = 'price' | 'discount' | 'store'

interface Props {
  /** Initial query. If omitted, a search box is shown. */
  query?: string
  showSearch?: boolean
}

export default function PriceComparison({ query = '', showSearch = true }: Props) {
  const [q, setQ] = useState(query)
  const [input, setInput] = useState(query)
  const [data, setData] = useState<CompareResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [sort, setSort] = useState<SortKey>('price')

  useEffect(() => setQ(query), [query])

  useEffect(() => {
    if (!q || q.trim().length < 2) {
      setData(null)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`/api/compare?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d: CompareResponse) => !cancelled && setData(d))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [q])

  const rows = useMemo(() => {
    if (!data?.rows) return []
    const copy = [...data.rows]
    switch (sort) {
      case 'discount':
        copy.sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0))
        break
      case 'store':
        copy.sort((a, b) => a.supermarket.nameAr.localeCompare(b.supermarket.nameAr, 'ar'))
        break
      default:
        copy.sort((a, b) => a.price - b.price)
    }
    return copy
  }, [data, sort])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setQ(input.trim())
  }

  return (
    <div dir="rtl" className="w-full">
      {showSearch && (
        <form onSubmit={submit} className="mb-4 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="قارن سعر منتج… مثال: أرز بسمتي"
            className="flex-1 rounded-full border-2 border-pink-200 px-5 py-3 text-base focus:border-[#E91E8C] focus:outline-none focus:ring-4 focus:ring-pink-100"
          />
          <button type="submit" className="rounded-full bg-[#E91E8C] px-6 py-3 font-bold text-white transition hover:brightness-110">
            قارن
          </button>
        </form>
      )}

      {/* Sort controls */}
      {rows.length > 0 && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="text-gray-500">ترتيب حسب:</span>
          {([
            ['price', 'السعر'],
            ['discount', 'الخصم'],
            ['store', 'المتجر'],
          ] as [SortKey, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={`rounded-full px-3 py-1 font-semibold transition ${
                sort === key ? 'bg-[#E91E8C] text-white' : 'bg-pink-50 text-gray-600 hover:bg-pink-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : !q || q.length < 2 ? (
        <p className="py-10 text-center text-gray-400">ابحث عن منتج لمقارنة أسعاره بين المتاجر</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl bg-white py-12 text-center shadow">
          <div className="mb-2 text-5xl">🔍</div>
          <p className="text-gray-600">لا توجد عروض حالية لـ «{q}» للمقارنة</p>
        </div>
      ) : (
        <>
          {/* Title row */}
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-lg font-bold text-gray-800">{data?.productName}</h3>
            <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-semibold text-[#E91E8C]">
              {rows.length} متاجر
            </span>
          </div>

          {/* ---- Desktop / tablet: table ---- */}
          <div className="hidden overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/5 sm:block">
            <table className="w-full text-right text-sm">
              <thead className="bg-pink-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">المتجر</th>
                  <th className="px-4 py-3 font-semibold">السعر</th>
                  <th className="px-4 py-3 font-semibold">السعر الأصلي</th>
                  <th className="px-4 py-3 font-semibold">الخصم</th>
                  <th className="px-4 py-3 font-semibold">ساري حتى</th>
                  <th className="px-4 py-3 font-semibold">الفرق</th>
                  <th className="px-4 py-3 font-semibold">آخر 30 يوم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => {
                  const v = getValidity(null, r.validUntil)
                  return (
                    <tr key={r.supermarket.id} className={r.isCheapest ? 'bg-emerald-50/60' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {r.supermarket.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.supermarket.logo} alt={r.supermarket.nameAr} className="h-7 w-7 rounded-full object-contain" />
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E91E8C] text-xs font-bold text-white">
                              {r.supermarket.nameAr.charAt(0)}
                            </div>
                          )}
                          <span className="font-semibold text-gray-800">{r.supermarket.nameAr}</span>
                          {r.isCheapest && (
                            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">الأرخص 🏆</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${r.isCheapest ? 'text-emerald-600' : 'text-gray-900'}`}>
                          {r.price.toFixed(2)} ر.س
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {r.oldPrice ? <span className="line-through">{r.oldPrice.toFixed(2)}</span> : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {r.discountPercent ? (
                          <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">-{r.discountPercent}%</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${v.badgeClass}`}>
                          {r.validUntil ? formatDateAr(r.validUntil) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.diffFromCheapest === 0 ? (
                          <span className="font-semibold text-emerald-600">—</span>
                        ) : (
                          <span className="font-semibold text-red-500">+{r.diffFromCheapest.toFixed(2)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Sparkline data={r.history} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ---- Mobile: stacked cards ---- */}
          <div className="space-y-3 sm:hidden">
            {rows.map((r) => (
              <div
                key={r.supermarket.id}
                className={`rounded-2xl bg-white p-4 shadow ring-1 ${
                  r.isCheapest ? 'ring-emerald-300' : 'ring-black/5'
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {r.supermarket.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.supermarket.logo} alt={r.supermarket.nameAr} className="h-7 w-7 rounded-full object-contain" />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E91E8C] text-xs font-bold text-white">
                        {r.supermarket.nameAr.charAt(0)}
                      </div>
                    )}
                    <span className="font-bold text-gray-800">{r.supermarket.nameAr}</span>
                  </div>
                  {r.isCheapest && (
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">الأرخص 🏆</span>
                  )}
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className={`text-xl font-extrabold ${r.isCheapest ? 'text-emerald-600' : 'text-gray-900'}`}>
                      {r.price.toFixed(2)} <span className="text-sm font-normal">ر.س</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs">
                      {r.oldPrice && <span className="text-gray-400 line-through">{r.oldPrice.toFixed(2)}</span>}
                      {r.discountPercent ? <span className="font-bold text-red-600">-{r.discountPercent}%</span> : null}
                      {r.diffFromCheapest > 0 && <span className="font-semibold text-red-500">+{r.diffFromCheapest.toFixed(2)}</span>}
                    </div>
                    {r.validUntil && <div className="mt-1 text-[11px] text-gray-400">ساري حتى {formatDateAr(r.validUntil)}</div>}
                  </div>
                  <Sparkline data={r.history} width={80} height={32} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
