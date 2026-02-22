'use client'

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

  return (
    <div className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group">
      {/* Product Image */}
      <div className="relative h-48 bg-gradient-to-br from-gray-50 to-gray-100">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={displayName}
            fill
            className="object-contain p-4 group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-6xl">
            🛍️
          </div>
        )}

        {/* Discount Badge */}
        {hasDiscount && (
          <div className="absolute top-3 right-3 bg-gradient-to-r from-red-500 to-pink-600 text-white px-3 py-1 rounded-full font-bold text-sm shadow-lg">
            -{product.discountPercent}%
          </div>
        )}

        {/* Retailer Logo */}
        {product.supermarket.logo && (
          <div className="absolute bottom-3 left-3 bg-white rounded-lg p-2 shadow-md">
            <Image
              src={product.supermarket.logo}
              alt={product.supermarket.nameAr}
              width={40}
              height={40}
              className="object-contain"
            />
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4">
        {/* Brand */}
        {product.brand && (
          <div className="text-xs text-gray-500 mb-1">{product.brand}</div>
        )}

        {/* Name */}
        <h3 className="font-bold text-gray-800 mb-2 line-clamp-2 min-h-[2.5rem]">
          {displayName}
        </h3>

        {/* Size */}
        {product.sizeText && (
          <div className="text-sm text-gray-600 mb-3">{product.sizeText}</div>
        )}

        {/* Price */}
        <div className="flex items-center gap-2 mb-3">
          {product.oldPrice && (
            <span className="text-gray-400 line-through text-sm">
              {product.oldPrice.toFixed(2)} ر.س
            </span>
          )}
          <span className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-red-600 bg-clip-text text-transparent">
            {product.price.toFixed(2)} ر.س
          </span>
        </div>

        {/* Retailer */}
        <Link
          href={`/offers/retailer/${product.supermarket.slug}`}
          className="text-xs text-pink-600 hover:text-pink-700 hover:underline"
        >
          {product.supermarket.nameAr}
        </Link>
      </div>
    </div>
  )
}