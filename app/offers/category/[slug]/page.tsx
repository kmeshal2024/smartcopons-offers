'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Header from '@/components/Header'
import ProductCard from '@/components/ProductCard'
import CategorySidebar from '@/components/CategorySidebar'
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
}

export default function CategoryPage() {
  const params = useParams()
  const slug = params?.slug as string

  const [products, setProducts] = useState<Product[]>([])
  const [categoryName, setCategoryName] = useState('')
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState('newest')

  useEffect(() => {
    if (slug) {
      fetchData()
    }
  }, [slug, sort])

  const fetchData = async () => {
    setLoading(true)

    // Fetch categories to get category ID
    const categoriesRes = await fetch('/api/categories')
    const categoriesData = await categoriesRes.json()
    
    // Find category
    let category = null
    for (const cat of categoriesData.categories || []) {
      if (cat.slug === slug) {
        category = cat
        break
      }
      // Check children
      if (cat.children) {
        const child = cat.children.find((c: any) => c.slug === slug)
        if (child) {
          category = child
          break
        }
      }
    }

    if (category) {
      setCategoryName(category.nameAr)

      // Fetch products
      const params = new URLSearchParams()
      params.set('category', category.id)
      if (sort) params.set('sort', sort)

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
          <span className="text-gray-800 font-semibold">{categoryName}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <CategorySidebar />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Category Header */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-600 to-red-600 bg-clip-text text-transparent mb-2">
                {categoryName}
              </h1>
              <p className="text-gray-600">{products.length} منتج</p>
            </div>

            {/* Sort */}
            <div className="bg-white rounded-lg shadow-md p-4 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-gray-700 font-semibold">ترتيب حسب:</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="px-4 py-2 rounded-lg border-2 border-pink-200 focus:outline-none focus:ring-4 focus:ring-pink-300 focus:border-pink-500"
                >
                  <option value="newest">الأحدث</option>
                  <option value="price-low">السعر: الأقل أولاً</option>
                  <option value="price-high">السعر: الأعلى أولاً</option>
                  <option value="discount">الخصم الأكبر</option>
                </select>
              </div>
            </div>

            {/* Products Grid */}
            {products.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl shadow-lg">
                <div className="text-6xl mb-4">📦</div>
                <p className="text-gray-600 text-xl">لا توجد منتجات في هذا التصنيف</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="bg-gradient-to-r from-pink-600 to-red-500 text-white mt-20 py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-lg">© 2024 SmartCopons. جميع الحقوق محفوظة 💝</p>
        </div>
      </footer>
    </div>
  )
}