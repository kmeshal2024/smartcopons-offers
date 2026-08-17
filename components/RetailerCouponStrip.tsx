'use client'

import { useState } from 'react'
import { useI18n } from '@/components/I18nProvider'
import type { RenderableCoupon } from '@/lib/offer-queries'

/**
 * Owned codes for ONE retailer, on that retailer's page.
 *
 * Contextual by construction: only codes whose `supermarketId` matches this
 * store are passed in, so a shopper looking at Nahdi's offers is never shown a
 * noon code. When there is no match the component renders nothing at all — an
 * empty strip would be worse than none, and most retailer pages will have no
 * code until more are added.
 *
 * Server-rendered data, client component only for the copy interaction, so the
 * codes are in the HTML rather than fetched after paint.
 */
export default function RetailerCouponStrip({
  coupons,
}: {
  coupons: Array<Pick<RenderableCoupon, 'id' | 'code' | 'discountText' | 'destinationUrl' | 'isExclusive'>>
}) {
  const { t } = useI18n()
  const [copiedId, setCopiedId] = useState<string | null>(null)

  if (!coupons.length) return null

  /**
   * window.open runs synchronously inside the handler, BEFORE the clipboard
   * write — after any await the popup blocker kills it. Copy alone is still a
   * complete action, since the code itself is the attribution.
   */
  const copyAndGo = (c: (typeof coupons)[number]) => {
    if (c.destinationUrl) {
      window.open(c.destinationUrl, '_blank', 'noopener,noreferrer')
    }
    navigator.clipboard?.writeText(c.code).catch(() => {})
    setCopiedId(c.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="mb-5 rounded-xl border border-dashed border-pink-300 bg-pink-50/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base">🏷️</span>
        <h2 className="text-sm font-bold text-pink-700">{t('retailerCoupon.heading')}</h2>
      </div>

      <div className="flex flex-wrap gap-2">
        {coupons.map(c => (
          <div
            key={c.id}
            className="flex flex-1 min-w-[240px] items-center gap-2 rounded-lg bg-white p-2"
          >
            <div className="flex-1 rounded-md border border-dashed border-pink-300 px-3 py-2 text-center font-mono text-sm font-bold text-pink-700">
              {c.code}
            </div>
            <div className="min-w-0 flex-1">
              {c.discountText && (
                <p className="truncate text-xs font-semibold text-gray-700">{c.discountText}</p>
              )}
              {/* Only when genuinely flagged in the DB, never decoration. */}
              {c.isExclusive && (
                <span className="mt-0.5 inline-block rounded-full bg-pink-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  {t('listCoupon.exclusive')}
                </span>
              )}
            </div>
            <button
              onClick={() => copyAndGo(c)}
              className={`min-h-11 whitespace-nowrap rounded-lg px-4 text-sm font-bold transition active:scale-95 ${
                copiedId === c.id
                  ? 'bg-green-600 text-white'
                  : 'bg-[#E91E8C] text-white hover:brightness-110'
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
    </div>
  )
}
