'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Header from '@/components/Header'
import ProductCard from '@/components/ProductCard'

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
    id: string
    nameAr: string
    slug: string
    logo?: string | null
  }
  category?: {
    nameAr: string
    icon?: string | null
  } | null
}

interface Category {
  id: string
  nameAr: string
  nameEn: string
  slug: string
  icon?: string | null
  _count: { products: number }
  children: {
    id: string
    nameAr: string
    nameEn: string
    slug: string
    icon?: string | null
    _count: { products: number }
  }[]
}

interface Supermarket {
  id: string
  nameAr: string
  slug: string
  logo?: string | null
  _count: { flyers: number }
}

interface Coupon {
  id: string
  title: string
  code: string
  discountText: string
  store: { name: string; slug: string }
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function OffersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [supermarkets, setSupermarkets] = useState<Supermarket[]>([])
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<Pagination | null>(null)

  const [search, setSearch] = useState(searchParams?.get('search') || '')
  const [sort, setSort] = useState(searchParams?.get('sort') || 'newest')
  const [selectedCategory, setSelectedCategory] = useState(searchParams?.get('category') || '')
  const [selectedSupermarket, setSelectedSupermarket] = useState(searchParams?.get('supermarket') || '')
  const [maxPrice, setMaxPrice] = useState(500)
  const [page, setPage] = useState(1)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Load categories and supermarkets once
  useEffect(() => {
    Promise.all([
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/supermarkets').then(r => r.json()),
    ]).then(([catData, smData]) => {
      setCategories(catData.categories || [])
      setSupermarkets(smData.supermarkets || [])
    }).catch(() => {})
  }, [])

  // Load coupons when supermarket changes
  useEffect(() => {
    if (selectedSupermarket) {
      const sm = supermarkets.find(s => s.id === selectedSupermarket)
      if (sm) {
        fetch(`/api/public/coupons-by-store?slug=${sm.slug}`)
          .then(r => r.json())
          .then(data => setCoupons(data.coupons || []))
          .catch(() => setCoupons([]))
      }
    } else {
      // Show general coupons
      fetch('/api/public/coupons')
        .then(r => r.json())
        .then(data => setCoupons((data.coupons || []).slice(0, 4)))
        .catch(() => setCoupons([]))
    }
  }, [selectedSupermarket, supermarkets])

  const fetchProducts = useCallback(async (resetPage = false) => {
    setLoading(true)
    const currentPage = resetPage ? 1 : page

    const params = new URLSearchParams()
    if (sort) params.set('sort', sort)
    if (search) params.set('search', search)
    if (selectedCategory) params.set('category', selectedCategory)
    if (selectedSupermarket) params.set('supermarket', selectedSupermarket)
    params.set('minPrice', '0')
    params.set('maxPrice', maxPrice.toString())
    params.set('page', currentPage.toString())
    params.set('limit', '24')

    const res = await fetch(`/api/offers?${params.toString()}`)
    const data = await res.json()

    setProducts(data.products || [])
    setPagination(data.pagination || null)
    if (resetPage) setPage(1)
    setLoading(false)
  }, [sort, search, selectedCategory, selectedSupermarket, maxPrice, page])

