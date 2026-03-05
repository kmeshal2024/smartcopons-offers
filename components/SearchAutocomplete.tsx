'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Suggestion {
  id: string
  nameAr: string | null
  nameEn: string | null
  category?: { nameAr: string; icon?: string | null } | null
  supermarket?: { nameAr: string } | null
}

interface SearchAutocompleteProps {
  className?: string
  placeholder?: string
  variant?: 'header' | 'standalone'
  onClose?: () => void
}

export default function SearchAutocomplete({
  className = '',
  placeholder = 'ابحث عن منتج أو متجر...',
  variant = 'header',
  onClose,
}: SearchAutocompleteProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Debounced search
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([])
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/public/search?q=${encodeURIComponent(q)}&type=products`)
      const data = await res.json()
      const products = (data.products || []).slice(0, 8)
      setSuggestions(products)
      setIsOpen(products.length > 0)
      setHighlightedIndex(-1)
    } catch {
      setSuggestions([])
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

  const navigateToSearch = (searchTerm: string) => {
    router.push(`/offers?search=${encodeURIComponent(searchTerm)}`)
    setQuery('')
    setIsOpen(false)
    setSuggestions([])
    onClose?.()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
      const s = suggestions[highlightedIndex]
      navigateToSearch(s.nameAr || s.nameEn || query)
    } else if (query.trim()) {
      navigateToSearch(query.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1))
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setHighlightedIndex(-1)
    }
  }

  const handleSelectSuggestion = (suggestion: Suggestion) => {
    navigateToSearch(suggestion.nameAr || suggestion.nameEn || '')
  }

  const isHeaderVariant = variant === 'header'

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
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setIsOpen(true) }}
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
              onClick={() => { setQuery(''); setSuggestions([]); setIsOpen(false); inputRef.current?.focus() }}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <button type="submit" className="text-gray-400 hover:text-pink-600 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          )}
        </div>
      </form>

      {/* Autocomplete Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50 animate-dropdown">
          {suggestions.map((suggestion, index) => {
            const name = suggestion.nameAr || suggestion.nameEn || ''
            const categoryName = suggestion.category?.nameAr
            const categoryIcon = suggestion.category?.icon
            return (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => handleSelectSuggestion(suggestion)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`w-full text-right px-4 py-3 flex items-center gap-3 transition-colors text-sm ${
                  index === highlightedIndex ? 'bg-pink-50' : 'hover:bg-gray-50'
                } ${index < suggestions.length - 1 ? 'border-b border-gray-50' : ''}`}
              >
                {/* Category icon or search icon */}
                <span className="text-base flex-shrink-0 w-6 text-center">
                  {categoryIcon || (
                    <svg className="w-4 h-4 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                </span>

                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-900 truncate block">{name}</span>
                  {categoryName && (
                    <span className="text-xs text-gray-400">
                      في <span className="text-pink-600">{categoryName}</span>
                    </span>
                  )}
                </div>

                {/* Arrow */}
                <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )
          })}

          {/* View all results link */}
          {query.trim() && (
            <button
              type="button"
              onClick={() => navigateToSearch(query.trim())}
              className="w-full text-center px-4 py-2.5 bg-gray-50 text-pink-600 text-sm font-medium hover:bg-pink-50 transition"
            >
              عرض كل النتائج لـ &quot;{query.trim()}&quot;
            </button>
          )}
        </div>
      )}

      {/* No results message */}
      {isOpen && suggestions.length === 0 && query.length >= 2 && !isLoading && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 z-50 animate-dropdown">
          <div className="px-4 py-6 text-center text-gray-400 text-sm">
            <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            لا توجد نتائج لـ &quot;{query}&quot;
          </div>
        </div>
      )}
    </div>
  )
}
