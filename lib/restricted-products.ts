/**
 * Age-restricted products that must never appear in the app.
 *
 * Huawei AppGallery's content-rating question 17 asks whether the app contains
 * "age-restricted products or activities, such as drugs, medical activities,
 * alcohol, tobacco, electronic cigarettes, or firearms". Retailer flyers carry
 * cigarettes and the pharmacy scrapers carry over-the-counter medicine, so
 * answering it honestly forced a 16+ rating on what is a family grocery app.
 * Hiding these offers lets the questionnaire be answered "No" truthfully and
 * brings the rating down to 3+.
 *
 * Matching is on the product name/brand only — there is no category or barcode
 * field that reliably marks these.
 *
 * Two rules learned from running this against all 34k live offers:
 *
 * 1. MATCH ON WORD BOUNDARIES, NEVER BARE SUBSTRINGS. A substring pass hid
 *    "فيبريز" (Febreze air freshener) and "مايكرو فيبر" (microfibre pillow)
 *    because both contain "فيب" (vape), and "خمرة الطيب" (a perfume) because
 *    it contains "خمر".
 *
 * 2. NO ALCOHOL TERMS. Alcohol is not sold in Saudi Arabia, so the category is
 *    moot, and the terms only did harm: "beer" matched the frozen-food brand
 *    "Al Kabeer" (prawns, fish fingers, paratha), and the Heineken/Holsten
 *    entries in these flyers are the non-alcoholic malt drinks.
 *
 * Brand names that are also ordinary Arabic words are likewise excluded:
 * "كنت" (Kent) also means "you were" and "فوق" (Fauq) also means "above".
 * Every real tobacco offer in the data carries the category word سجائر or
 * تبغ anyway, so the generic terms catch them.
 */

/** Tobacco, shisha and vaping. */
const TOBACCO = [
  'سجائر', 'سجاير', 'سيجارة', 'سيجار', 'تبغ', 'دخان', 'معسل', 'شيشة',
  'نرجيلة', 'ارجيلة', 'نيكوتين', 'فيب', 'سحبة',
  'cigarette', 'cigarettes', 'cigar', 'tobacco', 'shisha', 'hookah',
  'nicotine', 'vape', 'e-cigarette',
  'marlboro', 'winston', 'pall mall', 'dunhill', 'rothmans', 'davidoff',
  'chesterfield', 'parliament',
]

/** Over-the-counter medicine. Vitamins and supplements are NOT restricted. */
const MEDICINE = [
  'بنادول', 'بانادول', 'ادول', 'بروفين', 'اسبرين', 'باراسيتامول',
  'ايبوبروفين', 'فيفادول', 'كونجستال',
  'panadol', 'adol', 'brufen', 'ibuprofen', 'paracetamol', 'acetaminophen',
  'aspirin',
]

export const RESTRICTED_TERMS = [...TOBACCO, ...MEDICINE]

/**
 * Products that mention a restricted term but are themselves innocent.
 * Whitening toothpaste is advertised as removing tobacco stains — "معجون أسنان
 * المضاد للتبغ" and "مبيض لمستخدمي القهوة والشاي والتبغ" are Crest and Colgate,
 * not tobacco. Checked before the restricted terms.
 */
const ALLOW = [
  'معجون اسنان', 'toothpaste', 'غسول فم', 'mouthwash', 'مبيض اسنان',
]

/** Arabic letter variants, so "أسبرين" and "اسبرين" collapse to one term. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[أإآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * A term must sit on a word boundary. Arabic glues the definite article and
 * conjunctions onto the front of a word, so those are allowed as a prefix —
 * "السجائر" is still tobacco, while "مايكروفيبر" is not a vape.
 */
function buildPattern(term: string): RegExp {
  const esc = normalize(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(
    `(?<![\\p{L}\\p{N}])(?:ال|وال|بال|فال|لل|و|ب|ل)?${esc}(?![\\p{L}\\p{N}])`,
    'u'
  )
}

const PATTERNS: Array<{ term: string; re: RegExp }> = RESTRICTED_TERMS.map(t => ({
  term: t,
  re: buildPattern(t),
}))

/** True when the offer is age-restricted and must be hidden from the app. */
export function isRestrictedProduct(...fields: Array<string | null | undefined>): boolean {
  return restrictedReason(...fields) !== null
}

const NORM_ALLOW = ALLOW.map(normalize)

/** The matching term, for logging and dry-run reports. */
export function restrictedReason(...fields: Array<string | null | undefined>): string | null {
  const hay = normalize(fields.filter(Boolean).join(' '))
  if (!hay) return null
  if (NORM_ALLOW.some(a => hay.includes(a))) return null
  const hit = PATTERNS.find(p => p.re.test(hay))
  return hit ? hit.term : null
}
