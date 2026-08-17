'use client'

import { useState } from 'react'
import { useI18n } from '@/components/I18nProvider'
import type { ListCouponData } from '@/hooks/useListCoupon'

export default function ListCoupon({ coupon }: { coupon: ListCouponData | null }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)

  if (!coupon) return null

  /**
   * Copy the code, and open the merchant when we know where that is.
   *
   * These are owned partner codes: the CODE is the attribution, so copying alone
   * is a complete action and the button stays useful with no URL at all. When a
   * destination IS known it opens too, saving the shopper a search.
   *
   * window.open must run synchronously inside the click handler — after any
   * `await` the popup blocker kills it. The previous coupon UI copied the code
   * and left the shopper holding it with nowhere to go; the clipboard write is
   * fired after, and its failure is irrelevant to the navigation.
   */
  const copyAndGo = () => {
    if (coupon.destinationUrl) {
      window.open(coupon.destinationUrl, '_blank', 'noopener,noreferrer')
    }
    navigator.clipboard?.writeText(coupon.code).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mb-3 rounded-xl border border-dashed border-pink-300 bg-pink-50/60 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-base">🏷️</span>
        <span className="text-xs font-semibold text-pink-700">
          {coupon.storeName
            ? t('listCoupon.headingStore', { store: coupon.storeName })
            : t('listCoupon.heading')}
        </span>
        {/* Only when genuinely flagged in the DB — not a decorative label. */}
        {coupon.isExclusive && (
          <span className="rounded-full bg-pink-600 px-2 py-0.5 text-[10px] font-bold text-white">
            {t('listCoupon.exclusive')}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-lg border border-dashed border-pink-300 bg-white px-3 py-2 text-center font-mono text-sm font-bold text-pink-700">
          {coupon.code}
        </div>
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

      {coupon.discountText && (
        <p className="mt-1.5 text-center text-[11px] text-gray-500">{coupon.discountText}</p>
      )}
    </div>
  )
}
