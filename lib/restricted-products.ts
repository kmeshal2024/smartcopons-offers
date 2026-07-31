/**
 * Age-restricted products that must never appear in the app.
 *
 * Huawei AppGallery's content-rating question 17 asks whether the app contains
 * "age-restricted products or activities, such as drugs, medical activities,
 * alcohol, tobacco, electronic cigarettes, or firearms". Retailer flyers carry
 * cigarettes, and the pharmacy scrapers carry over-the-counter medicines, so
 * answering it honestly forced a 16+ rating on what is a family grocery app.
 * Hiding these offers lets the questionnaire be answered "No" truthfully and
 * brings the rating down to 3+.
 *
 * Matching is on the product name/brand only — there is no category or barcode
 * field that reliably marks these.
 *
 * IMPORTANT: brand names that are also ordinary Arabic words are deliberately
 * NOT listed. "كنت" (Kent) also means "you were" and "فوق" (Fauq) also means
 * "above"; substring-matching them would hide large numbers of innocent
 * products. Every real tobacco offer observed in the data carries the category
 * word (سجائر / تبغ) in its name anyway, so the generic terms catch them.
 */

/** Tobacco, shisha and vaping. */
const TOBACCO = [
  'سجائر', 'سيجارة', 'سجاير', 'تبغ', 'دخان', 'معسل', 'شيشة', 'نرجيلة', 'أرجيلة', 'ارجيلة',
  'نيكوتين', 'سحبة', 'فيب',
  'cigarette', 'cigar', 'tobacco', 'shisha', 'hookah', 'nicotine', 'vape', 'e-liquid',
  'marlboro', 'winston', 'pall mall', 'dunhill', 'rothmans', 'davidoff', 'l&m', 'gauloises',
]

/** Over-the-counter medicines. Supplements and vitamins are NOT restricted. */
const MEDICINE = [
  'بنادول', 'بانادول', 'أدول', 'ادول', 'بروفين', 'اسبرين', 'أسبرين', 'باراسيتامول',
  'ايبوبروفين', 'إيبوبروفين', 'فيفادول', 'كونجستال', 'مسكن ألم', 'مسكن الم', 'خافض حرارة',
  'panadol', 'adol', 'brufen', 'ibuprofen', 'paracetamol', 'acetaminophen', 'aspirin',
  'antibiotic', 'painkiller',
]

/** Alcohol — not sold in Saudi Arabia, included so the filter stays complete. */
const ALCOHOL = ['خمر', 'نبيذ', 'مشروب كحولي', 'beer', 'wine', 'whisky', 'whiskey', 'vodka', 'alcoholic']

export const RESTRICTED_TERMS = [...TOBACCO, ...MEDICINE, ...ALCOHOL]

/**
 * Non-alcoholic beer and alcohol-free products are legitimate supermarket
 * items and must survive the ALCOHOL terms above.
 */
const ALLOW = ['non-alcoholic', 'alcohol free', 'alcohol-free', 'بدون كحول', 'خالي من الكحول', 'شعير']

/** Arabic letter variants, so "أسبرين" and "اسبرين" both match one term. */
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

const NORM_TERMS = RESTRICTED_TERMS.map(normalize)
const NORM_ALLOW = ALLOW.map(normalize)

/** True when the offer is age-restricted and must be hidden from the app. */
export function isRestrictedProduct(
  ...fields: Array<string | null | undefined>
): boolean {
  const hay = normalize(fields.filter(Boolean).join(' '))
  if (!hay) return false
  if (NORM_ALLOW.some(a => hay.includes(a))) return false
  return NORM_TERMS.some(t => hay.includes(t))
}

/** The matching term, for logging and dry-run reports. */
export function restrictedReason(
  ...fields: Array<string | null | undefined>
): string | null {
  const hay = normalize(fields.filter(Boolean).join(' '))
  if (!hay || NORM_ALLOW.some(a => hay.includes(a))) return null
  const i = NORM_TERMS.findIndex(t => hay.includes(t))
  return i === -1 ? null : RESTRICTED_TERMS[i]
}
