'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

interface Category {
  id: string
  nameAr: string
  slug: string
  icon?: string | null
  children: Category[]
  _count: {
    products: number
  }
}

export default function CategorySidebar() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const searchParams = useSearchParams()
  const activeCategory = searchParams?.get('category')

  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => {
        setCategories(data.categories || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="bg-white rounded-lg shadow-md p-4 animate-pulse h-64" />
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className="font-bold text-gray-800 mb-4 text-lg">التصنيفات</h3>
      
      <div className="space-y-2">
        {/* All Categories */}
        <Link
          href="/offers"
          className={`block px-4 py-2 rounded-lg transition ${
            !activeCategory
              ? 'bg-gradient-to-r from-pink-500 to-red-500 text-white'
              : 'text-gray-700 hover:bg-pink-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span>جميع التصنيفات</span>
          </div>
        </Link>

        {/* Main Categories */}
        {categories.filter(c => !c.children || c.children.length === 0).map(category => (
          <div key={category.id}>
            <Link
              href={`/offers/category/${category.slug}`}
              className={`block px-4 py-2 rounded-lg transition ${
                activeCategory === category.slug
                  ? 'bg-gradient-to-r from-pink-500 to-red-500 text-white'
                  : 'text-gray-700 hover:bg-pink-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {category.icon && <span>{category.icon}</span>}
                  <span>{category.nameAr}</span>
                </div>
                <span className="text-xs bg-gray-200 px-2 py-1 rounded-full">
                  {category._count.products}
                </span>
              </div>
            </Link>

            {/* Sub-categories */}
            {category.children && category.children.length > 0 && (
              <div className="mr-4 mt-1 space-y-1">
                {category.children.map(child => (
                  <Link
                    key={child.id}
                    href={`/offers/category/${child.slug}`}
                    className={`block px-4 py-2 rounded-lg text-sm transition ${
                      activeCategory === child.slug
                        ? 'bg-pink-100 text-pink-700 font-semibold'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{child.nameAr}</span>
                      <span className="text-xs text-gray-400">
                        {child._count.products}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Categories with children */}
        {categories.filter(c => c.children && c.children.length > 0).map(category => (
          <div key={category.id}>
            <Link
              href={`/offers/category/${category.slug}`}
              className={`block px-4 py-2 rounded-lg transition ${
                activeCategory === category.slug
                  ? 'bg-gradient-to-r from-pink-500 to-red-500 text-white'
                  : 'text-gray-700 hover:bg-pink-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {category.icon && <span>{category.icon}</span>}
                  <span>{category.nameAr}</span>
                </div>
                <span className="text-xs bg-gray-200 px-2 py-1 rounded-full">
                  {category._count.products}
                </span>
              </div>
            </Link>

            {/* Sub-categories */}
            <div className="mr-4 mt-1 space-y-1">
              {category.children.map(child => (
                <Link
                  key={child.id}
                  href={`/offers/category/${child.slug}`}
                  className={`block px-4 py-2 rounded-lg text-sm transition ${
                    activeCategory === child.slug
                      ? 'bg-pink-100 text-pink-700 font-semibold'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{child.nameAr}</span>
                    <span className="text-xs text-gray-400">
                      {child._count.products}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}