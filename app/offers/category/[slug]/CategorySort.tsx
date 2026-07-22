'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

/**
 * Sort control for the (server-rendered) category page. Kept as the only
 * client component so the product list itself stays crawlable.
 */
export default function CategorySort({ current }: { current: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const onChange = (value: string) => {
    const params = new URLSearchParams(searchParams?.toString() || '')
    if (value && value !== 'newest') params.set('sort', value)
    else params.delete('sort')
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <div className="flex items-center justify-between">
        <span className="text-gray-700 font-semibold">ترتيب حسب:</span>
        <select
          value={current}
          onChange={e => onChange(e.target.value)}
          className="px-4 py-2 rounded-lg border-2 border-pink-200 focus:outline-none focus:ring-4 focus:ring-pink-300 focus:border-pink-500"
        >
          <option value="newest">الأحدث</option>
          <option value="price-low">السعر: الأقل أولاً</option>
          <option value="price-high">السعر: الأعلى أولاً</option>
          <option value="discount">الخصم الأكبر</option>
        </select>
      </div>
    </div>
  )
}
