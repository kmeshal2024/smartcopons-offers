'use client'

import { useEffect, useState } from 'react'

export interface ListCouponData {
  id: string
  code: string
  title: string
  discountText: string
  destinationUrl: string | null
  isExclusive: boolean
  storeName: string
}

/**
 * The one owned code relevant to a basket.
 *
 * Lives in a hook because TWO surfaces need the same answer: the panel strip
 * above the share button, and the line appended to the WhatsApp message. Fetching
 * it twice would double the request for no reason and could show one code in the
 * panel and a different one in the message.
 *
 * Only fetches when `enabled` (the panel is open), so it costs nothing on views
 * that never open the list. Returns null on any failure — no coupon is the
 * correct failure state, since a dead code with the owner's name on it is worse
 * than none.
 */
export function useListCoupon(storeSlugs: string[], enabled: boolean): ListCouponData | null {
  const [coupon, setCoupon] = useState<ListCouponData | null>(null)
  const key = storeSlugs.join(',')

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    fetch('/api/coupons/for-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slugs: storeSlugs }),
    })
      .then(r => r.json())
      .then(d => {
        if (!cancelled) setCoupon(d?.coupons?.[0] ?? null)
      })
      .catch(() => {
        /* silence is the correct failure state */
      })
    return () => {
      cancelled = true
    }
  }, [key, enabled])

  return coupon
}
