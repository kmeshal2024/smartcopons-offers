'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/components/I18nProvider'
import { trackCouponCopy } from '@/lib/track'

export interface ContextCouponData {
  id: string
  code: string
  discountText: string
  destinationUrl: string | null
  isExclusive: boolean
  storeName: string
  storeSlug?: string | null
}

/**
 * One code, chosen for the aisle the shopper is in. Used on product and category
 * pages; see lib/coupon-context.ts for how the match is made.
 *
 * Server-rendered data with a client button, so the code is in the HTML. Renders
 * nothing without a coupon — an empty box would be worse than none.
 */
export default function ContextCoupon({
  coupon,
  surface,
  className = '',
}: {
  coupon: ContextCouponData | null
  surface: 'product_page' | 'category_page'
  className?: string
}) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  if (!coupon) return null

  // window.open runs synchronously inside the handler, BEFORE the clipboard
  // write — after any await the popup blocker kills it.
  const copyAndGo = () => {
    if (coupon.destinationUrl) {
      window.open(coupon.destinationUrl, '_blank', 'noopener,noreferrer')
    }
    navigator.clipboard?.writeText(coupon.code).catch(() => {})
    trackCouponCopy({
      id: coupon.id,
      code: coupon.code,
      surface,
      store: coupon.storeSlug,
      hasDestination: !!coupon.destinationUrl,
    })
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <aside
      className={`rounded-xl border border-dashed border-pink-300 bg-pink-50/60 p-3 ${className}`}
      aria-label={t('contextCoupon.heading', { store: coupon.storeName })}
    >
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-base" aria-hidden="true">🏷️</span>
        <h2 className="text-sm font-bold text-pink-700">
          {t('contextCoupon.heading', { store: coupon.storeName })}
        </h2>
        {/* Only when genuinely flagged in the DB, never decoration. */}
        {coupon.isExclusive && (
          <span className="rounded-full bg-pink-600 px-2 py-0.5 text-[10px] font-bold text-white">
            {t('listCoupon.exclusive')}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[110px] flex-1 rounded-md border border-dashed border-pink-300 bg-white px-3 py-2 text-center font-mono text-sm font-bold text-pink-700">
          {coupon.code}
        </div>
        {coupon.discountText && (
          <p className="min-w-0 flex-1 text-xs font-semibold text-gray-700">{coupon.discountText}</p>
        )}
        <button
          onClick={copyAndGo}
          className={`min-h-11 whitespace-nowrap rounded-lg px-4 text-sm font-bold transition active:scale-95 ${
            copied ? 'bg-green-600 text-white' : 'bg-[#E91E8C] text-white hover:brightness-110'
          }`}
        >
          {copied
            ? t('listCoupon.copied')
            : coupon.destinationUrl
              ? t('listCoupon.copyAndGo')
              : t('listCoupon.copyOnly')}
        </button>
      </div>

      {coupon.storeSlug && (
        <Link
          href={`/coupons/${coupon.storeSlug}`}
          className="mt-2 inline-block text-xs font-semibold text-pink-600 hover:underline"
        >
          {t('contextCoupon.allCodes', { store: coupon.storeName })}
        </Link>
      )}
    </aside>
  )
}
