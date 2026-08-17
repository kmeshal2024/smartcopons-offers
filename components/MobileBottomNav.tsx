'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/components/I18nProvider'
import { useShoppingList } from '@/hooks/useShoppingList'
import { useCartPanel } from '@/hooks/useCartPanel'

export default function MobileBottomNav() {
  const pathname = usePathname()
  const { t } = useI18n()
  const { totals } = useShoppingList()
  const { isOpen, toggle } = useCartPanel()

  // Don't show on admin pages
  if (pathname?.startsWith('/admin')) return null

  const navItems = [
    {
      label: t('nav.home'),
      href: '/',
      icon: (active: boolean) => (
        <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 1.8}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      label: t('nav.offers'),
      href: '/offers',
      icon: (active: boolean) => (
        <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 1.8}
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
    },
    {
      label: t('nav.favorites'),
      href: '/favorites',
      icon: (active: boolean) => (
        <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 1.8}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
    },
    {
      label: t('nav.stores'),
      href: '/supermarkets',
      icon: (active: boolean) => (
        <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 1.8}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
  ]

  // While the shopping-list panel is open, no ROUTE item is current — the panel is
  // what the user is looking at. Previously the nav kept highlighting whatever page
  // sat behind the overlay (المتاجر, typically), which read as if the user were on
  // the store directory.
  const isActive = (href: string) => {
    if (isOpen) return false
    if (href === '/') return pathname === '/'
    return pathname?.startsWith(href) || false
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
      <div className="flex justify-around items-center h-14 max-w-lg mx-auto">
        {navItems.map(item => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                active ? 'text-pink-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {item.icon(active)}
              <span className={`text-[10px] mt-0.5 ${active ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}

        {/* Shopping list — a real nav item with a live count, replacing the floating
            button that rendered behind this very bar (z-40 under the nav's z-50). */}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isOpen}
          aria-label={
            totals.units > 0
              ? `${t('cart.title')} (${totals.units})`
              : t('cart.title')
          }
          className={`relative flex flex-col items-center justify-center flex-1 h-full transition-colors ${
            isOpen ? 'text-pink-600' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <span className="relative">
            <svg className="w-5 h-5" fill={isOpen ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isOpen ? 0 : 1.8}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {totals.units > 0 && (
              // Count is already in the button's aria-label, so don't read it twice.
              <span
                aria-hidden="true"
                className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E91E8C] px-1 text-[10px] font-bold leading-none text-white"
              >
                {totals.units}
              </span>
            )}
          </span>
          <span className={`text-[10px] mt-0.5 ${isOpen ? 'font-bold' : 'font-medium'}`}>
            {t('nav.list')}
          </span>
        </button>
      </div>
      {/* Safe area padding for notched phones */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  )
}
