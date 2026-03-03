'use client'

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
}

export default function RetailerFilters({ slug, categories, currentSort, currentCategory }: RetailerFiltersProps) {
  const router = useRouter()

  const updateFilter = (sort: string, category: string) => {
    const params = new URLSearchParams()
    if (sort && sort !== 'newest') params.set('sort', sort)
    if (category) params.set('category', category)
    const qs = params.toString()
    router.push(`/offers/retailer/${slug}${qs ? `?${qs}` : ''}`)
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 mb-6">
      <div className="flex flex-wrap gap-3 items-center">
        {/* Category chips */}
        <button
          onClick={() => updateFilter(currentSort, '')}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
            !currentCategory
              ? 'bg-pink-600 text-white'
              : 'bg-pink-50 text-pink-600 hover:bg-pink-100'
          }`}
        >
          الكل
        </button>
        {categories.map(cat => (
          <button
            key={cat.slug}
            onClick={() => updateFilter(currentSort, cat.slug)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
              currentCategory === cat.slug
                ? 'bg-pink-600 text-white'
                : 'bg-pink-50 text-pink-600 hover:bg-pink-100'
            }`}
          >
            {cat.icon && <span className="ml-1">{cat.icon}</span>}
            {cat.nameAr}
          </button>
        ))}

        {/* Sort dropdown */}
        <select
          value={currentSort}
          onChange={e => updateFilter(e.target.value, currentCategory)}
          className="mr-auto px-4 py-2 rounded-full border-2 border-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-300 text-sm bg-white"
        >
          <option value="newest">الأحدث</option>
          <option value="price-low">السعر: الأقل</option>
          <option value="price-high">السعر: الأعلى</option>
          <option value="discount">الخصم الأكبر</option>
          <option value="popular">الأكثر مشاهدة</option>
        </select>
      </div>
    </div>
  )
}
