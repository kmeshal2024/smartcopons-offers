/**
 * Country registry — the single source of truth for which markets the site
 * serves and how money is written in each.
 *
 * Added ahead of the UAE launch. Everything was Saudi-only and the currency
 * "ر.س" was hardcoded in 20 places across 9 files, so a second country would
 * have shown Dirham prices labelled as Riyals. Introducing this while there is
 * still exactly one country is deliberate: backfilling a country column after
 * mixed data is already stored is far more painful.
 *
 * `slug` is the URL segment (smartcopons.com/sa, /uae) and does not always
 * match the ISO code — "uae" reads better than "ae" and is what people search.
 */

export type CountryCode = 'SA' | 'AE'

export interface Country {
  code: CountryCode
  /** URL segment. Not always the ISO code. */
  slug: string
  nameAr: string
  nameEn: string
  /** Currency as shown to shoppers, e.g. "ر.س". */
  currencyAr: string
  currencyEn: string
  locale: string
  /** Retailer sites are country-specific; kept here so scrapers stay declarative. */
  hostHint?: string
}

export const COUNTRIES: Record<CountryCode, Country> = {
  SA: {
    code: 'SA',
    slug: 'sa',
    nameAr: 'السعودية',
    nameEn: 'Saudi Arabia',
    currencyAr: 'ر.س',
    currencyEn: 'SAR',
    locale: 'ar-SA',
  },
  AE: {
    code: 'AE',
    slug: 'uae',
    nameAr: 'الإمارات',
    nameEn: 'United Arab Emirates',
    currencyAr: 'د.إ',
    currencyEn: 'AED',
    locale: 'ar-AE',
  },
}

/** Everything stored before the UAE launch is Saudi. */
export const DEFAULT_COUNTRY: CountryCode = 'SA'

export const COUNTRY_LIST: Country[] = Object.values(COUNTRIES)

/** Tolerant lookup — accepts a code ("AE"), a slug ("uae"), null or undefined. */
export function resolveCountry(value?: string | null): Country {
  if (!value) return COUNTRIES[DEFAULT_COUNTRY]
  const v = value.trim().toLowerCase()
  const hit = COUNTRY_LIST.find(c => c.code.toLowerCase() === v || c.slug === v)
  return hit || COUNTRIES[DEFAULT_COUNTRY]
}

/** The Arabic currency label, e.g. "ر.س". */
export function currencyOf(value?: string | null): string {
  return resolveCountry(value).currencyAr
}

/**
 * Price as shoppers see it: "24.00 ر.س".
 * Pass `withCurrency: false` where the label is rendered as a separate element
 * (ProductCard styles the currency smaller than the number).
 */
export function formatPrice(
  amount: number,
  country?: string | null,
  opts: { withCurrency?: boolean } = {}
): string {
  const n = amount.toFixed(2)
  return opts.withCurrency === false ? n : `${n} ${currencyOf(country)}`
}
