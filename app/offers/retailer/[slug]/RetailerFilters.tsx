'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Category {
  nameAr: string
  slug: string
  icon?: string | null
}

interface RetailerFiltersProps {
  slug: string
  categories: Category[]
  currentSort: string
  currentCategory: string
  currentSearch: string
  totalResults: number
}

export default function RetailerFilters({
  slug, categories, currentSort, currentCategory, currentSearch, totalResults
}: RetailerFiltersProps) {
  const router = useRouter()
  const [searchValue, setSearchValue] = useState(currentSearch)

  const buildUrl = (overrides: { sort?: string; category?: string; search?: string }) => {
    const params = new URLSearchParams()
    const sort = overrides.sort ?? currentSort
    const category = overrides.category ?? currentCategory
    const search = overrides.search ?? currentSearch
    if (sort && sort !== 'newest') params.set('sort', sort)
    if (category) params.set('category', category)
    if (search) params.set('search', search)
    const qs = params.toString()
    return `/offers/retailer/${slug}${qs ? `?${qs}` : ''}`
  }

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault()
    router.push(buildUrl({ search: searchValue.trim() }))
  }

  const clearSearch = () => {
    setSearchValue('')
    router.push(buildUrl({ search: '' }))
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-5">
      {/* Search + Sort Row */}
      <div className="p-3 sm:p-4 flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-center">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 relative">
          {/* Search icon */}
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="ابحث عن منتج..."
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            className="w-full pr-9 pl-9 py-2 sm:py-2.5 rounded-lg border border-gray-200 bg-gray-50
                       focus:outline-none focus:ring-2 focus:ring-pink-100 focus:border-pink-400 focus:bg-white
                       text-sm placeholder-gray-400 transition"
          />
          {/* Clear button */}
          {searchValue && (
            <button type="button" onClick={clearSearch}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 hover:text-gray-600 transition">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </form>

        {/* Sort + Count */}
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-gray-400 whitespace-nowrap hidden sm:inline">
            {totalResults} نتيجة
          </span>
          <select
            value={currentSort}
            onChange={e => router.push(buildUrl({ sort: e.target.value }))}
            className="px-3 py-2 sm:py-2.5 rounded-lg border border-gray-200 text-sm bg-gray-50
                       focus:outline-none focus:ring-2 focus:ring-pink-100 focus:border-pink-400
                       transition min-w-[120px]"
          >
            <option value="newest">الأحدث</option>
            <option value="price-low">السعر: الأقل</option>
            <option value="price-high">السعر: الأعلى</option>
            <option value="discount">الخصم الأكبر</option>
            <option value="popular">الأكثر مشاهدة</option>
          </select>
        </div>
      </div>

      {/* Category Pills */}
      {categories.length > 0 && (
        <div className="border-t border-gray-50 px-3 sm:px-4 py-2.5">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            <button
              onClick={() => router.push(buildUrl({ category: '' }))}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                !currentCategory
                  ? 'bg-pink-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              الكل
            </button>
            {categories.map(cat => (
              <button
                key={cat.slug}
                onClick={() => router.push(buildUrl({ category: cat.slug }))}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  currentCategory === cat.slug
                    ? 'bg-pink-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.icon && <span className="ml-1">{cat.icon}</span>}
                {cat.nameAr}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Filters */}
      {(currentSearch || currentCategory) && (
        <div className="border-t border-gray-50 px-3 sm:px-4 py-2 flex flex-wrap gap-1.5 items-center">
          {currentSearch && (
            <span className="inline-flex items-center gap-1 bg-pink-50 text-pink-700 text-[11px] px-2.5 py-1 rounded-full font-medium">
              بحث: {currentSearch}
              <button onClick={clearSearch} className="hover:text-pink-900 mr-0.5">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          )}
          {currentCategory && (
            <span className="inline-flex items-center gap-1 bg-pink-50 text-pink-700 text-[11px] px-2.5 py-1 rounded-full font-medium">
              {categories.find(c => c.slug === currentCategory)?.icon}{' '}
              {categories.find(c => c.slug === currentCategory)?.nameAr}
              <button onClick={() => router.push(buildUrl({ category: '' }))} className="hover:text-pink-900 mr-0.5">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          )}
          <button
            onClick={() => { setSearchValue(''); router.push(`/offers/retailer/${slug}`) }}
            className="text-[11px] text-gray-400 hover:text-red-500 transition mr-1"
          >
            مسح الكل
          </button>
        </div>
      )}
    </div>
  )
}
