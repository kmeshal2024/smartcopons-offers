'use client'

import { createContext, useContext } from 'react'
import { t as translate, dirOf, DEFAULT_LANG, type Lang } from '@/lib/i18n'

interface I18nValue {
  lang: Lang
  dir: 'rtl' | 'ltr'
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nValue | null>(null)

/**
 * Seeds client components with the language the server already resolved (from
 * the cookie, in the root layout). Client chrome — Header, ProductCard, the
 * bottom nav — reads it via useI18n() instead of the cookie directly, so it
 * hydrates to exactly what the server rendered.
 */
export default function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const value: I18nValue = {
    lang,
    dir: dirOf(lang),
    t: (key, vars) => translate(lang, key, vars),
  }
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  // A client component rendered outside the provider (shouldn't happen once the
  // layout wraps everything) still works, defaulting to Arabic.
  if (!ctx) return { lang: DEFAULT_LANG, dir: dirOf(DEFAULT_LANG), t: (k, v) => translate(DEFAULT_LANG, k, v) }
  return ctx
}
