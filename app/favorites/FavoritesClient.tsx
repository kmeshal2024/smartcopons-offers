'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ProductCard from '@/components/ProductCard'
import { getDeviceId, useFavorites } from '@/hooks/useFavorites'

// Favourites live under a device token in localStorage, so this is entirely
// client-rendered; the server wrapper marks it dynamic + noindex.
export default function FavoritesClient() {
  const { count } = useFavorites()
  const [products, setProducts] = useState<any[] | null>(null)

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
    // reload when the count changes (added/removed elsewhere)
  }, [count])

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header />
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
      <Footer />
    </div>
  )
}
