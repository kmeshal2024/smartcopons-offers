'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ProductCard from '@/components/ProductCard'
import { getDeviceId, useFavorites } from '@/hooks/useFavorites'
import { currencyOf } from '@/lib/countries'

// A price list is always within one country, so the currency is resolved once
// here rather than per row. See lib/countries.ts.
const CUR = currencyOf()


// Favourites live under a device token in localStorage, so this is entirely
// client-rendered; the server wrapper marks it dynamic + noindex and supplies
// the page chrome (Header/Footer) — Footer must stay server-side, see page.tsx.
export default function FavoritesClient() {
  const { count } = useFavorites()
  const [products, setProducts] = useState<any[] | null>(null)
  const [watches, setWatches] = useState<any[]>([])

  useEffect(() => {
    const id = getDeviceId()
    if (!id) {
      setProducts([])
      return
    }
    fetch(`/api/favorites?deviceId=${id}&full=1`)
      .then(r => r.json())
      .then(d => setProducts(d.products || []))
      .catch(() => setProducts([]))
    fetch(`/api/watches?deviceId=${id}`)
      .then(r => r.json())
      .then(d => setWatches(d.watches || []))
      .catch(() => setWatches([]))
    // reload when the count changes (added/removed elsewhere)
  }, [count])

  return (
    <main className="container mx-auto px-4 py-6">
        <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/" className="hover:text-pink-600 transition">الرئيسية</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-900 font-semibold">المفضّلة</span>
        </nav>

        <div className="mb-5 flex items-center gap-2">
          <span className="text-2xl">❤️</span>
          <h1 className="text-xl font-bold text-gray-900">المفضّلة</h1>
          {products && products.length > 0 && (
            <span className="text-sm text-gray-400">({products.length})</span>
          )}
        </div>

        {/* Price watches — items the shopper is following, with a drop badge */}
        {watches.length > 0 && (
          <section className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-lg">🔔</span>
              <h2 className="font-bold text-gray-900 text-sm">متابعة الأسعار</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {watches.map(w => (
                <Link
                  key={w.productId}
                  href={`/product/${w.productId}`}
                  className={`flex items-center gap-3 rounded-xl border bg-white p-3 transition hover:shadow-sm ${
                    w.dropped ? 'border-green-300' : 'border-gray-100'
                  }`}
                >
                  {w.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.imageUrl} alt={w.name} className="h-12 w-12 rounded-lg object-contain bg-gray-50" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-50 text-xl">🛒</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800">{w.name}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs">
                      {w.currentPrice != null ? (
                        <span className="font-bold text-pink-700">{w.currentPrice.toFixed(2)} {CUR}</span>
                      ) : (
                        <span className="text-gray-400">غير متوفر حالياً</span>
                      )}
                      {w.basePrice != null && (
                        <span className="text-gray-400 line-through">{w.basePrice.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                  {w.dropped && (
                    <span className="shrink-0 rounded-full bg-green-100 px-2 py-1 text-[11px] font-bold text-green-700">
                      نزل السعر ↓
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {products === null ? (
          <div className="py-16 text-center text-gray-400 animate-pulse">جارٍ التحميل…</div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <span className="text-5xl block mb-4">🤍</span>
            <p className="text-gray-500">لا توجد منتجات في مفضّلتك بعد</p>
            <p className="text-gray-400 text-sm mt-1">اضغط على القلب في أي منتج لحفظه هنا</p>
            <Link href="/offers" className="mt-4 inline-block text-pink-600 hover:underline font-semibold text-sm">
              تصفّح العروض
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
    </main>
  )
}
