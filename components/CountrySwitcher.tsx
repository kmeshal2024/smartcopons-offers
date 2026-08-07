'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { COUNTRY_LIST, countryFromPath, resolveCountry } from '@/lib/countries'

/** Flag per market. Emoji rather than image files — no request, no layout shift. */
const FLAG: Record<string, string> = { SA: '🇸🇦', AE: '🇦🇪' }

/**
 * Market picker for the header.
 *
 * Switching keeps the shopper on the equivalent page rather than dumping them
 * on a homepage: /offers <-> /ae/offers. Store and product paths are the
 * exception — a Saudi store id means nothing in the UAE — so those fall back to
 * that market's offers list.
 */
export default function CountrySwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const current = resolveCountry(countryFromPath(pathname))
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [])

  const switchTo = (code: string) => {
    const target = resolveCountry(code)
    if (target.code === current.code) return setOpen(false)

    // Strip the current market's prefix to get the bare page.
    let rest = pathname || '/'
    if (current.basePath && rest.startsWith(current.basePath)) {
      rest = rest.slice(current.basePath.length) || '/'
    }
    // Ids and slugs do not carry across markets.
    if (/^\/(product|store|flyers)\//.test(rest)) rest = '/offers'

    setOpen(false)
    router.push(`${target.basePath}${rest === '/' ? '' : rest}` || '/')
  }

  return (
    <div className="relative flex-shrink-0" ref={box}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="تغيير الدولة"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm font-semibold text-gray-700 transition hover:border-pink-300 hover:text-pink-600"
      >
        <span className="text-base leading-none">{FLAG[current.code]}</span>
        <span className="hidden sm:inline">{current.nameAr}</span>
        <svg className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 w-44 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
          {COUNTRY_LIST.map(c => (
            <button
              key={c.code}
              onClick={() => switchTo(c.code)}
              className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-right text-sm transition ${
                c.code === current.code
                  ? 'bg-pink-50 font-bold text-pink-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="text-base leading-none">{FLAG[c.code]}</span>
              <span className="flex-1 text-right">{c.nameAr}</span>
              {c.code === current.code && (
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 111.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
