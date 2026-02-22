'use client'

import Link from 'next/link'
import { useState } from 'react'

interface CouponCardProps {
  id: string
  title: string
  code: string
  discountText: string
  storeName: string
  storeSlug: string
}

export default function CouponCard({ id, title, code, discountText, storeName, storeSlug }: CouponCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 border-2 border-pink-100 hover:border-pink-300 transform hover:-translate-y-1">
      <div className="mb-4">
        <Link href={`/store/${storeSlug}`} className="inline-block bg-gradient-to-r from-pink-100 to-red-100 text-pink-700 px-4 py-1 rounded-full text-sm font-semibold hover:from-pink-200 hover:to-red-200 transition">
          {storeName}
        </Link>
        <h3 className="text-xl font-bold mt-3 text-gray-800 line-clamp-2">{title}</h3>
      </div>
      
      <div className="bg-gradient-to-r from-pink-500 via-red-500 to-pink-600 text-white p-6 rounded-xl mb-4 shadow-md">
        <div className="text-3xl font-bold text-center drop-shadow-lg">{discountText}</div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-dashed border-pink-300 rounded-lg px-4 py-3 font-mono text-center font-bold text-pink-700 text-lg">
          {code}
        </div>
        <button
          onClick={handleCopy}
          className="bg-gradient-to-r from-pink-600 to-red-600 text-white px-6 py-3 rounded-lg hover:from-pink-700 hover:to-red-700 transition-all transform active:scale-95 font-semibold shadow-md"
        >
          {copied ? '✓ تم!' : 'نسخ'}
        </button>
      </div>

      <Link
        href={`/coupon/${id}`}
        className="mt-4 block text-center text-pink-600 hover:text-pink-700 font-semibold hover:underline text-sm"
      >
        عرض التفاصيل ←
      </Link>
    </div>
  )
}