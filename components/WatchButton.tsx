'use client'

import { useWatches } from '@/hooks/useWatches'
import { usePush } from '@/hooks/usePush'

/**
 * "Watch the price" toggle. Starting a watch is the natural moment to ask for
 * notification permission — the shopper has just told us they want to hear
 * about this product, so the prompt has obvious context rather than arriving
 * cold on page load.
 */
export default function WatchButton({ productId }: { productId: string }) {
  const { isWatching, toggle } = useWatches()
  const { state, subscribed, enable } = usePush()
  const watching = isWatching(productId)
  const canAsk = watching && !subscribed && state !== 'unsupported' && state !== 'denied'

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={async () => {
          const wasWatching = watching
          toggle(productId)
          // Only ask when starting a watch, never when cancelling one.
          if (!wasWatching && !subscribed && state === 'default') await enable()
        }}
        aria-pressed={watching}
        className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition ${
          watching
            ? 'bg-pink-50 text-pink-700 border border-pink-200'
            : 'bg-white text-gray-700 border border-gray-200 hover:border-pink-300 hover:text-pink-600'
        }`}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill={watching ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {watching ? 'تتابع السعر' : 'تابع السعر'}
      </button>

      {canAsk && (
        <button onClick={enable} className="text-xs font-semibold text-pink-600 hover:underline">
          🔔 فعّل التنبيه ليصلك إشعار عند نزول السعر
        </button>
      )}
      {watching && subscribed && (
        <span className="text-xs text-green-600">🔔 سيصلك إشعار عند نزول السعر</span>
      )}
    </div>
  )
}