  useEffect(() => {
    fetchProducts()
  }, [sort, selectedCategory, selectedSupermarket, page])

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      fetchProducts(true)
    }, 400)
  }

  const handleSearchSubmit = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setPage(1)
    fetchProducts(true)
  }

  const handleCategorySelect = (id: string) => {
    setSelectedCategory(prev => prev === id ? '' : id)
    setPage(1)
  }

  const handleSupermarketSelect = (id: string) => {
    setSelectedSupermarket(prev => prev === id ? '' : id)
    setPage(1)
  }

  const toggleCategoryExpand = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code).catch(() => {})
    const btn = document.getElementById(`copy-${id}`)
    if (btn) {
      btn.textContent = 'تم!'
      setTimeout(() => { if (btn) btn.textContent = 'نسخ' }, 2000)
    }
  }

  const FiltersPanel = () => (
    <div className="space-y-6">
      {/* Supermarket filter */}
      <div>
        <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase tracking-wide">المتاجر</h3>
        <div className="space-y-2">
          <button
            onClick={() => handleSupermarketSelect('')}
            className={`w-full text-right px-3 py-2 rounded-lg text-sm transition ${
              !selectedSupermarket
                ? 'bg-pink-600 text-white font-semibold'
                : 'hover:bg-pink-50 text-gray-700'
            }`}
          >
            جميع المتاجر
          </button>
          {supermarkets.map(sm => (
            <button
              key={sm.id}
              onClick={() => handleSupermarketSelect(sm.id)}
              className={`w-full text-right px-3 py-2 rounded-lg text-sm transition flex items-center gap-2 ${
                selectedSupermarket === sm.id
                  ? 'bg-pink-600 text-white font-semibold'
                  : 'hover:bg-pink-50 text-gray-700'
              }`}
            >
              <span className="flex-1">{sm.nameAr}</span>
              {sm._count.flyers > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  selectedSupermarket === sm.id ? 'bg-pink-700' : 'bg-pink-100 text-pink-700'
                }`}>
                  {sm._count.flyers}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Category filter */}
      <div>
        <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase tracking-wide">الفئات</h3>
        <div className="space-y-1">
          <button
            onClick={() => handleCategorySelect('')}
            className={`w-full text-right px-3 py-2 rounded-lg text-sm transition ${
              !selectedCategory
                ? 'bg-pink-600 text-white font-semibold'
                : 'hover:bg-pink-50 text-gray-700'
            }`}
          >
            جميع الفئات
          </button>
          {categories.map(cat => (
            <div key={cat.id}>
              <div className="flex items-center">
                <button
                  onClick={() => handleCategorySelect(cat.id)}
                  className={`flex-1 text-right px-3 py-2 rounded-lg text-sm transition flex items-center gap-2 ${
                    selectedCategory === cat.id
                      ? 'bg-pink-600 text-white font-semibold'
                      : 'hover:bg-pink-50 text-gray-700'
                  }`}
                >
                  {cat.icon && <span>{cat.icon}</span>}
                  <span className="flex-1">{cat.nameAr}</span>
                  {cat._count.products > 0 && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      selectedCategory === cat.id ? 'bg-pink-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {cat._count.products}
                    </span>
                  )}
                </button>
                {cat.children.length > 0 && (
                  <button
                    onClick={() => toggleCategoryExpand(cat.id)}
                    className="px-2 py-2 text-gray-400 hover:text-gray-700"
                  >
                    {expandedCategories.has(cat.id) ? '▲' : '▼'}
                  </button>
                )}
              </div>
              {expandedCategories.has(cat.id) && cat.children.map(child => (
                <button
                  key={child.id}
                  onClick={() => handleCategorySelect(child.id)}
                  className={`w-full text-right pr-8 pl-3 py-1.5 rounded-lg text-xs transition flex items-center gap-2 ${
                    selectedCategory === child.id
                      ? 'bg-pink-500 text-white font-semibold'
                      : 'hover:bg-pink-50 text-gray-600'
                  }`}
                >
                  {child.icon && <span>{child.icon}</span>}
                  <span className="flex-1">{child.nameAr}</span>
                  {child._count.products > 0 && (
                    <span className="text-xs text-gray-400">{child._count.products}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Price filter */}
      <div>
        <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase tracking-wide">السعر</h3>
        <div className="px-2">
          <input
            type="range"
            min="0"
            max="500"
            value={maxPrice}
            onChange={(e) => setMaxPrice(parseInt(e.target.value))}
            onMouseUp={() => { setPage(1); fetchProducts(true) }}
            onTouchEnd={() => { setPage(1); fetchProducts(true) }}
            className="w-full accent-pink-600"
          />
          <div className="flex justify-between text-sm text-gray-600 mt-1">
            <span>0 ر.س</span>
            <span className="font-semibold text-pink-600">{maxPrice} ر.س</span>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-red-50" dir="rtl">
      <Header />

      <main className="container mx-auto px-4 py-6">
        {/* Page Title */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-600 to-red-600 bg-clip-text text-transparent mb-2">
            عروض السوبرماركت
          </h1>
          <p className="text-gray-600">اكتشف أفضل العروض والخصومات 🛒</p>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-6">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="ابحث عن منتج، علامة تجارية..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                className="w-full px-5 py-3 pr-12 rounded-full border-2 border-pink-200 focus:outline-none focus:ring-4 focus:ring-pink-200 focus:border-pink-500 text-base"
              />
              <svg
                className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-pink-400"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {search && (
                <button
                  onClick={() => { setSearch(''); fetchProducts(true) }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg"
                >
                  ×
                </button>
              )}
            </div>
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(1) }}
              className="px-4 py-3 rounded-full border-2 border-pink-200 focus:outline-none focus:ring-4 focus:ring-pink-200 focus:border-pink-500 bg-white text-sm"
            >
              <option value="newest">الأحدث</option>
              <option value="price-low">السعر: الأقل أولاً</option>
              <option value="price-high">السعر: الأعلى أولاً</option>
              <option value="discount">الخصم الأكبر</option>
              <option value="popular">الأكثر مشاهدة</option>
            </select>
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="md:hidden bg-pink-600 text-white px-4 py-3 rounded-full font-semibold"
            >
              فلتر
            </button>
          </div>

          {/* Active filters chips */}
          {(selectedCategory || selectedSupermarket || search) && (
            <div className="flex flex-wrap gap-2 mt-3">
              {search && (
                <span className="inline-flex items-center gap-1 bg-pink-100 text-pink-700 text-sm px-3 py-1 rounded-full">
                  بحث: {search}
                  <button onClick={() => { setSearch(''); fetchProducts(true) }} className="hover:text-pink-900">×</button>
                </span>
              )}
              {selectedSupermarket && (
                <span className="inline-flex items-center gap-1 bg-pink-100 text-pink-700 text-sm px-3 py-1 rounded-full">
                  {supermarkets.find(s => s.id === selectedSupermarket)?.nameAr}
                  <button onClick={() => { setSelectedSupermarket(''); setPage(1) }} className="hover:text-pink-900">×</button>
                </span>
              )}
              {selectedCategory && (
                <span className="inline-flex items-center gap-1 bg-pink-100 text-pink-700 text-sm px-3 py-1 rounded-full">
                  {categories.find(c => c.id === selectedCategory)?.nameAr ||
                    categories.flatMap(c => c.children).find(c => c.id === selectedCategory)?.nameAr}
                  <button onClick={() => { setSelectedCategory(''); setPage(1) }} className="hover:text-pink-900">×</button>
                </span>
              )}
              <button
                onClick={() => {
                  setSearch('')
                  setSelectedCategory('')
                  setSelectedSupermarket('')
                  setPage(1)
                }}
                className="text-sm text-gray-500 hover:text-red-600 underline"
              >
                مسح الكل
              </button>
            </div>
          )}
        </div>

        {/* Coupon Codes Strip */}
        {coupons.length > 0 && (
          <div className="bg-gradient-to-r from-pink-600 to-red-500 rounded-2xl p-4 mb-6 text-white">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🎟️</span>
              <h2 className="font-bold text-lg">
                {selectedSupermarket
                  ? `كوبونات ${supermarkets.find(s => s.id === selectedSupermarket)?.nameAr || ''}`
                  : 'أحدث كوبونات الخصم'}
              </h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {coupons.map(coupon => (
                <div
                  key={coupon.id}
                  className="flex-shrink-0 bg-white/10 backdrop-blur border border-white/20 rounded-xl p-3 min-w-[200px]"
                >
                  <div className="text-xs text-white/80 mb-1">{coupon.store.name}</div>
                  <div className="font-bold text-sm mb-2 line-clamp-1">{coupon.title}</div>
                  <div className="text-pink-200 font-bold text-xs mb-2">{coupon.discountText}</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white/20 border border-dashed border-white/40 rounded-lg px-3 py-1 font-mono text-sm font-bold text-center">
                      {coupon.code}
                    </div>
                    <button
                      id={`copy-${coupon.id}`}
                      onClick={() => handleCopyCode(coupon.code, coupon.id)}
                      className="bg-white text-pink-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-pink-50 transition"
                    >
                      نسخ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-6">
          {/* Sidebar Filters (Desktop) */}
          <aside className="hidden md:block w-64 flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-lg p-5 sticky top-4">
              <FiltersPanel />
            </div>
          </aside>

          {/* Mobile Filters */}
          {showMobileFilters && (
            <div className="md:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setShowMobileFilters(false)}>
              <div
                className="absolute right-0 top-0 h-full w-80 bg-white p-6 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-bold text-xl">الفلاتر</h2>
                  <button onClick={() => setShowMobileFilters(false)} className="text-gray-500 text-2xl">×</button>
                </div>
                <FiltersPanel />
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="w-full mt-6 bg-pink-600 text-white py-3 rounded-full font-bold"
                >
                  عرض النتائج {pagination ? `(${pagination.total})` : ''}
                </button>
              </div>
            </div>
          )}

          {/* Products Grid */}
          <div className="flex-1 min-w-0">
            {/* Results count */}
            {!loading && pagination && (
              <div className="mb-4 flex items-center justify-between">
                <span className="text-gray-600 text-sm">
                  عرض {products.length} من {pagination.total} منتج
                </span>
                {pagination.totalPages > 1 && (
                  <span className="text-gray-500 text-sm">
                    صفحة {pagination.page} من {pagination.totalPages}
                  </span>
                )}
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl shadow h-72 animate-pulse">
                    <div className="h-40 bg-gray-200 rounded-t-2xl" />
                    <div className="p-4 space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                      <div className="h-5 bg-gray-200 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl shadow-lg">
                <div className="text-6xl mb-4">🔍</div>
                <p className="text-gray-600 text-xl mb-2">لا توجد منتجات متطابقة</p>
                {(search || selectedCategory || selectedSupermarket) && (
                  <button
                    onClick={() => {
                      setSearch('')
                      setSelectedCategory('')
                      setSelectedSupermarket('')
                      setPage(1)
                    }}
                    className="mt-4 text-pink-600 hover:underline font-semibold"
                  >
                    مسح الفلاتر
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {products.map(product => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-8">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 rounded-full border-2 border-pink-200 disabled:opacity-40 hover:border-pink-500 hover:text-pink-600 transition font-semibold"
                    >
                      السابق
                    </button>
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      const p = Math.max(1, Math.min(pagination.totalPages - 4, page - 2)) + i
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`w-10 h-10 rounded-full font-semibold transition ${
                            p === page
                              ? 'bg-pink-600 text-white'
                              : 'border-2 border-pink-200 hover:border-pink-500 hover:text-pink-600'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                      disabled={page === pagination.totalPages}
                      className="px-4 py-2 rounded-full border-2 border-pink-200 disabled:opacity-40 hover:border-pink-500 hover:text-pink-600 transition font-semibold"
                    >
                      التالي
                    </button>
                  </div>
                )}
              </>
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
