'use client'

import { useEffect, useRef } from 'react'
import type { ServableBanner } from '@/lib/banners'

/**
 * The client half of an ad slot: renders the creative and reports one
 * impression per mount via sendBeacon (fire-and-forget, survives navigation).
 *
 * Two creative kinds:
 * - 'image': the network's own creative — capped at its natural width so a
 *   300x250 never stretches into a blurry wall.
 * - 'native': a styled card built from headline/subtitle/ctaText. No external
 *   image request, so ad-blockers (which blanket ad.admitad.com and prf.hn)
 *   can't blank it, and it reads like site content — which is the whole point.
 *
 * Two layout variants:
 * - 'banner': full-width horizontal strip (the default slots).
 * - 'card': a product-card-sized tile for the in-feed slot inside product
 *   grids.
 *
 * The click is a plain <a> to the redirect route — the redirect and the count
 * are the same event, so the click number can't drift from reality. rel
 * carries `sponsored` because these are paid/affiliate placements, and every
 * native unit carries a small "إعلان" label — required by ad policy and it
 * keeps the shopper's trust.
 */

const THEMES: Record<string, string> = {
  green: 'from-emerald-600 to-teal-500',
  orange: 'from-orange-500 to-red-500',
  blue: 'from-sky-600 to-blue-600',
  pink: 'from-pink-600 to-rose-500',
}

const THEME_TEXT: Record<string, string> = {
  green: 'text-emerald-700',
  orange: 'text-orange-600',
  blue: 'text-sky-700',
  pink: 'text-pink-700',
}

export default function BannerAd({
  banner,
  variant = 'banner',
}: {
  banner: ServableBanner
  variant?: 'banner' | 'card'
}) {
  const reported = useRef(false)

  useEffect(() => {
    if (reported.current) return
    reported.current = true
    try {
      const payload = JSON.stringify({ ids: [banner.id] })
      if (!navigator.sendBeacon?.('/api/banners/impression', payload)) {
        fetch('/api/banners/impression', { method: 'POST', body: payload, keepalive: true }).catch(() => {})
      }
    } catch {
      // Counting failed; the ad still shows.
    }
  }, [banner.id])

  const href = `/api/banners/click/${banner.id}`
  const rel = 'nofollow sponsored noopener'

  if (banner.kind === 'native') {
    const gradient = THEMES[banner.theme ?? ''] ?? THEMES.pink
    const ctaColor = THEME_TEXT[banner.theme ?? ''] ?? THEME_TEXT.pink

    if (variant === 'card') {
      // Product-card footprint: fills its grid cell.
      return (
        <a
          href={href}
          target="_blank"
          rel={rel}
          className={`relative flex h-full min-h-[220px] flex-col items-center justify-center gap-2.5 rounded-xl bg-gradient-to-br ${gradient} p-4 text-center text-white shadow-sm transition-shadow hover:shadow-md`}
        >
          <span className="absolute top-2 left-2 rounded bg-white/20 px-1.5 py-0.5 text-[9px] font-semibold">إعلان</span>
          <div className="text-lg font-extrabold leading-snug">{banner.headline}</div>
          {banner.subtitle && (
            <div className="text-xs leading-relaxed text-white/85 line-clamp-3">{banner.subtitle}</div>
          )}
          <span className={`mt-1 rounded-full bg-white px-4 py-1.5 text-sm font-bold ${ctaColor}`}>
            {banner.ctaText}
          </span>
        </a>
      )
    }

    return (
      <a
        href={href}
        target="_blank"
        rel={rel}
        className={`relative flex items-center justify-between gap-3 rounded-xl bg-gradient-to-l ${gradient} px-4 py-3.5 text-white shadow-sm transition-shadow hover:shadow-md sm:px-6 sm:py-4`}
      >
        <span className="absolute top-1.5 left-2 rounded bg-white/20 px-1.5 py-0.5 text-[9px] font-semibold">إعلان</span>
        <div className="min-w-0">
          <div className="text-sm font-extrabold leading-snug sm:text-lg">{banner.headline}</div>
          {banner.subtitle && (
            <div className="mt-0.5 text-[11px] leading-relaxed text-white/85 sm:text-sm line-clamp-2">
              {banner.subtitle}
            </div>
          )}
        </div>
        <span className={`shrink-0 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold sm:px-5 sm:py-2 sm:text-sm ${ctaColor}`}>
          {banner.ctaText}
        </span>
      </a>
    )
  }

  // Image creative — never upscale past the natural width; center it.
  return (
    <div className="text-center">
      <a
        href={href}
        target="_blank"
        rel={rel}
        className="inline-block max-w-full rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
      >
        <img
          src={banner.imageUrl ?? ''}
          alt={banner.title}
          width={banner.width ?? undefined}
          height={banner.height ?? undefined}
          loading="lazy"
          className="h-auto max-w-full"
          style={banner.width ? { width: banner.width } : undefined}
        />
      </a>
    </div>
  )
}
