'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import CouponCard from '@/components/CouponCard'

interface Coupon {
  id: string
  title: string
  code: string
  discountText: string
  store: {
    name: string
    slug: string
  }
}

export default function HomePage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/public/coupons')
      .then(res => res.json())
      .then(data => {
        setCoupons(data.coupons || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filteredCoupons = coupons.filter(coupon =>
    coupon.title.toLowerCase().includes(search.toLowerCase()) ||
    coupon.code.toLowerCase().includes(search.toLowerCase()) ||
    coupon.store.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-red-50">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-pink-600 to-red-600 bg-clip-text text-transparent mb-4">
            أحدث كوبونات الخصم
          </h1>
          <p className="text-gray-600 text-lg mb-8">
            وفر المال مع أفضل كوبونات الخصم من المتاجر الإلكترونية 🎁
          </p>
          
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <input
                type="text"
                placeholder="ابحث عن كوبون أو متجر..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-6 py-4 pr-14 rounded-full border-2 border-pink-200 focus:outline-none focus:ring-4 focus:ring-pink-300 focus:border-pink-500 text-lg shadow-lg"
              />
              <svg 
                className="absolute left-5 top-1/2 transform -translate-y-1/2 w-6 h-6 text-pink-500"
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {search && (
              <p className="mt-3 text-sm text-gray-600">
                العثور على {filteredCoupons.length} كوبون
              </p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-pink-200 border-t-pink-600"></div>
            <p className="mt-4 text-gray-600 text-lg">جاري التحميل...</p>
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-lg">
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-gray-600 text-xl">لا توجد كوبونات متاحة</p>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="mt-4 text-pink-600 hover:underline"
              >
                إلغاء البحث
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCoupons.map((coupon) => (
              <CouponCard
                key={coupon.id}
                id={coupon.id}
                title={coupon.title}
                code={coupon.code}
                discountText={coupon.discountText}
                storeName={coupon.store.name}
                storeSlug={coupon.store.slug}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="bg-gradient-to-r from-pink-600 to-red-500 text-white mt-20 py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-lg">© 2024 SmartCopons. جميع الحقوق محفوظة 💝</p>
        </div>
      </footer>
    </div>
  )
}