'use client'

import { CITIES, ALL_CITIES } from '@/lib/cities'
import { useCity } from '@/hooks/useCity'

interface Props {
  /** Render as a sticky bar pinned below the header. */
  sticky?: boolean
  /** Distance from top when sticky (e.g. header height). */
  topClass?: string
}

export default function CityFilterBar({ sticky = true, topClass = 'top-0' }: Props) {
  const [selected, setSelected] = useCity()

  const pills = [{ slug: ALL_CITIES, nameAr: 'كل المدن' }, ...CITIES]

  return (
    <div
      className={`z-30 border-b border-pink-100 bg-white/90 backdrop-blur ${sticky ? `sticky ${topClass}` : ''}`}
      dir="rtl"
    >
      <div className="container mx-auto px-3">
        <div className="flex items-center gap-2 overflow-x-auto py-2.5 scrollbar-hide">
          <span className="flex flex-shrink-0 items-center gap-1 pl-1 text-sm font-semibold text-gray-500">
            <svg className="h-4 w-4 text-[#E91E8C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            المدينة:
          </span>

          {pills.map((c) => {
            const isActive = selected === c.slug
            return (
              <button
                key={c.slug}
                onClick={() => setSelected(c.slug)}
                aria-pressed={isActive}
                className={`relative flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'scale-105 bg-[#E91E8C] text-white shadow-md shadow-pink-500/30'
                    : 'bg-pink-50 text-gray-600 hover:bg-pink-100 hover:text-[#E91E8C]'
                }`}
              >
                {c.nameAr}
                {isActive && (
                  <span className="absolute -bottom-2 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#E91E8C]" />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
