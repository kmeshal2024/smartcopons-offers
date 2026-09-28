'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/components/I18nProvider'
import { trackCouponCopy } from '@/lib/track'

export interface FeaturedCoupon {
  id: string
  code: string
  discountText: string
  destinationUrl: string | null
  isExclusive: boolean
  storeName: string
  storeSlug?: string | null
  storeLogo?: string | null
}

/**
 * The homepage's coupon row: one code from each store in
 * lib/coupon-priority.ts. Data is fetched on the server, so the codes are in the
 * HTML; this is a client component only for the copy button.
 */
export default function FeaturedCoupons({ coupons }: { coupons: FeaturedCoupon[] }) {
  const { t } = useI18n()
  const [copiedId, setCopiedId] = useState<string | null>(null)
  if (!coupons.length) return null

  // window.open first, synchronously — after an await the popup blocker kills it.
  const copyAndGo = (c: FeaturedCoupon) => {
    if (c.destinationUrl) window.open(c.destinationUrl, '_blank', 'noopener,noreferrer')
    navigator.clipboard?.writeText(c.code).catch(() => {})
    trackCouponCopy({
      id: c.id,
      code: c.code,
      surface: 'home',
      store: c.storeSlug,
      hasDestination: !!c.destinationUrl,
    })
    setCopiedId(c.id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  return (
    <section className="container mx-auto px-4 mt-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-pink-600 rounded-full" />
          <h2 className="text-lg font-bold text-gray-900">{t('home.featuredCoupons')}</h2>
        </div>
        <Link href="/coupons" className="text-pink-600 hover:text-pink-700 text-sm font-semibold">
          {t('common.viewAll')}
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {coupons.map(c => (
          <div
            key={c.id}
            className="flex flex-col rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
          >
            <Link
              href={c.storeSlug ? `/coupons/${c.storeSlug}` : '/coupons'}
              className="mb-2 flex items-center gap-2 hover:opacity-80"
            >
              {c.storeLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.storeLogo} alt={c.storeName} className="h-8 w-8 rounded-full object-contain bg-gray-50" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-50 text-sm">🏷️</span>
              )}
              <span className="min-w-0 truncate text-sm font-bold text-gray-800">{c.storeName}</span>
            </Link>

            <p className="mb-2 min-h-[1.25rem] text-xs font-semibold text-pink-700 line-clamp-1">
              {c.discountText}
            </p>

            <div className="mb-2 rounded-md border border-dashed border-pink-300 bg-pink-50/50 px-2 py-1.5 text-center font-mono text-sm font-bold text-pink-700">
              {c.code}
            </div>

            <button
              onClick={() => copyAndGo(c)}
              className={`mt-auto min-h-10 rounded-lg px-3 text-xs font-bold transition active:scale-95 sm:text-sm ${
                copiedId === c.id ? 'bg-green-600 text-white' : 'bg-[#E91E8C] text-white hover:brightness-110'
              }`}
            >
              {copiedId === c.id
                ? t('listCoupon.copied')
                : c.destinationUrl
                  ? t('listCoupon.copyAndGo')
                  : t('listCoupon.copyOnly')}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
