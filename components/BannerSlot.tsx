import { getActiveBanners, pickBanner, type BannerPlacement } from '@/lib/banners'
import BannerAd from '@/components/BannerAd'

/**
 * Server-rendered ad slot. Renders nothing at all when no banner is scheduled
 * for this placement/market — no placeholder box, no layout cost.
 *
 * The banner list is cached (lib/banners.ts); the winner among equal-priority
 * creatives is re-picked per request so they split impressions.
 */
export default async function BannerSlot({
  placement,
  country = 'SA',
  className = '',
  variant = 'banner',
}: {
  placement: BannerPlacement
  country?: string
  className?: string
  /** 'card' renders a product-card-sized tile for use INSIDE a product grid. */
  variant?: 'banner' | 'card'
}) {
  const banner = pickBanner(await getActiveBanners(placement, country))
  if (!banner) return null

  // The card variant is a grid cell: no wrapper, the tile itself fills the cell.
  if (variant === 'card') return <BannerAd banner={banner} variant="card" />

  // No container classes here — pages differ in whether the slot sits inside
  // an already-padded <main>, so the caller passes its own layout classes.
  return (
    <div className={className}>
      <BannerAd banner={banner} />
    </div>
  )
}
