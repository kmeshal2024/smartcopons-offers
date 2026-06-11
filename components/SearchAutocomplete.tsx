'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface ProductHit {
  id: string
  nameAr: string | null
  nameEn: string | null
  category?: { nameAr: string; icon?: string | null } | null
}
interface StoreHit { id: string; nameAr: string; slug: string; logo?: string | null }
interface CategoryHit { id: string; nameAr: string; slug: string; icon?: string | null }

interface Results {
  products: ProductHit[]
  stores: StoreHit[]
  categories: CategoryHit[]
}

type FlatOption =
  | { kind: 'recent'; label: string }
  | { kind: 'product'; label: string; hit: ProductHit }
  | { kind: 'store'; label: string; hit: StoreHit }
  | { kind: 'category'; label: string; hit: CategoryHit }

interface SearchAutocompleteProps {
  className?: string
  placeholder?: string
  variant?: 'header' | 'standalone'
  onClose?: () => void
}

const EMPTY: Results = { products: [], stores: [], categories: [] }

export default function SearchAutocomplete({
  className = '',
  placeholder = 'ابحث عن منتج أو متجر...',
  variant = 'header',
  onClose,
}: SearchAutocompleteProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Results>(EMPTY)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [recent, setRecent] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const RECENT_KEY = 'sc_recent_searches_v1'
  const MAX_RECENT = 6
  const listboxId = 'sc-autocomplete-listbox'

  // Load recent searches once
  useEffect(() => {
    try {
      setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'))
    } catch {
      setRecent([])
    }
  }, [])

  const saveRecent = (term: string) => {
    const t = term.trim()
    if (!t) return
    const next = [t, ...recent.filter(r => r !== t)].slice(0, MAX_RECENT)
    setRecent(next)
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const clearRecent = () => {
    setRecent([])
    try {
      localStorage.removeItem(RECENT_KEY)
    } catch {
      /* ignore */
    }
  }

  const showRecent = isOpen && query.trim().length < 2 && recent.length > 0
  const hasResults = results.products.length + results.stores.length + results.categories.length > 0

  // Flattened option list (drives keyboard navigation + ARIA indices)
  const flat: FlatOption[] = showRecent
    ? recent.map(label => ({ kind: 'recent', label }))
    : [
        ...results.products.map<FlatOption>(hit => ({ kind: 'product', label: hit.nameAr || hit.nameEn || '', hit })),
        ...results.stores.map<FlatOption>(hit => ({ kind: 'store', label: hit.nameAr, hit })),
        ...results.categories.map<FlatOption>(hit => ({ kind: 'category', label: hit.nameAr, hit })),
      ]

  // Debounced grouped search
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(EMPTY)
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch(`/api/public/search?q=${encodeURIComponent(q)}&type=all`)
      const data = await res.json()
      setResults({
        products: (data.products || []).slice(0, 6),
        stores: (data.stores || []).slice(0, 5),
        categories: (data.categories || []).slice(0, 5),
      })
      setHighlightedIndex(-1)
    } catch {
      setResults(EMPTY)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, fetchSuggestions])

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const reset = () => {
    setQuery('')
    setIsOpen(false)
    setResults(EMPTY)
    setHighlightedIndex(-1)
    onClose?.()
  }

  const navigateToSearch = (searchTerm: string) => {
    saveRecent(searchTerm)
    router.push(`/offers?search=${encodeURIComponent(searchTerm)}`)
    reset()
  }

  const selectOption = (opt: FlatOption) => {
    switch (opt.kind) {
      case 'recent':
      case 'product':
        navigateToSearch(opt.label)
        break
      case 'store':
        router.push(`/offers?supermarket=${opt.hit.id}`)
        reset()
        break
      case 'category':
        router.push(`/offers?category=${opt.hit.slug}`)
        reset()
        break
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (highlightedIndex >= 0 && flat[highlightedIndex]) {
      selectOption(flat[highlightedIndex])
    } else if (query.trim()) {
      navigateToSearch(query.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      setHighlightedIndex(-1)
      return
    }
    if (!isOpen || flat.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(prev => (prev < flat.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : flat.length - 1))
    }
  }

  const isHeaderVariant = variant === 'header'

  // Running index so each option gets a unique, sequential id across groups.
  let idx = -1
  const optionProps = (i: number) => ({
    id: `${listboxId}-opt-${i}`,
    role: 'option' as const,
    'aria-selected': i === highlightedIndex,
    onMouseEnter: () => setHighlightedIndex(i),
  })
  const rowCls = (i: number) =>
    `w-full text-right px-4 py-2.5 flex items-center gap-3 text-sm transition-colors ${
      i === highlightedIndex ? 'bg-pink-50' : 'hover:bg-gray-50'
    }`

  const showPanel = isOpen && (showRecent || hasResults || isLoading || (query.trim().length >= 2 && !isLoading))

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        {/* Search Icon */}
        <svg
          className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
            isHeaderVariant ? 'text-pink-500' : 'text-gray-400'
          }`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>

        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={highlightedIndex >= 0 ? `${listboxId}-opt-${highlightedIndex}` : undefined}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full pr-10 pl-10 rounded-full transition text-sm ${
            isHeaderVariant
              ? 'py-2.5 border border-gray-200 bg-gray-50 focus:bg-white focus:border-pink-400 focus:ring-2 focus:ring-pink-100 text-gray-800 placeholder-gray-400'
              : 'py-3 border border-gray-300 bg-white focus:border-pink-400 focus:ring-2 focus:ring-pink-100 text-gray-800 placeholder-gray-400'
          } focus:outline-none`}
        />

        {/* Loading spinner or clear button */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <svg className="w-4 h-4 text-pink-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : query ? (
            <button
              type="button"
              onClick={() => { setQuery(''); setResults(EMPTY); inputRef.current?.focus() }}
              aria-label="مسح"
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <button type="submit" aria-label="بحث" className="text-gray-400 hover:text-pink-600 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          )}
        </div>
      </form>

      {showPanel && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="نتائج البحث"
          className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50 animate-dropdown max-h-[70vh] overflow-y-auto"
        >
          {/* Recent searches */}
          {showRecent && (
            <div>
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-50">
                <span className="text-xs font-bold text-gray-400">عمليات بحث سابقة</span>
                <button type="button" onClick={clearRecent} className="text-xs text-gray-400 hover:text-red-500">
                  مسح
                </button>
              </div>
              {recent.map(term => {
                idx += 1
                const i = idx
                return (
                  <button key={term} type="button" {...optionProps(i)} onClick={() => selectOption({ kind: 'recent', label: term })} className={rowCls(i)}>
                    <span className="text-gray-300">🕘</span>
                    <span className="flex-1 text-gray-700 truncate">{term}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Products */}
          {!showRecent && results.products.length > 0 && (
            <div>
              <div className="px-4 py-1.5 text-xs font-bold text-gray-400 bg-gray-50/50">منتجات</div>
              {results.products.map(hit => {
                idx += 1
                const i = idx
                const name = hit.nameAr || hit.nameEn || ''
                return (
                  <button key={hit.id} type="button" {...optionProps(i)} onClick={() => selectOption({ kind: 'product', label: name, hit })} className={rowCls(i)}>
                    <span className="text-base flex-shrink-0 w-6 text-center">{hit.category?.icon || '🏷️'}</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-900 truncate block">{name}</span>
                      {hit.category?.nameAr && (
                        <span className="text-xs text-gray-400">في <span className="text-pink-600">{hit.category.nameAr}</span></span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Stores */}
          {!showRecent && results.stores.length > 0 && (
            <div>
              <div className="px-4 py-1.5 text-xs font-bold text-gray-400 bg-gray-50/50">متاجر</div>
              {results.stores.map(hit => {
                idx += 1
                const i = idx
                return (
                  <button key={hit.id} type="button" {...optionProps(i)} onClick={() => selectOption({ kind: 'store', label: hit.nameAr, hit })} className={rowCls(i)}>
                    {hit.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={hit.logo} alt="" className="w-6 h-6 rounded-full object-contain flex-shrink-0" />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-pink-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{hit.nameAr.charAt(0)}</span>
                    )}
                    <span className="flex-1 text-gray-800 truncate">{hit.nameAr}</span>
                    <span className="text-xs text-gray-300">متجر</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Categories */}
          {!showRecent && results.categories.length > 0 && (
            <div>
              <div className="px-4 py-1.5 text-xs font-bold text-gray-400 bg-gray-50/50">فئات</div>
              {results.categories.map(hit => {
                idx += 1
                const i = idx
                return (
                  <button key={hit.id} type="button" {...optionProps(i)} onClick={() => selectOption({ kind: 'category', label: hit.nameAr, hit })} className={rowCls(i)}>
                    <span className="text-base flex-shrink-0 w-6 text-center">{hit.icon || '📂'}</span>
                    <span className="flex-1 text-gray-800 truncate">{hit.nameAr}</span>
                    <span className="text-xs text-gray-300">فئة</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* View all */}
          {!showRecent && hasResults && query.trim() && (
            <button
              type="button"
              onClick={() => navigateToSearch(query.trim())}
              className="w-full text-center px-4 py-2.5 bg-gray-50 text-pink-600 text-sm font-medium hover:bg-pink-50 transition border-t border-gray-50"
            >
              عرض كل النتائج لـ &quot;{query.trim()}&quot;
            </button>
          )}

          {/* No results */}
          {!showRecent && !hasResults && !isLoading && query.trim().length >= 2 && (
            <div className="px-4 py-6 text-center text-gray-400 text-sm">
              <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              لا توجد نتائج لـ &quot;{query}&quot;
            </div>
          )}
        </div>
      )}
    </div>
  )
}
