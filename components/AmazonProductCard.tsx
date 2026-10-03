'use client'

import { trackAmazonClick } from '@/lib/track'
import { amazonUrl } from '@/lib/amazon-catalog'

/**
 * One hand-picked Amazon.sa product. The whole card is the link, straight to
 * amazon.sa with the Associates tag (built from the ASIN, never stored).
 *
 * No price on purpose: Amazon requires a shown price to be current, and
 * nothing refreshes it until Creators API access opens.
 */
export default function AmazonProductCard(p: {
  id: string
  asin: string
  title: string
  note: string | null
  imageUrl: string | null
  category: string
}) {
  return (
    <a
      href={amazonUrl(p.asin)}
      target="_blank"
      rel="nofollow sponsored noopener"
      onClick={() => trackAmazonClick({ id: p.id, asin: p.asin, category: p.category })}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md"
    >
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
            شاهد السعر على أمازون
          </span>
        </span>
      </div>
    </a>
  )
}
