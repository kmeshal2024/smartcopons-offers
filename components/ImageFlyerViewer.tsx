'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import ExpiryBadge from '@/components/ExpiryBadge'

interface ImageFlyerViewerProps {
  /** Full-page image URLs, in order. Rendered with plain <img> (no CORS needed). */
  pages: string[]
  title?: string
  startDate?: string | null
  endDate?: string | null
}

/**
 * Renders a flyer that is published as page images rather than a PDF — LuLu
 * UAE's in-store promotions, for example, are portrait campaign posters on
 * their CDN. Deliberately does NOT use pdf.js: plain <img> tags need no CORS,
 * load instantly, and stay crisp at any zoom.
 *
 * Mirrors FlyerViewer's UX (RTL arrows, swipe, keyboard, thumbnail strip) so
 * the two viewers feel identical to a shopper.
 */
export default function ImageFlyerViewer({ pages, title, startDate, endDate }: ImageFlyerViewerProps) {
  const [current, setCurrent] = useState(0)
  const [loaded, setLoaded] = useState<Record<number, boolean>>({})
  const stageRef = useRef<HTMLDivElement>(null)
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([])
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const numPages = pages.length

  const go = useCallback((delta: number) => {
    setCurrent(cur => {
      const next = cur + delta
      return next >= 0 && next < numPages ? next : cur
    })
  }, [numPages])

  // Keyboard nav (RTL: ← next, → prev) when the stage is focused
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(1) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(-1) }
    }
    stage.addEventListener('keydown', onKey)
    return () => stage.removeEventListener('keydown', onKey)
  }, [go])

  // Keep the active thumbnail in view
  useEffect(() => {
    thumbRefs.current[current]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [current])

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStart.current.x
    const dy = t.clientY - touchStart.current.y
    touchStart.current = null
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return
    if (dx < 0) go(1)
    else go(-1)
  }

  if (numPages === 0) return null

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      {(title || startDate || endDate) && (
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {title && <h3 className="font-semibold text-gray-800 text-sm truncate">{title}</h3>}
            {endDate && <ExpiryBadge validFrom={startDate} validTo={endDate} />}
          </div>
          <span className="text-xs text-gray-500 flex-shrink-0">{numPages} صفحة</span>
        </div>
      )}

      {/* Stage */}
      <div
        ref={stageRef}
        tabIndex={0}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative flex items-center justify-center min-h-[320px] bg-gray-100 outline-none focus:ring-2 focus:ring-pink-300"
        style={{ touchAction: 'pan-y' }}
      >
        {!loaded[current] && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-pink-600" />
          </div>
        )}

        {/* Prev (right in RTL) */}
        {numPages > 1 && (
          <button
            onClick={() => go(-1)}
            disabled={current <= 0}
            aria-label="الصفحة السابقة"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/80 shadow flex items-center justify-center text-gray-700 hover:bg-white disabled:opacity-30"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        )}

        <a href={pages[current]} target="_blank" rel="noopener noreferrer" title="فتح الصورة بالحجم الكامل">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pages[current]}
            alt={`${title || 'نشرة العروض'} — صفحة ${current + 1}`}
            className="max-h-[75vh] w-auto max-w-full object-contain"
            style={{ display: loaded[current] ? 'block' : 'none' }}
            onLoad={() => setLoaded(l => ({ ...l, [current]: true }))}
            loading="eager"
          />
        </a>

        {/* Next (left in RTL) */}
        {numPages > 1 && (
          <button
            onClick={() => go(1)}
            disabled={current >= numPages - 1}
            aria-label="الصفحة التالية"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/80 shadow flex items-center justify-center text-gray-700 hover:bg-white disabled:opacity-30"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
        )}
      </div>

      {/* Thumbnail strip */}
      {numPages > 1 && (
        <div className="border-t border-gray-200 bg-gray-50 px-3 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
          {pages.map((src, i) => {
            const active = i === current
            return (
              <button
                key={i}
                ref={el => { thumbRefs.current[i] = el }}
                onClick={() => setCurrent(i)}
                aria-label={`صفحة ${i + 1}`}
                aria-current={active}
                className={`relative flex-shrink-0 rounded-md overflow-hidden border-2 transition bg-white ${
                  active ? 'border-pink-600 scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="block h-16 w-auto object-contain" loading="lazy" />
                <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] text-center">{i + 1}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Nav + counter */}
      {numPages > 1 && (
        <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between bg-white">
          <button
            onClick={() => go(1)}
            disabled={current >= numPages - 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            التالي
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">{current + 1}</span>
            <span className="text-xs text-gray-400">من</span>
            <span className="text-sm font-medium text-gray-700">{numPages}</span>
          </div>
          <button
            onClick={() => go(-1)}
            disabled={current <= 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            السابق
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      )}
    </div>
  )
}
