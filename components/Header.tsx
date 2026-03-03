'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="bg-gradient-to-r from-pink-600 to-red-500 text-white shadow-lg sticky top-0 z-40">
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-extrabold tracking-tight">Smart<span className="text-pink-200">Copons</span></span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex gap-6 items-center">
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

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-white/10 transition"
            aria-label="القائمة"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <nav className="md:hidden pt-3 pb-1 border-t border-white/20 mt-3 space-y-2">
            <Link href="/" onClick={() => setMenuOpen(false)} className="block py-2 hover:text-pink-200 font-semibold">
              الرئيسية
            </Link>
            <Link href="/offers" onClick={() => setMenuOpen(false)} className="block py-2 hover:text-pink-200 font-semibold">
              العروض
            </Link>
            <Link href="/supermarkets" onClick={() => setMenuOpen(false)} className="block py-2 hover:text-pink-200 font-semibold">
              المتاجر
            </Link>
          </nav>
        )}
      </div>
    </header>
  )
}
