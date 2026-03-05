'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface ProductCardProps {
  product: {
    id: string
    nameAr?: string | null
    nameEn?: string | null
    brand?: string | null
    price: number
    oldPrice?: number | null
    discountPercent?: number | null
    sizeText?: string | null
    imageUrl?: string | null
    supermarket: {
      nameAr: string
      slug: string
      logo?: string | null
    }
  }
}

export default function ProductCard({ product }: ProductCardProps) {
  const displayName = product.nameAr || product.nameEn || 'منتج'
  const hasDiscount = product.discountPercent && product.discountPercent > 0
  const [imgError, setImgError] = useState(false)

  return (
    <div className="bg-white rounded-xl border border-gray-100 hover:shadow-lg hover:border-gray-200 transition-all duration-200 overflow-hidden group flex flex-col">
      {/* Product Image */}
      <div className="relative h-44 sm:h-52 bg-gray-50 flex items-center justify-center">
        {product.imageUrl && !imgError ? (
          <Image
            src={product.imageUrl}
            alt={displayName}
            fill
            className="object-contain p-4 group-hover:scale-[1.03] transition-transform duration-200"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-300">
            <svg className="w-12 h-12 sm:w-14 sm:h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span className="text-[10px] text-gray-300 mt-1">لا توجد صورة</span>
          </div>
        )}

        {/* Discount Badge */}
        {hasDiscount && (
          <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-0.5 rounded-md text-xs font-bold shadow-sm">
            {product.discountPercent}%-
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-3 sm:p-3.5 flex flex-col flex-1">
        {/* Retailer name */}
        <Link
          href={`/offers/retailer/${product.supermarket.slug}`}
          className="text-[10px] sm:text-[11px] text-gray-400 hover:text-pink-600 transition-colors font-medium truncate"
        >
          {product.supermarket.nameAr}
        </Link>

        {/* Product Name */}
        <h3 className="text-xs sm:text-sm font-semibold text-gray-800 line-clamp-2 mt-0.5 mb-1 min-h-[2rem] sm:min-h-[2.5rem] leading-snug">
          {displayName}
        </h3>

        {/* Brand + Size */}
        {(product.brand || product.sizeText) && (
          <div className="text-[10px] sm:text-xs text-gray-400 mb-1.5 truncate">
            {product.brand}{product.brand && product.sizeText ? ' · ' : ''}{product.sizeText}
          </div>
        )}

        {/* Price */}
        <div className="mt-auto flex items-baseline gap-1.5 flex-wrap">
          <span className="text-base sm:text-lg font-bold text-gray-900">
            {product.price.toFixed(2)}
          </span>
          <span className="text-[10px] sm:text-xs text-gray-400">ر.س</span>
          {product.oldPrice && product.oldPrice > product.price && (
            <span className="text-[10px] sm:text-xs text-gray-400 line-through mr-auto">
              {product.oldPrice.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
