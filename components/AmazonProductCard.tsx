'use client'

import { trackAmazonClick } from '@/lib/track'
import { amazonUrl } from '@/lib/amazon-catalog'

/**
 * One hand-picked Amazon.sa product. The whole card is the link, straight to
 * amazon.sa with the Associates tag (built from the ASIN, never stored).
 *
 * Shows the DISCOUNT, never a price. `discount` arrives already gated by
 * liveDiscount() on the server, so a stale one is simply absent here and the
 * card falls back to the plain "see the price" call to action.
 */
export default function AmazonProductCard(p: {
  id: string
  asin: string
  title: string
  note: string | null
  imageUrl: string | null
  category: string
  discount: number | null
}) {
  return (
    <a
      href={amazonUrl(p.asin)}
      target="_blank"
      rel="nofollow sponsored noopener"
      onClick={() => trackAmazonClick({ id: p.id, asin: p.asin, category: p.category })}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md"
    >
      {p.discount && (
        <span className="absolute right-2 top-2 z-10 rounded-lg bg-red-600 px-2 py-1 text-xs font-bold text-white shadow">
          خصم {p.discount}%
        </span>
      )}
      <div className="flex aspect-square items-center justify-center bg-white p-3">
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.imageUrl}
            alt={p.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="max-h-full max-w-full object-contain transition group-hover:scale-105"
          />
        ) : (
          <span className="text-5xl text-gray-300">📦</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 border-t border-gray-50 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900">{p.title}</h3>
        {p.note && <p className="line-clamp-1 text-xs text-gray-500">{p.note}</p>}
        <span className="mt-auto pt-2">
          <span className="block rounded-lg bg-[#FF9900] px-3 py-2 text-center text-sm font-bold text-gray-900 group-hover:bg-[#f08804]">
            {p.discount ? 'شاهد العرض على أمازون' : 'شاهد السعر على أمازون'}
          </span>
        </span>
      </div>
    </a>
  )
}
