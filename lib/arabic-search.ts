/**
 * Arabic search normalisation.
 *
 * Postgres `contains` matches bytes, so a shopper typing "ارز" never finds a
 * product stored as "أرز", and "بندة" never matches the store "بنده". Arabic
 * has several orthographic variants that users type interchangeably:
 *
 *   alef          ا  أ  إ  آ
 *   taa marbuta   ة  ه
 *   alef maqsura  ى  ي
 *
 * Rather than rewriting every query as raw SQL, we expand the search term into
 * a bounded set of spelling variants and OR them together. That keeps the
 * queries type-safe Prisma and works without a schema migration.
 */

const ALEF = ['ا', 'أ', 'إ', 'آ']
const HAA = ['ة', 'ه']
const YAA = ['ى', 'ي']

const EQUIVALENTS: Record<string, string[]> = {
  ا: ALEF, أ: ALEF, إ: ALEF, آ: ALEF,
  ة: HAA, ه: HAA,
  ى: YAA, ي: YAA,
}

/** Arabic diacritics (harakat) and tatweel — noise for matching. */
const DIACRITICS = /[ً-ْـ]/g

/**
 * Collapse a string to a canonical form: bare alef, haa, yaa, no diacritics.
 * Useful for comparing/deduping, not for querying the raw DB columns.
 */
export function normalizeArabic(input: string): string {
  return input
    .replace(DIACRITICS, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim()
}

/**
 * Expand a query into the spelling variants worth searching for.
 * Always includes the original term first. Falls back to just the original +
 * canonical form when the term has too many ambiguous letters to expand safely
 * (the variant count grows multiplicatively).
 */
export function arabicVariants(query: string, maxVariants = 12): string[] {
  const term = query.trim().replace(DIACRITICS, '')
  if (!term) return []

  // How many variants would a full expansion produce?
  let combinations = 1
  for (const ch of term) {
    const opts = EQUIVALENTS[ch]
    if (opts) combinations *= opts.length
    if (combinations > maxVariants) break
  }

  if (combinations > maxVariants) {
    const canonical = normalizeArabic(term)
    return canonical && canonical !== term ? [term, canonical] : [term]
  }

  let variants: string[] = ['']
  for (const ch of term) {
    const opts = EQUIVALENTS[ch] ?? [ch]
    const next: string[] = []
    for (const prefix of variants) {
      for (const opt of opts) next.push(prefix + opt)
    }
    variants = next
  }

  // Keep the user's exact spelling first, then the rest, deduped.
  return Array.from(new Set([term, ...variants]))
}

// ----------------------------------------------------------------------------
// Negation / attribute context — "شوكولاتة بدون سكر" is chocolate, not sugar.
// Used to drop matches where the query word appears only as a negated or
// flavour attribute of the product (see /api/offers for the SQL twin, and the
// autocomplete which post-filters in JS because Prisma can't express it).
// ----------------------------------------------------------------------------
const NEG_MARKERS = [
  'بدون', 'بلا', 'خالي', 'خالية', 'خال', 'زيرو', 'دايت', 'لايت', 'منزوع',
  'قليل', 'قليلة', 'منخفض', 'منخفضة', 'عديم', 'بنكهة', 'نكهة', 'بطعم', 'برائحة',
].map(normalizeArabic)

const NOT_LETTER = '[^\\u0600-\\u06FFa-zA-Z0-9]'

/** Did the shopper themselves type a negation ("بدون سكر", "sugar free")? */
export function queryHasNegation(q: string): boolean {
  const norm = normalizeArabic(q)
  if (NEG_MARKERS.some(m => norm.includes(m))) return true
  return /\b(free|zero|diet|light|unsweetened|no[- ]?added|without|low|less)\b/i.test(q)
}

/**
 * True when `name` matches `query` ONLY as a negated/flavour attribute, so it
 * should be dropped — e.g. name "شوكولاتة بدون سكر" for query "سكر". Returns
 * false when the query's head word starts the name (it IS the product), or when
 * the shopper's own query carries a negation (they want the sugar-free item).
 */
export function isNegatedMatch(name: string, query: string): boolean {
  if (queryHasNegation(query)) return false
  const first = normalizeArabic((query.trim().split(/\s+/)[0] || ''))
  if (first.length < 2) return false
  const nn = normalizeArabic(name)
  if (nn.startsWith(first)) return false // head noun — genuinely the product
  const esc = first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // A negation marker within two words BEFORE the query term.
  const re = new RegExp(
    `(?:^|${NOT_LETTER})(?:${NEG_MARKERS.join('|')})(?:\\s+\\S+){0,2}\\s+(?:ال)?${esc}(?:${NOT_LETTER}|$)`
  )
  return re.test(nn)
}

/**
 * Build a Prisma OR filter that matches any of the given text fields against
 * any spelling variant of the query.
 *
 *   where: { OR: arabicContainsFilter(q, ['nameAr', 'nameEn', 'brand']) }
 */
export function arabicContainsFilter(
  query: string,
  fields: string[],
  maxVariants = 12
): any[] {
  const variants = arabicVariants(query, maxVariants)
  const conditions: any[] = []
  for (const field of fields) {
    for (const variant of variants) {
      conditions.push({ [field]: { contains: variant, mode: 'insensitive' } })
    }
  }
  return conditions
}
