import { createHash } from 'crypto'
import { normalizeName } from './services/category-rules'

/**
 * Stable product identity.
 *
 * An OFFER is one store's price for something during one flyer; its row is
 * replaced whenever the price changes. A PRODUCT is the thing itself at that
 * store, and outlives every offer made for it. Product pages are moving from the
 * offer's id to the product's, so that a URL survives a price change — see
 * app/api/admin/migrate-products for the full reasoning and the phase plan.
 *
 * Both functions here are pure, and they are the ONLY definition of what makes
 * two offers "the same product". The backfill and the nightly ingest must agree
 * exactly, or one product ends up with two pages.
 */

export interface ProductIdentity {
  nameAr?: string | null
  nameEn?: string | null
  brand?: string | null
  sizeText?: string | null
}

/**
 * Units are normalised before comparing: the same item arrives as "400 غرام",
 * "400 جم" and "400g" depending on the week and the scraper, and "2X500" as
 * "2×500". None of those is a different product.
 */
// Patterns are strings compiled with the RegExp constructor: the project's TS
// target predates the `u` flag in a regex literal. Longest spelling first within
// each unit, and kg/ml before g/l, so "كيلو غرام" is never read as "غرام".
const UNIT_FORMS: Array<[string, string]> = [
  ['كيلو ?غرام|كيلو ?جرام|كيلو|كغم|كجم|كغ|كج|kilograms?|kilos?|kgs?', 'kg'],
  ['ميلي ?لتر|ملي ?لتر|مليلتر|مل|millilit(?:er|re)s?|mls?', 'ml'],
  ['غرام|جرام|غم|جم|grams?|gms?|gm|g', 'g'],
  ['لتر|ليتر|lit(?:er|re)s?|ltr|l', 'l'],
  ['حبات|حبه|قطعه|قطع|pieces?|pcs?', 'pc'],
]
const UNIT_REGEXES: Array<[RegExp, string]> = UNIT_FORMS.map(([forms, unit]) => [
  new RegExp('(\\d)\\s*(?:' + forms + ')(?![\\p{L}])', 'gu'),
  unit,
])

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩'

function canonical(text: string): string {
  let s = text
    // Arabic-Indic digits → Latin, so "٤٠٠" and "400" compare equal.
    .replace(/[٠-٩]/g, d => String(ARABIC_INDIC.indexOf(d)))
    // Multiplication signs used in pack sizes.
    .replace(/[×*]/g, 'x')
  s = normalizeName(s)
  // "2 x 500" and "2x500"; "400 g" and "400g".
  s = s.replace(/(\d)\s*x\s*(\d)/g, '$1x$2')
  for (const [re, unit] of UNIT_REGEXES) s = s.replace(re, '$1' + unit)
  return s.replace(/\s+/g, ' ').trim()
}

/**
 * The key that identifies a product within ONE store.
 *
 * Name, then brand and size when the scraper supplies them separately. They are
 * part of the key because some stores publish terse names — Bin Dawood lists
 * "حليب طازج كامل الدسم" for every dairy brand, with the brand and the size in
 * their own fields — and the name alone would merge Almarai 1 L with Nadec 2 L.
 * A brand or size that already appears in the name is not repeated.
 */
export function productKey(p: ProductIdentity): string {
  const name = canonical(p.nameAr || p.nameEn || '')
  if (!name) return ''
  const parts = [name]
  for (const extra of [p.brand, p.sizeText]) {
    const e = canonical(extra || '')
    if (e && !name.includes(e)) parts.push(e)
  }
  return parts.join('|')
}

/**
 * Deterministic id, so neither the backfill nor ingest has to look a product up
 * before linking an offer to it — the id can be computed from the offer alone.
 *
 * Always starts with "p". Offer ids are cuids and always start with "c", which
 * lets /product/{id} tell a stable id from a legacy offer id at a glance.
 */
export function productId(supermarketId: string, key: string): string {
  const hash = createHash('sha256').update(`${supermarketId}|${key}`).digest('hex')
  return `p${hash.slice(0, 23)}`
}
