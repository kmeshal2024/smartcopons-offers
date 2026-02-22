'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface Supermarket {
  id: string
  nameAr: string
  slug: string
  logo?: string | null
  _count: {
    flyers: number
  }
}

export default function RetailerStrip() {
  const [supermarkets, setSupermarkets] = useState<Supermarket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/supermarkets')
      .then(res => res.json())
      .then(data => {
        setSupermarkets(data.supermarkets || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="h-24 bg-gray-100 animate-pulse rounded-lg" />
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <h3 className="font-bold text-gray-800 mb-4">المتاجر</h3>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {supermarkets.map(supermarket => (
          <Link
            key={supermarket.id}
            href={`/offers/retailer/${supermarket.slug}`}
            className="flex-shrink-0 group"
          >
            <div className="relative w-20 h-20 bg-gray-50 rounded-lg border-2 border-gray-200 group-hover:border-pink-500 transition-all overflow-hidden">
              {supermarket.logo ? (
                <Image
                  src={supermarket.logo}
                  alt={supermarket.nameAr}
                  fill
                  className="object-contain p-2"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-2xl">
                  🏪
                </div>
              )}
              {supermarket._count.flyers > 0 && (
                <div className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {supermarket._count.flyers}
                </div>
              )}
            </div>
            <div className="text-center text-xs mt-2 text-gray-700 group-hover:text-pink-600">
              {supermarket.nameAr}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}