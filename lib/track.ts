/**
 * GA4 custom events.
 *
 * components/Analytics.tsx only ever sent page_view, so nothing a shopper DID
 * was measurable — not a copied coupon, not an item added to the list, not a
 * share. Every interactive surface now reports through this one function, which
 * keeps the event names in one place (GA4 treats `coupon_copy` and
 * `copy_coupon` as unrelated events, and a typo is invisible until the report
 * is empty).
 *
 * Never throws and never blocks: analytics failing — an ad blocker, gtag not
 * loaded yet, server render — must not break the click it is attached to.
 *
 * Names follow GA4's recommended events where one exists (`search`, `share`,
 * `add_to_wishlist`) so the built-in reports pick them up; the rest are custom.
 */
export type TrackEvent =
  | 'coupon_copy'
  | 'add_to_list'
  | 'add_to_wishlist'
  | 'share'
  | 'price_watch_start'
  | 'search'
  | 'search_suggestion_click'
  | 'pwa_install'

type Params = Record<string, string | number | boolean | null | undefined>

export function track(event: TrackEvent, params: Params = {}): void {
  if (typeof window === 'undefined') return
  try {
    const gtag = (window as any).gtag
    if (typeof gtag !== 'function') return
    // GA4 drops undefined/null params inconsistently — strip them here.
    const clean: Record<string, string | number | boolean> = {}
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') clean[k] = v
    }
    gtag('event', event, clean)
  } catch {
    /* analytics must never break the interaction */
  }
}

/**
 * A copied coupon, recorded twice on purpose.
 *
 * GA4 answers "what do shoppers do"; it cannot answer "which of my 135 codes is
 * worth keeping", because ad blockers drop a large share of gtag calls and GA4
 * samples and delays. So the copy is ALSO counted first-party, per code per day,
 * in the site's own database — that count is what the admin stats page reads.
 *
 * sendBeacon rather than fetch: most copy buttons open the merchant in a new tab
 * in the same click, and a beacon is the one request type the browser promises
 * to deliver while the page is losing focus.
 */
export function trackCouponCopy(p: {
  id?: string | null
  code: string
  surface: string
  store?: string | null
  hasDestination?: boolean
}): void {
  track('coupon_copy', {
    coupon_id: p.id,
    coupon_code: p.code,
    surface: p.surface,
    store: p.store,
    has_destination: p.hasDestination,
  })
  if (typeof window === 'undefined') return
  try {
    const body = JSON.stringify({ id: p.id || undefined, code: p.code, surface: p.surface })
    const sent =
      typeof navigator.sendBeacon === 'function' &&
      navigator.sendBeacon('/api/coupons/copy', new Blob([body], { type: 'application/json' }))
    if (!sent) {
      void fetch('/api/coupons/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {})
    }
  } catch {
    /* counting must never break the copy */
  }
}
