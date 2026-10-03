import Link from 'next/link'
import { getActiveAmazonProducts, liveDiscount } from '@/lib/amazon'

/**
 * Amazon.sa as a tile in the store lists (/supermarkets and the homepage
 * stores row). Amazon is not a `supermarkets` row (no flyers, no scraped
 * offers), so it is rendered beside them instead of being faked into that
 * table, where it would leak into retailer pages, sitemaps and the scrapers.
 *
 * Reads the same cached list as /amazon, so it costs no extra DB round trip.
 * Renders nothing until there are products.
 */
export default async function AmazonStoreTile({ variant }: { variant: 'directory' | 'home' }) {
  const products = await getActiveAmazonProducts()
  if (products.length === 0) return null

  const now = Date.now()
  const best = products.reduce(
    (m, p) => Math.max(m, liveDiscount(p.discountPercent, p.discountCheckedAt, now) ?? 0),
    0
  )

  if (variant === 'home') {
    return (
      <Link
        href="/amazon"
        className="group text-center p-3 rounded-lg border border-orange-200 bg-orange-50/40 hover:border-orange-300 hover:shadow-md transition-all"
      >
        <div className="w-14 h-14 mx-auto mb-2 bg-[#FF9900] rounded-full flex items-center justify-center group-hover:scale-105 transition-transform text-2xl">
          📦
        </div>
        <span className="text-xs font-semibold text-gray-700 line-clamp-1 block">أمازون</span>
        <span className="text-[10px] text-red-600 font-medium">
          {best > 0 ? `خصم حتى ${best}%` : `${products.length} منتج`}
        </span>
      </Link>
    )
  }

  return (
    <Link
      href="/amazon"
      className="bg-white rounded-xl border border-orange-200 shadow-sm hover:shadow-md hover:border-orange-300 transition-all duration-200 p-5 text-center group"
    >
      <div className="mx-auto mb-3 bg-[#FF9900] rounded-full flex items-center justify-center group-hover:scale-105 transition-transform w-[72px] h-[72px] text-3xl">
        📦
      </div>
      <h2 className="font-bold text-gray-800 text-base mb-0.5">أمازون السعودية</h2>
      <p className="text-gray-400 text-xs mb-3">Amazon.sa</p>
      <div className="flex justify-center gap-2 text-xs flex-wrap">
        {best > 0 && (
          <span className="bg-red-50 text-red-600 px-2.5 py-1 rounded-full font-semibold">
            خصم حتى {best}%
          </span>
        )}
        <span className="bg-orange-50 text-orange-700 px-2.5 py-1 rounded-full font-semibold">
          {products.length} منتج
        </span>
      </div>
    </Link>
  )
}
