// ============================================================================
// Flyer / deal validity helpers — shared by the Flyer Viewer (Feature 1) and
// the deal-expiry badges on cards (Feature 2). All UI strings are Arabic (RTL).
// ============================================================================

export const BRAND = '#E91E8C' // SmartCopons pink

export type ValidityKind = 'active' | 'expiring' | 'today' | 'expired'

export interface Validity {
  kind: ValidityKind
  /** Calendar days until endDate. 0 = expires today, negative = already expired. */
  daysRemaining: number
  /** Arabic label, e.g. "ينتهي خلال ٣ أيام" / "ينتهي اليوم!" / "انتهى العرض". */
  label: string
  /** Tailwind classes for a pill badge (background + text). */
  badgeClass: string
  /** Tailwind classes for a small status dot. */
  dotClass: string
  isExpired: boolean
}

function startOfDay(d: Date): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

/** Arabic-aware day count: "يوم واحد" / "يومين" / "٣ أيام" / "١٢ يوماً". */
function arabicDays(n: number): string {
  if (n === 1) return 'يوم واحد'
  if (n === 2) return 'يومين'
  if (n >= 3 && n <= 10) return `${n} أيام`
  return `${n} يوماً`
}

/**
 * Compute validity status for a deal/flyer given its start and end dates.
 * `now` is injectable for testing / SSR-determinism.
 */
export function getValidity(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
  now: Date = new Date()
): Validity {
  const today = startOfDay(now)

  if (!end) {
    return {
      kind: 'active',
      daysRemaining: Infinity,
      label: 'عرض ساري',
      badgeClass: 'bg-emerald-100 text-emerald-700',
      dotClass: 'bg-emerald-500',
      isExpired: false,
    }
  }

  const endDay = startOfDay(new Date(end))
  const daysRemaining = Math.round((endDay - today) / 86_400_000)

  // Already started in the future? Treat as active but show a "starts in" hint.
  if (start) {
    const startDay = startOfDay(new Date(start))
    if (startDay > today) {
      const inDays = Math.round((startDay - today) / 86_400_000)
      return {
        kind: 'active',
        daysRemaining,
        label: `يبدأ خلال ${arabicDays(inDays)}`,
        badgeClass: 'bg-sky-100 text-sky-700',
        dotClass: 'bg-sky-500',
        isExpired: false,
      }
    }
  }

  if (daysRemaining < 0) {
    return {
      kind: 'expired',
      daysRemaining,
      label: 'انتهى العرض',
      badgeClass: 'bg-gray-200 text-gray-500',
      dotClass: 'bg-gray-400',
      isExpired: true,
    }
  }

  if (daysRemaining === 0) {
    return {
      kind: 'today',
      daysRemaining,
      label: 'ينتهي اليوم!',
      badgeClass: 'bg-red-600 text-white',
      dotClass: 'bg-red-500',
      isExpired: false,
    }
  }

  if (daysRemaining <= 3) {
    return {
      kind: 'expiring',
      daysRemaining,
      label: `ينتهي خلال ${arabicDays(daysRemaining)}`,
      badgeClass: 'bg-red-100 text-red-700',
      dotClass: 'bg-red-500',
      isExpired: false,
    }
  }

  if (daysRemaining <= 7) {
    return {
      kind: 'active',
      daysRemaining,
      label: `ينتهي خلال ${arabicDays(daysRemaining)}`,
      badgeClass: 'bg-amber-100 text-amber-700',
      dotClass: 'bg-amber-500',
      isExpired: false,
    }
  }

  return {
    kind: 'active',
    daysRemaining,
    label: `ينتهي خلال ${arabicDays(daysRemaining)}`,
    badgeClass: 'bg-emerald-100 text-emerald-700',
    dotClass: 'bg-emerald-500',
    isExpired: false,
  }
}

/** Format a date as Arabic "12 مارس". */
export function formatDateAr(date: string | Date | null | undefined): string {
  if (!date) return ''
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
      day: 'numeric',
      month: 'long',
    }).format(new Date(date))
  } catch {
    return ''
  }
}

/** "12 مارس – 19 مارس" validity range string. */
export function formatRangeAr(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined
): string {
  const s = formatDateAr(start)
  const e = formatDateAr(end)
  if (s && e) return `${s} – ${e}`
  return e || s
}

// ----------------------------------------------------------------------------
// Page-image derivation
// ----------------------------------------------------------------------------
// The Flyer model stores `coverImage` + `totalPages` but NOT individual page
// URLs. We derive the per-page image paths from a naming convention. If your
// extraction pipeline writes pages somewhere else, this is the ONE function to
// change — the viewer itself is storage-agnostic and just consumes string[].
//
// Convention assumed (matches the seed's "/sample-flyers/panda-cover.jpg"):
//   cover:  <prefix>-cover.<ext>
//   page N: <prefix>-page-<N>.<ext>     (N starts at 1)
// Fallback when the cover doesn't match: /flyers/<id>/page-<N>.jpg
// ----------------------------------------------------------------------------
export interface FlyerPageSource {
  id: string
  coverImage?: string | null
  totalPages?: number | null
}

export function derivePageUrls(flyer: FlyerPageSource): string[] {
  const count = Math.max(flyer.totalPages || 0, flyer.coverImage ? 1 : 0)
  if (count === 0) return []

  const cover = flyer.coverImage || ''
  const coverMatch = cover.match(/^(.*?)-cover\.(jpg|jpeg|png|webp)$/i)

  if (coverMatch) {
    const [, prefix, ext] = coverMatch
    return Array.from({ length: count }, (_, i) => `${prefix}-page-${i + 1}.${ext}`)
  }

  // Fallback: keep the cover as page 1, derive the rest by id.
  return Array.from({ length: count }, (_, i) =>
    i === 0 && cover ? cover : `/flyers/${flyer.id}/page-${i + 1}.jpg`
  )
}
