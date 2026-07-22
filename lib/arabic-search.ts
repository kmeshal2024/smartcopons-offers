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
