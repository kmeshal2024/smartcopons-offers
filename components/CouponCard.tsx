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
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 p-5 flex flex-col">
      <div className="mb-3">
        <Link href={`/store/${storeSlug}`} className="inline-block bg-pink-50 text-pink-700 px-3 py-1 rounded-full text-xs font-semibold hover:bg-pink-100 transition">
          {storeName}
        </Link>
        <h3 className="text-base font-bold mt-2 text-gray-800 line-clamp-2">{title}</h3>
      </div>

      <div className="bg-pink-50 text-pink-700 p-4 rounded-lg mb-3">
        <div className="text-2xl font-bold text-center">{discountText}</div>
      </div>

      <div className="flex gap-2 mt-auto">
        <div className="flex-1 bg-gray-50 border border-dashed border-pink-300 rounded-lg px-3 py-2.5 font-mono text-center font-bold text-pink-700 text-base">
          {code}
        </div>
        <button
          onClick={handleCopy}
          className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all active:scale-95 ${
            copied
              ? 'bg-green-500 text-white'
              : 'bg-pink-600 text-white hover:bg-pink-700'
          }`}
        >
          {copied ? '✓ تم!' : 'نسخ'}
        </button>
      </div>

      <Link
        href={`/coupon/${id}`}
        className="mt-3 block text-center text-pink-600 hover:text-pink-700 font-semibold hover:underline text-sm"
      >
        عرض التفاصيل
      </Link>
    </div>
  )
}
