'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Header from '@/components/Header'
import ProductCard from '@/components/ProductCard'
import Link from 'next/link'

interface Product {
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
  category?: {
    nameAr: string
    slug: string
  } | null
}

interface Supermarket {
  name: string
  nameAr: string
  logo?: string | null
}

export default function RetailerPage() {
  const params = useParams()
  const slug = params?.slug as string

  const [products, setProducts] = useState<Product[]>([])
  const [supermarket, setSupermarket] = useState<Supermarket | null>(null)
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sort, setSort] = useState('newest')

  useEffect(() => {
    if (slug) {
      fetchData()
    }
  }, [slug, categoryFilter, sort])

  const fetchData = async () => {
    setLoading(true)

    // Fetch supermarket details
    const supermarketRes = await fetch(`/api/supermarkets`)
    const supermarketData = await supermarketRes.json()
    const currentSupermarket = supermarketData.supermarkets?.find(
      (s: any) => s.slug === slug
    )

    if (currentSupermarket) {
      setSupermarket(currentSupermarket)

      // Fetch products
      const params = new URLSearchParams()
      params.set('supermarket', currentSupermarket.id)
      if (sort) params.set('sort', sort)
      if (categoryFilter) params.set('category', categoryFilter)

      const productsRes = await fetch(`/api/offers?${params.toString()}`)
      const productsData = await productsRes.json()

      setProducts(productsData.products || [])
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-red-50">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-pink-200 border-t-pink-600"></div>
        </div>
      </div>
    )
  }

  if (!supermarket) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-red-50">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-3xl font-bold text-gray-800">المتجر غير موجود</h1>
          <Link href="/offers" className="text-pink-600 hover:underline mt-4 inline-block">
            العودة للعروض
          </Link>
        </div>
      </div>
    )
  }

  // Get unique categories from products
  const categories = Array.from(
    new Set(
      products
        .filter(p => p.category)
        .map(p => JSON.stringify(p.category))
    )
  ).map(c => JSON.parse(c))

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-red-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-gray-600">
          <Link href="/" className="hover:text-pink-600">الرئيسية</Link>
          <span className="mx-2">/</span>
          <Link href="/offers" className="hover:text-pink-600">العروض</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-800 font-semibold">{supermarket.nameAr}</span>
        </nav>

        {/* Supermarket Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-center gap-6">
            {supermarket.logo && (
              <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                <img
                  src={supermarket.logo}
                  alt={supermarket.nameAr}
                  className="w-full h-full object-contain p-2"
                />
              </div>
            )}
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-600 to-red-600 bg-clip-text text-transparent mb-2">
                عروض {supermarket.nameAr}
              </h1>
              <p className="text-gray-600">{products.length} منتج متوفر</p>
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                التصنيف
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border-2 border-pink-200 focus:outline-none focus:ring-4 focus:ring-pink-300 focus:border-pink-500"
              >
                <option value="">جميع التصنيفات</option>
                {categories.map((cat: any) => (
                  <option key={cat.slug} value={cat.slug}>
                    {cat.nameAr}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                ترتيب حسب
              </label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border-2 border-pink-200 focus:outline-none focus:ring-4 focus:ring-pink-300 focus:border-pink-500"
              >
                <option value="newest">الأحدث</option>
                <option value="price-low">السعر: الأقل أولاً</option>
                <option value="price-high">السعر: الأعلى أولاً</option>
                <option value="discount">الخصم الأكبر</option>
              </select>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        {products.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-lg">
            <div className="text-6xl mb-4">🛒</div>
            <p className="text-gray-600 text-xl">لا توجد عروض حالياً</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
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