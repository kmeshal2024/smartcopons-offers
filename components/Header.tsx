'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchValue.trim()) {
      router.push(`/offers?search=${encodeURIComponent(searchValue.trim())}`)
      setSearchOpen(false)
      setSearchValue('')
      setMenuOpen(false)
    }
  }

  return (
    <header className="bg-gradient-to-r from-pink-600 to-red-500 text-white shadow-lg sticky top-0 z-40">
      <div className="container mx-auto px-4 py-2.5">
        <div className="flex justify-between items-center gap-3">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xl sm:text-2xl font-extrabold tracking-tight">Smart<span className="text-pink-200">Copons</span></span>
          </Link>

          {/* Desktop Search Bar */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="ابحث عن منتج أو متجر..."
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
                className="w-full pr-10 pl-4 py-2 rounded-lg bg-white/15 border border-white/20 text-white placeholder-white/60
                           focus:outline-none focus:bg-white/25 focus:border-white/40 text-sm transition"
              />
              <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>

          {/* Desktop Nav */}
          <nav className="hidden md:flex gap-5 items-center flex-shrink-0">
            <Link href="/" className="hover:text-pink-200 transition font-semibold text-sm">
              الرئيسية
            </Link>
            <Link href="/offers" className="hover:text-pink-200 transition font-semibold text-sm">
              العروض
            </Link>
            <Link href="/supermarkets" className="hover:text-pink-200 transition font-semibold text-sm">
              المتاجر
            </Link>
          </nav>

          {/* Mobile: Search + Menu */}
          <div className="flex md:hidden items-center gap-1">
            <button
              onClick={() => { setSearchOpen(!searchOpen); setMenuOpen(false) }}
              className="p-2 rounded-lg hover:bg-white/10 transition"
              aria-label="بحث"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <button
              onClick={() => { setMenuOpen(!menuOpen); setSearchOpen(false) }}
              className="p-2 rounded-lg hover:bg-white/10 transition"
              aria-label="القائمة"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        {searchOpen && (
          <form onSubmit={handleSearch} className="md:hidden pt-2.5 pb-1">
            <div className="relative">
              <input
                type="text"
                placeholder="ابحث عن منتج أو متجر..."
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
                autoFocus
                className="w-full pr-10 pl-4 py-2.5 rounded-lg bg-white/15 border border-white/20 text-white placeholder-white/60
                           focus:outline-none focus:bg-white/25 focus:border-white/40 text-sm transition"
              />
              <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>
        )}

        {/* Mobile Menu */}
        {menuOpen && (
          <nav className="md:hidden pt-2.5 pb-1 border-t border-white/20 mt-2.5 space-y-1">
            <Link href="/" onClick={() => setMenuOpen(false)} className="block py-2 hover:text-pink-200 font-semibold text-sm">
              الرئيسية
            </Link>
            <Link href="/offers" onClick={() => setMenuOpen(false)} className="block py-2 hover:text-pink-200 font-semibold text-sm">
              العروض
            </Link>
            <Link href="/supermarkets" onClick={() => setMenuOpen(false)} className="block py-2 hover:text-pink-200 font-semibold text-sm">
              المتاجر
            </Link>
          </nav>
        )}
      </div>
    </header>
  )
}
