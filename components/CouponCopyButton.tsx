'use client'

import { useState } from 'react'
import { useI18n } from '@/components/I18nProvider'

/**
 * The one interactive bit of the coupon store landing pages. Everything else on
 * /coupons/[slug] is server-rendered so the codes are real text in the HTML —
 * that page is an SEO surface first.
 */
export default function CouponCopyButton({ code, destinationUrl }: { code: string; destinationUrl?: string | null }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
    if (destinationUrl) window.open(destinationUrl, '_blank', 'noopener')
  }

  return (
    <button
      onClick={handleCopy}
      className={`w-full rounded-lg py-2.5 text-sm font-bold transition-all active:scale-95 sm:w-auto sm:px-6 ${
        copied ? 'bg-green-500 text-white' : 'bg-pink-600 text-white hover:bg-pink-700'
      }`}
    >
      {copied
        ? t('home.coupons.copied')
        : destinationUrl
          ? t('couponStore.copyAndShop')
          : t('common.copy')}
    </button>
  )
}
