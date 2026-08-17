'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/components/I18nProvider'

interface Coupon {
  id: string
  code: string
  title: string
  discountText: string
  affiliateUrl: string
  isExclusive: boolean
  storeName: string
}

/**
 * An owned coupon code, shown directly above the WhatsApp share button.
 *
 * This is the highest purchase-intent moment in the product: the shopper has
 * assembled a real basket with a real total and is about to act on it. That is
 * why the code goes HERE rather than on a standalone page — the old /coupons
 * page produced 8,743 impressions and 4 clicks in three months, while five owned
 * codes placed in context are worth more than a hundred in a catalogue.
 *
 * Fetched only when the panel opens, never on page load, so it costs nothing on
 * views that never open the list.
 *
 * RENDERS NOTHING when there is no live code with a real affiliate URL. That is
 * the whole safety property: a dead code carrying the owner's name is worse than
 * no code at all, so every failure path here is silence.
 */
export default function ListCoupon({ storeSlugs }: { storeSlugs: string[] }) {
  const { t } = useI18n()
  const [coupon, setCoupon] = useState<Coupon | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/coupons/for-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slugs: storeSlugs }),
    })
      .then(r => r.json())
      .then(d => {
        if (!cancelled) setCoupon(d?.coupons?.[0] ?? null)
      })
      .catch(() => {
        /* silence — no coupon is the correct failure state */
      })
    return () => {
      cancelled = true
    }
    // Re-run when the basket's retailers change, not on every quantity tweak.
  }, [storeSlugs.join(',')])

  if (!coupon) return null

  /**
   * Copy the code AND open the merchant, in that order.
   *
   * window.open must run synchronously inside the click handler — after any
   * `await` the popup blocker kills it. The previous coupon UI copied the code
   * and left the shopper holding it with nowhere to go, so the affiliate click
   * never happened at all. Clipboard write is fired after, and its failure is
   * irrelevant to the navigation.
   */
  const copyAndGo = () => {
    window.open(coupon.affiliateUrl, '_blank', 'noopener,noreferrer')
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
          {copied ? t('listCoupon.copied') : t('listCoupon.copyAndGo')}
        </button>
      </div>

      {coupon.discountText && (
        <p className="mt-1.5 text-center text-[11px] text-gray-500">{coupon.discountText}</p>
      )}
    </div>
  )
}
