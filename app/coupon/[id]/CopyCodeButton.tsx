'use client'

import { useState } from 'react'

/**
 * Just the copy interaction. The code itself is rendered server-side by the
 * page so crawlers (and users with JS disabled) still see it — this only adds
 * the clipboard button on top.
 */
export default function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={`px-8 py-3 rounded-lg font-bold text-sm transition-all active:scale-95 whitespace-nowrap ${
        copied ? 'bg-green-500 text-white' : 'bg-pink-600 text-white hover:bg-pink-700'
      }`}
    >
      {copied ? '✓ تم النسخ' : 'نسخ الكود'}
    </button>
  )
}
