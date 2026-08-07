'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { LANG_COOKIE } from '@/lib/i18n'
import { useI18n } from '@/components/I18nProvider'

/**
 * Toggles the UI language. Writes the cookie and calls router.refresh() so the
 * server re-renders every component — chrome and page bodies alike — in the new
 * language and direction. Sits in the header next to the country picker.
 */
export default function LanguageSwitcher() {
  const router = useRouter()
  const { lang } = useI18n()
  const [pending, start] = useTransition()

  const toggle = () => {
    const next = lang === 'ar' ? 'en' : 'ar'
    // One year, root path, Lax — a plain UI preference, no need for anything stricter.
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
    start(() => router.refresh())
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      aria-label={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
      className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm font-semibold text-gray-700 transition hover:border-pink-300 hover:text-pink-600 disabled:opacity-50"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5h12M9 3v2m1.5 12L6 5m0 0L1.5 17M21 21l-4-9-4 9m1-2h6" />
      </svg>
      {/* Shows the language you'd switch TO */}
      <span>{lang === 'ar' ? 'EN' : 'ع'}</span>
    </button>
  )
}
