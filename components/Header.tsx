'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import SearchAutocomplete from './SearchAutocomplete'
import CountrySwitcher from './CountrySwitcher'
import LanguageSwitcher from './LanguageSwitcher'
import { useI18n } from '@/components/I18nProvider'
import { countryFromPath, pathFor, resolveCountry } from '@/lib/countries'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const { t } = useI18n()

  // Every link is built for the market in the URL, so the header works
  // unchanged on /ae without each page passing a country down.
  const country = countryFromPath(pathname)
  const base = resolveCountry(country).basePath
  const href = (p: string) => pathFor(country, p)

  const isActive = (h: string) => {
    if (h === base || h === '/') return pathname === (base || '/')
    return pathname?.startsWith(h) || false
  }

  // /offers has its own richer search + sort + filter bar, so don't double up
  // the header search there.
  const showSearch = pathname !== '/offers' && pathname !== `${base}/offers`

  const navLinks = [
    { href: href('/'), label: t('nav.home') },
    { href: href('/offers'), label: t('nav.offers') },
    { href: href('/coupons'), label: t('nav.coupons') },
    // The retailer directory is Saudi-only for now, so it is hidden rather
    // than 404ing under /ae.
    ...(country === 'SA' ? [{ href: '/supermarkets', label: t('nav.stores') }] : []),
  ]

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3 h-14 md:h-16">
          {/* Logo */}
          <Link href={href('/')} className="flex-shrink-0">
            <Image
              src="/logo.png.png"
              alt="SmartCopons"
              width={130}
              height={36}
              className="h-8 md:h-9 w-auto"
              priority
            />
          </Link>

          {/* Market picker — beside the logo so it is reachable on phones, not
              buried in the desktop-only nav. */}
          <CountrySwitcher />

          {/* Language toggle (AR/EN) — next to the market picker. */}
          <LanguageSwitcher />

          {/* Desktop Search Bar */}
          {showSearch ? (
            <div className="hidden md:block flex-1 max-w-xl mx-4">
              <SearchAutocomplete
                variant="header"
                placeholder={t('search.placeholder')}
              />
            </div>
          ) : (
            <div className="hidden md:block flex-1" />
          )}

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

          {/* Mobile: Menu only — the search bar is a persistent row below */}
          <div className="flex md:hidden items-center mr-auto">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`p-2 rounded-lg transition ${menuOpen ? 'text-pink-600 bg-pink-50' : 'text-gray-600 hover:bg-gray-100'}`}
              aria-label={t('a11y.menu')}
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

        {/* Mobile Search Bar — always visible, so it never feels missing.
            Hidden on /offers, which has its own search + filter bar. */}
        {showSearch && (
          <div className="md:hidden pb-2.5 -mt-0.5">
            <SearchAutocomplete
              variant="header"
              placeholder={t('search.placeholder')}
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
