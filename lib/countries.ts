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
 * `slug` is the URL segment. Saudi keeps its own subdomain for now; every new
 * market is a subfolder on the apex, named by ISO code so the pattern scales
 * predictably as more countries are added.
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
  /** Origin this market is served from. */
  siteUrl: string
  /**
   * Path prefix under that origin. Saudi keeps the bare root of its own
   * subdomain; new markets are subfolders on the apex (smartcopons.com/ae).
   */
  basePath: string
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
    siteUrl: 'https://sa.smartcopons.com',
    basePath: '',
  },
  AE: {
    code: 'AE',
    slug: 'ae',
    nameAr: 'الإمارات',
    nameEn: 'United Arab Emirates',
    currencyAr: 'د.إ',
    currencyEn: 'AED',
    locale: 'ar-AE',
    siteUrl: 'https://smartcopons.com',
    basePath: '/ae',
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
 * Which market a request is asking about.
 *
 * Reads `?country=` (accepting either the code or the url slug) and falls back
 * to Saudi. Every listing query must scope by this, otherwise UAE offers with
 * Dirham prices surface on the Saudi site next to Riyal ones.
 *
 * Once smartcopons.com/uae exists this is also where the path segment gets
 * read — keeping the resolution in one place is the point.
 */
export function countryFromRequest(request: Request): CountryCode {
  try {
    return resolveCountry(new URL(request.url).searchParams.get('country')).code
  } catch {
    return DEFAULT_COUNTRY
  }
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

/**
 * Absolute URL for a path within a market.
 *   urlFor('SA', '/offers')  -> https://sa.smartcopons.com/offers
 *   urlFor('AE', '/offers')  -> https://smartcopons.com/ae/offers
 * Canonicals and sitemaps must go through this — hardcoding the Saudi host is
 * how a UAE page ends up telling Google it is really a Saudi one.
 */
export function urlFor(country: string | null | undefined, path = '/'): string {
  const c = resolveCountry(country)
  const p = path.startsWith('/') ? path : `/${path}`
  return `${c.siteUrl}${c.basePath}${p === '/' ? '' : p}` || c.siteUrl
}

/** Path within the current market, for internal <Link href>. */
export function pathFor(country: string | null | undefined, path = '/'): string {
  const c = resolveCountry(country)
  const p = path.startsWith('/') ? path : `/${path}`
  return `${c.basePath}${p}` || '/'
}

/**
 * Does a coupon store serve this market?
 *
 * `stores.countries` is a comma list ("SA,AE") because a coupon store is often
 * GCC-wide — Noon, Namshi and Centrepoint all trade in both markets. An empty
 * value means globally valid (AliExpress, iHerb), so it serves everywhere.
 */
export function storeServesCountry(countries: string | null | undefined, code: string): boolean {
  const list = (countries || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
  if (!list.length) return true
  return list.includes(resolveCountry(code).code)
}

/**
 * Which market a URL path belongs to: /ae/offers -> AE, /offers -> SA.
 *
 * Client components derive the market from the path rather than taking a prop,
 * so shared chrome (header, search) follows whichever section the shopper is
 * in without every page having to pass it down. Without this the header search
 * on /ae sent shoppers to the Saudi results.
 */
export function countryFromPath(pathname?: string | null): CountryCode {
  if (!pathname) return DEFAULT_COUNTRY
  const first = pathname.split('/').filter(Boolean)[0]?.toLowerCase()
  const hit = COUNTRY_LIST.find(c => c.basePath && c.slug === first)
  return hit ? hit.code : DEFAULT_COUNTRY
}
