'use client'

import { getValidity, formatRangeAr, type Validity } from '@/lib/flyer-utils'

interface ExpiryBadgeProps {
  /** Deal start date (flyer.startDate). Optional. */
  validFrom?: string | Date | null
  /** Deal end date (flyer.endDate). Drives the whole badge. */
  validTo?: string | Date | null
  size?: 'sm' | 'md'
  /** Show the "12 مارس – 19 مارس" range under the badge. */
  showDates?: boolean
  /** When there is no end date, render nothing instead of "عرض ساري". */
  hideWhenOpenEnded?: boolean
  className?: string
}

/**
 * Pill badge showing deal urgency in Arabic:
 *   • expired  → grey  "انتهى العرض"
 *   • today    → red    "ينتهي اليوم!"
 *   • ≤3 days  → red    "ينتهي خلال X أيام"
 *   • ≤7 days  → amber
 *   • else     → green
 */
export default function ExpiryBadge({
  validFrom,
  validTo,
  size = 'sm',
  showDates = false,
  hideWhenOpenEnded = true,
  className = '',
}: ExpiryBadgeProps) {
  if (!validTo && hideWhenOpenEnded) return null

  const v = getValidity(validFrom, validTo)
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'

  return (
    <div className={`flex flex-col items-start gap-0.5 ${className}`}>
      <span
        className={`inline-flex items-center gap-1 rounded-full font-bold ${pad} ${v.badgeClass} ${
          v.kind === 'today' ? 'animate-pulse' : ''
        }`}
      >
        {(v.kind === 'today' || v.kind === 'expiring') && <span aria-hidden>⏳</span>}
        {v.label}
      </span>
      {showDates && validTo && (
        <span className="text-[10px] text-gray-400">{formatRangeAr(validFrom, validTo)}</span>
      )}
    </div>
  )
}

/**
 * Helper for the deal CARD wrapper: returns classes that grey-out & disable
 * pointer interaction when the deal has expired. Spread onto the card root.
 *
 *   const v = getValidity(p.flyer?.startDate, p.flyer?.endDate)
 *   <div className={`...base... ${dealCardClasses(v)}`}>
 */
export function dealCardClasses(validity: Validity): string {
  return validity.isExpired ? 'opacity-50 grayscale pointer-events-none select-none' : ''
}
