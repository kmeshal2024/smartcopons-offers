'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Header from '@/components/Header'
import Link from 'next/link'

interface Coupon {
  id: string
  title: string
  code: string
  discountText: string
  url: string
  description?: string
  store: {
    name: string
    slug: string
    website?: string
  }
}

export default function CouponPage() {
  const params = useParams()
  const id = params.id as string
  
  const [coupon, setCoupon] = useState<Coupon | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`/api/public/coupons`)
      .then(res => res.json())
      .then(data => {
        const found = data.coupons?.find((c: Coupon) => c.id === id)
        setCoupon(found || null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  const handleCopy = () => {
    if (coupon) {
      navigator.clipboard.writeText(coupon.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

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
        ) : !coupon ? (
          <div className="text-center py-12">
            <p className="text-gray-600">الكوبون غير موجود</p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="mb-6">
                <Link
                  href={`/store/${coupon.store.slug}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {coupon.store.name}
                </Link>
                <h1 className="text-3xl font-bold mt-2">{coupon.title}</h1>
              </div>

              <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-8 rounded-lg mb-6">
                <div className="text-4xl font-bold text-center mb-4">
                  {coupon.discountText}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">كود الكوبون:</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-gray-100 border-2 border-dashed border-gray-300 rounded px-4 py-3 font-mono text-lg font-bold text-center">
                    {coupon.code}
                  </div>
                  <button
                    onClick={handleCopy}
                    className="bg-blue-600 text-white px-8 py-3 rounded hover:bg-blue-700 transition"
                  >
                    {copied ? '✓ تم النسخ' : 'نسخ الكود'}
                  </button>
                </div>
              </div>

              {coupon.description && (
                <div className="mb-6">
                  <h2 className="text-xl font-bold mb-2">الوصف:</h2>
                  <p className="text-gray-700">{coupon.description}</p>
                </div>
              )}

              <div className="pt-6 border-t">
                <a
                  href={coupon.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-green-600 text-white text-center px-6 py-4 rounded-lg hover:bg-green-700 transition font-bold text-lg"
                >
                  استخدم الكوبون الآن ←
                </a>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
