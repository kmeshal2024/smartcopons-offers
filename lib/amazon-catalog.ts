/**
 * Amazon.sa affiliate constants and pure helpers.
 *
 * Kept free of Prisma (and of any server import) on purpose: the client admin
 * page imports parseAsin and the category list from here, and a server import
 * in this file would ship the DB client to the browser — see lib/amazon.ts for
 * the query side.
 */

/** Amazon.sa Associates tracking id. A tag only earns on the marketplace it was issued for. */
export const AMAZON_SA_TAG = 'smartcopons0b-21'

/**
 * Required by the Associates Operating Agreement wherever the links appear.
 * Arabic first because the page is Arabic; the English sentence is Amazon's
 * own wording.
 */
export const AMAZON_DISCLOSURE =
  'بصفتنا مشاركين في برنامج أمازون للمسوّقين بالعمولة، نحصل على عمولة من عمليات الشراء المؤهلة. As an Amazon Associate we earn from qualifying purchases.'

export const AMAZON_CATEGORIES = [
  { slug: 'grocery', label: 'بقالة ومشروبات', emoji: '🛒' },
  { slug: 'personal-care', label: 'العناية الشخصية والجمال', emoji: '🧴' },
  { slug: 'baby-care', label: 'الأطفال والأمهات', emoji: '🍼' },
  { slug: 'household', label: 'المنزل والتنظيف', emoji: '🏠' },
  { slug: 'kitchen', label: 'المطبخ والأجهزة الصغيرة', emoji: '🍳' },
  { slug: 'electronics', label: 'إلكترونيات وإكسسوارات', emoji: '🔌' },
] as const

export const AMAZON_CATEGORY_SLUGS = AMAZON_CATEGORIES.map(c => c.slug) as [
  (typeof AMAZON_CATEGORIES)[number]['slug'],
  ...(typeof AMAZON_CATEGORIES)[number]['slug'][],
]

const ASIN_RE = /^[A-Z0-9]{10}$/

/**
 * Pull the ASIN out of whatever the admin pastes: a bare ASIN, a /dp/ or
 * /gp/product/ URL, or a SiteStripe link. Returns null for amzn.to short links
 * — those hide the ASIN behind a redirect, so the admin must paste the full URL.
 */
export function parseAsin(input: string): string | null {
  const s = input.trim()
  if (ASIN_RE.test(s.toUpperCase()) && !s.includes('/')) return s.toUpperCase()
  const m = s.match(/\/(?:dp|gp\/product|gp\/aw\/d|product)\/([A-Za-z0-9]{10})(?:[/?#]|$)/)
  return m ? m[1].toUpperCase() : null
}

export function isAsin(s: string): boolean {
  return ASIN_RE.test(s)
}

/**
 * How long a recorded discount stays on the page. Amazon deals change daily, and
 * a "خصم 30%" that ended yesterday is a promise the shopper finds broken at
 * checkout, so after this the card falls back to the plain "see the price" CTA
 * until the discount is re-checked.
 *
 * 54, not 48: the refresh runs every two days (scheduled task
 * smartcopons-amazon-discount-refresh) and stamps at the END of a ~25-minute
 * run, so 48 would blank every badge for part of each run. 6h of slack also
 * covers the run starting late because the app was closed.
 */
export const AMAZON_DISCOUNT_MAX_AGE_HOURS = 54

/** The discount to show right now, or null when there is none or it is stale. */
export function liveDiscount(
  percent: number | null | undefined,
  checkedAt: Date | string | null | undefined,
  now: number = Date.now()
): number | null {
  if (!percent || percent < 5 || !checkedAt) return null
  const t = new Date(checkedAt).getTime()
  if (!Number.isFinite(t) || now - t > AMAZON_DISCOUNT_MAX_AGE_HOURS * 3600_000) return null
  return percent
}

/** The affiliate link. Short /dp/ form plus the tag — what SiteStripe itself produces. */
export function amazonUrl(asin: string): string {
  return `https://www.amazon.sa/dp/${asin}?tag=${AMAZON_SA_TAG}`
}
