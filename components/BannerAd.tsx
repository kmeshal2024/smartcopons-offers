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

  return (
    <a
      href={`/api/banners/click/${banner.id}`}
      target="_blank"
      rel="nofollow sponsored noopener"
      className="block rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
    >
      <img
        src={banner.imageUrl}
        alt={banner.title}
        width={banner.width ?? undefined}
        height={banner.height ?? undefined}
        loading="lazy"
        className="w-full h-auto"
      />
    </a>
  )
}
