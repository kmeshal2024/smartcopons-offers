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
          <div className="absolute top-2 right-2 bg-pink-600 text-white px-2 py-0.5 rounded-md text-xs font-bold shadow-sm">
            {product.discountPercent}%-
          </div>
        )}

        {/* Supermarket Logo Badge */}
        {product.supermarket.logo && (
          <div className="absolute bottom-2 right-2 w-7 h-7 bg-white rounded-full shadow-sm flex items-center justify-center overflow-hidden border border-gray-100">
            <img src={product.supermarket.logo} alt={product.supermarket.nameAr} className="w-5 h-5 object-contain" />
          </div>
        )}

        {/* WhatsApp Share */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            const text = `${displayName} - ${product.price.toFixed(2)} ر.س${product.oldPrice ? ` (كان ${product.oldPrice.toFixed(2)})` : ''} - ${product.supermarket.nameAr}\nhttps://sa.smartcopons.com/offers/retailer/${product.supermarket.slug}`
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
          }}
          className="absolute top-2 left-2 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-green-50"
          title="مشاركة عبر واتساب"
        >
          <svg className="w-3.5 h-3.5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </button>
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
          <span className="text-base sm:text-lg font-bold text-pink-700">
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
