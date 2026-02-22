'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Header from '@/components/Header'
import CouponCard from '@/components/CouponCard'
import Link from 'next/link'

interface Store {
  name: string
  slug: string
  website?: string
}

interface Coupon {
  id: string
  title: string
  code: string
  discountText: string
}

export default function StorePage() {
  const params = useParams()
  const slug = params.slug as string
  
  const [store, setStore] = useState<Store | null>(null)
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/public/stores/${slug}`)
      .then(res => res.json())
      .then(data => {
        setStore(data.store || null)
        setCoupons(data.coupons || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [slug])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/" className="text-blue-600 hover:underline">
            ← العودة للرئيسية
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : !store ? (
          <div className="text-center py-12">
            <p className="text-gray-600">المتجر غير موجود</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-md p-8 mb-8">
              <h1 className="text-3xl font-bold mb-4">{store.name}</h1>
              {store.website && (
                <a
                  href={store.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  زيارة الموقع ←
                </a>
              )}
            </div>

            <h2 className="text-2xl font-bold mb-6">كوبونات {store.name}</h2>

            {coupons.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg">
                <p className="text-gray-600">لا توجد كوبونات متاحة حالياً</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {coupons.map((coupon) => (
                  <CouponCard
                    key={coupon.id}
                    id={coupon.id}
                    title={coupon.title}
                    code={coupon.code}
                    discountText={coupon.discountText}
                    storeName={store.name}
                    storeSlug={store.slug}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
