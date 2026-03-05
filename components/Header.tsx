'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import SearchAutocomplete from './SearchAutocomplete'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname?.startsWith(href) || false
  }

  const navLinks = [
    { href: '/', label: 'الرئيسية' },
    { href: '/offers', label: 'العروض' },
    { href: '/supermarkets', label: 'المتاجر' },
  ]

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3 h-14 md:h-16">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0">
            <Image
              src="/logo.png.png"
              alt="SmartCopons"
              width={130}
              height={36}
              className="h-8 md:h-9 w-auto"
              priority
            />
          </Link>

          {/* Desktop Search Bar */}
          <div className="hidden md:block flex-1 max-w-xl mx-4">
            <SearchAutocomplete
              variant="header"
              placeholder="ابحث عن منتج، متجر أو تصنيف..."
            />
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex gap-1 items-center flex-shrink-0">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
                  isActive(link.href)
                    ? 'text-pink-600 bg-pink-50'
                    : 'text-gray-600 hover:text-pink-600 hover:bg-gray-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Mobile: Search + Menu */}
          <div className="flex md:hidden items-center gap-0.5 mr-auto">
            <button
              onClick={() => { setSearchOpen(!searchOpen); setMenuOpen(false) }}
              className={`p-2 rounded-lg transition ${searchOpen ? 'text-pink-600 bg-pink-50' : 'text-gray-600 hover:bg-gray-100'}`}
              aria-label="بحث"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <button
              onClick={() => { setMenuOpen(!menuOpen); setSearchOpen(false) }}
              className={`p-2 rounded-lg transition ${menuOpen ? 'text-pink-600 bg-pink-50' : 'text-gray-600 hover:bg-gray-100'}`}
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
          <div className="md:hidden pb-3">
            <SearchAutocomplete
              variant="header"
              placeholder="ابحث عن منتج أو متجر..."
              onClose={() => setSearchOpen(false)}
            />
          </div>
        )}

        {/* Mobile Menu */}
        {menuOpen && (
          <nav className="md:hidden pb-3 border-t border-gray-100 mt-1 pt-2 space-y-0.5">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`block py-2.5 px-3 rounded-lg text-sm font-semibold transition ${
                  isActive(link.href)
                    ? 'text-pink-600 bg-pink-50'
                    : 'text-gray-600 hover:text-pink-600 hover:bg-gray-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  )
}
