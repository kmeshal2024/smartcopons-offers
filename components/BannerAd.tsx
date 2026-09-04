'use client'

import { useEffect, useRef } from 'react'
import type { ServableBanner } from '@/lib/banners'

/**
 * The client half of an ad slot: renders the creative and reports one
 * impression per mount via sendBeacon (fire-and-forget, survives navigation).
 *
 * The click is a plain <a> to the redirect route — the redirect and the count
 * are the same event, so the click number can't drift from reality. rel
 * carries `sponsored` because these are paid/affiliate placements and Google
 * asks for exactly that annotation.
 */
export default function BannerAd({ banner }: { banner: ServableBanner }) {
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

  // Never upscale past the creative's natural width — a 300x250 affiliate
  // creative stretched to a 1280px container is a blurry wall. The image caps
  // at its own width (when known), shrinks responsively, and centers.
  return (
    <div className="text-center">
      <a
        href={`/api/banners/click/${banner.id}`}
        target="_blank"
        rel="nofollow sponsored noopener"
        className="inline-block max-w-full rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
      >
        <img
          src={banner.imageUrl}
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
