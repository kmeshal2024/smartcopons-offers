'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

export default function OffersClient() {
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
        <h3 className="font-bold text-gray-800 mb-3 text-sm">المتاجر</h3>
        <div className="space-y-1">
          <button
            onClick={() => handleSupermarketSelect('')}
            className={`w-full text-right px-3 py-2 rounded-lg text-sm transition ${
              !selectedSupermarket
                ? 'bg-pink-600 text-white font-semibold'
                : 'hover:bg-gray-50 text-gray-700'
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
                  : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <span className="flex-1">{sm.nameAr}</span>
              {sm._count.flyers > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  selectedSupermarket === sm.id ? 'bg-pink-700' : 'bg-pink-50 text-pink-700'
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
        <h3 className="font-bold text-gray-800 mb-3 text-sm">الفئات</h3>
        <div className="space-y-1">
          <button
            onClick={() => handleCategorySelect('')}
            className={`w-full text-right px-3 py-2 rounded-lg text-sm transition ${
              !selectedCategory
                ? 'bg-pink-600 text-white font-semibold'
                : 'hover:bg-gray-50 text-gray-700'
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
                      : 'hover:bg-gray-50 text-gray-700'
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
                    <svg className={`w-3 h-3 transition-transform ${expandedCategories.has(cat.id) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
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
                      : 'hover:bg-gray-50 text-gray-600'
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
        <h3 className="font-bold text-gray-800 mb-3 text-sm">السعر</h3>
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
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header />

      <main className="container mx-auto px-4 py-5">
        {/* Page Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">عروض السوبرماركت</h1>
          <p className="text-sm text-gray-500">اكتشف أفضل العروض والخصومات</p>
        </div>

        {/* Search + Sort Bar */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-4 mb-5">
          <div className="flex gap-2 sm:gap-3">
            <div className="flex-1 relative">
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="ابحث عن منتج، علامة تجارية..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                className="w-full pr-10 pl-9 py-2.5 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-pink-400 focus:ring-2 focus:ring-pink-100 focus:outline-none text-sm transition"
              />
              {search && (
                <button
                  onClick={() => { setSearch(''); fetchProducts(true) }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(1) }}
              className="px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-pink-100 focus:border-pink-400 text-sm transition min-w-[120px]"
            >
              <option value="newest">الأحدث</option>
              <option value="price-low">السعر: الأقل</option>
              <option value="price-high">السعر: الأعلى</option>
              <option value="discount">الخصم الأكبر</option>
              <option value="popular">الأكثر مشاهدة</option>
            </select>
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="md:hidden bg-pink-600 text-white px-3 py-2.5 rounded-lg font-semibold text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
          </div>

          {/* Active filters chips */}
          {(selectedCategory || selectedSupermarket || search) && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {search && (
                <span className="inline-flex items-center gap-1 bg-pink-50 text-pink-700 text-xs px-2.5 py-1 rounded-full font-medium">
                  بحث: {search}
                  <button onClick={() => { setSearch(''); fetchProducts(true) }} className="hover:text-pink-900">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </span>
              )}
              {selectedSupermarket && (
                <span className="inline-flex items-center gap-1 bg-pink-50 text-pink-700 text-xs px-2.5 py-1 rounded-full font-medium">
                  {supermarkets.find(s => s.id === selectedSupermarket)?.nameAr}
                  <button onClick={() => { setSelectedSupermarket(''); setPage(1) }} className="hover:text-pink-900">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </span>
              )}
              {selectedCategory && (
                <span className="inline-flex items-center gap-1 bg-pink-50 text-pink-700 text-xs px-2.5 py-1 rounded-full font-medium">
                  {categories.find(c => c.id === selectedCategory)?.nameAr ||
                    categories.flatMap(c => c.children).find(c => c.id === selectedCategory)?.nameAr}
                  <button onClick={() => { setSelectedCategory(''); setPage(1) }} className="hover:text-pink-900">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </span>
              )}
              <button
                onClick={() => {
                  setSearch('')
                  setSelectedCategory('')
                  setSelectedSupermarket('')
                  setPage(1)
                }}
                className="text-xs text-gray-400 hover:text-red-500 transition"
              >
                مسح الكل
              </button>
            </div>
          )}
        </div>

        {/* Coupon Codes Strip */}
        {coupons.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 bg-pink-600 rounded-full" />
              <h2 className="font-bold text-gray-900 text-sm">
                {selectedSupermarket
                  ? `كوبونات ${supermarkets.find(s => s.id === selectedSupermarket)?.nameAr || ''}`
                  : 'أحدث كوبونات الخصم'}
              </h2>
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
              {coupons.map(coupon => (
                <div
                  key={coupon.id}
                  className="flex-shrink-0 bg-pink-50 rounded-lg p-3 min-w-[200px] border border-pink-100"
                >
                  <div className="text-[10px] text-pink-600 font-medium mb-1">{coupon.store.name}</div>
                  <div className="font-bold text-xs text-gray-800 mb-1.5 line-clamp-1">{coupon.title}</div>
                  <div className="text-pink-700 font-bold text-xs mb-2">{coupon.discountText}</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white border border-dashed border-pink-300 rounded-md px-2 py-1 font-mono text-xs font-bold text-center text-pink-700">
                      {coupon.code}
                    </div>
                    <button
                      id={`copy-${coupon.id}`}
                      onClick={() => handleCopyCode(coupon.code, coupon.id)}
                      className="bg-pink-600 text-white px-2.5 py-1 rounded-md text-xs font-bold hover:bg-pink-700 transition"
                    >
                      نسخ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-5">
          {/* Sidebar Filters (Desktop) */}
          <aside className="hidden md:block w-60 flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sticky top-20">
              <FiltersPanel />
            </div>
          </aside>

          {/* Mobile Filters */}
          {showMobileFilters && (
            <div className="md:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setShowMobileFilters(false)}>
              <div
                className="absolute right-0 top-0 h-full w-80 bg-white p-5 overflow-y-auto shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-bold text-lg text-gray-900">الفلاتر</h2>
                  <button onClick={() => setShowMobileFilters(false)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <FiltersPanel />
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="w-full mt-6 bg-pink-600 text-white py-3 rounded-lg font-bold text-sm"
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
              <div className="mb-3 flex items-center justify-between">
                <span className="text-gray-500 text-sm">
                  عرض {products.length} من {pagination.total} منتج
                </span>
                {pagination.totalPages > 1 && (
                  <span className="text-gray-400 text-xs">
                    صفحة {pagination.page} من {pagination.totalPages}
                  </span>
                )}
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-100 h-72 animate-pulse">
                    <div className="h-40 bg-gray-100 rounded-t-xl" />
                    <div className="p-3 space-y-2">
                      <div className="h-2.5 bg-gray-100 rounded w-3/4" />
                      <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                      <div className="h-4 bg-gray-100 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-gray-500 text-lg mb-1">لا توجد منتجات متطابقة</p>
                {(search || selectedCategory || selectedSupermarket) && (
                  <button
                    onClick={() => {
                      setSearch('')
                      setSelectedCategory('')
                      setSelectedSupermarket('')
                      setPage(1)
                    }}
                    className="mt-3 text-pink-600 hover:underline font-semibold text-sm"
                  >
                    مسح الفلاتر
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {products.map(product => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex justify-center gap-1.5 mt-8">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-2 rounded-lg border border-gray-200 disabled:opacity-30 hover:border-pink-400 hover:text-pink-600 transition text-sm font-medium"
                    >
                      السابق
                    </button>
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      const p = Math.max(1, Math.min(pagination.totalPages - 4, page - 2)) + i
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`w-9 h-9 rounded-lg text-sm font-medium transition ${
                            p === page
                              ? 'bg-pink-600 text-white'
                              : 'border border-gray-200 hover:border-pink-400 hover:text-pink-600'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                      disabled={page === pagination.totalPages}
                      className="px-3 py-2 rounded-lg border border-gray-200 disabled:opacity-30 hover:border-pink-400 hover:text-pink-600 transition text-sm font-medium"
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

      {/* Simple footer for client component */}
      <footer className="bg-gray-900 text-gray-400 mt-16 py-6 pb-20 md:pb-6">
        <div className="container mx-auto px-4 text-center text-sm">
          <p>© {new Date().getFullYear()} SmartCopons - جميع الحقوق محفوظة</p>
          <div className="flex justify-center gap-4 mt-2 text-xs">
            <Link href="/" className="hover:text-white transition">الرئيسية</Link>
            <Link href="/supermarkets" className="hover:text-white transition">المتاجر</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
