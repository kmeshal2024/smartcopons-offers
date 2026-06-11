'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import ExpiryBadge from '@/components/ExpiryBadge'

interface FlyerViewerProps {
  pdfUrl: string
  title?: string
  /** Optional validity dates → renders an urgency badge. */
  startDate?: string | null
  endDate?: string | null
}

export default function FlyerViewer({ pdfUrl, title, startDate, endDate }: FlyerViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const thumbRefs = useRef<Array<HTMLCanvasElement | null>>([])
  const thumbBtnRefs = useRef<Array<HTMLButtonElement | null>>([])
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [scale, setScale] = useState(1.5)
  const [rendering, setRendering] = useState(false)

  // Load PDF
  useEffect(() => {
    let cancelled = false

    async function loadPdf() {
      try {
        setLoading(true)
        setError('')

        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs`

        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          cMapUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/cmaps/',
          cMapPacked: true,
        })

        const pdf = await loadingTask.promise
        if (cancelled) return

        setPdfDoc(pdf)
        setNumPages(pdf.numPages)
        setCurrentPage(1)
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load PDF')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadPdf()
    return () => { cancelled = true }
  }, [pdfUrl])

  // Render current page (main canvas)
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current || rendering) return

    setRendering(true)
    try {
      const page = await pdfDoc.getPage(pageNum)
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const containerWidth = containerRef.current?.clientWidth || 600
      const viewport = page.getViewport({ scale: 1 })
      const fitScale = (containerWidth - 32) / viewport.width
      const actualScale = Math.min(fitScale, scale)
      const scaledViewport = page.getViewport({ scale: actualScale })

      canvas.height = scaledViewport.height
      canvas.width = scaledViewport.width

      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise
    } catch (err: any) {
      console.error('Render error:', err)
    } finally {
      setRendering(false)
    }
  }, [pdfDoc, scale, rendering])

  useEffect(() => {
    if (pdfDoc && currentPage > 0) renderPage(currentPage)
  }, [pdfDoc, currentPage, renderPage])

  // Re-render on resize
  useEffect(() => {
    const handleResize = () => {
      if (pdfDoc && currentPage > 0) renderPage(currentPage)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [pdfDoc, currentPage, renderPage])

  // Render thumbnails once the document is available
  useEffect(() => {
    if (!pdfDoc) return
    let cancelled = false
    ;(async () => {
      for (let p = 1; p <= pdfDoc.numPages; p++) {
        if (cancelled) return
        const canvas = thumbRefs.current[p - 1]
        if (!canvas) continue
        try {
          const page = await pdfDoc.getPage(p)
          const viewport = page.getViewport({ scale: 0.22 })
          const ctx = canvas.getContext('2d')
          if (!ctx) continue
          canvas.width = viewport.width
          canvas.height = viewport.height
          await page.render({ canvasContext: ctx, viewport }).promise
        } catch {
          /* ignore individual thumb failures */
        }
      }
    })()
    return () => { cancelled = true }
  }, [pdfDoc])

  const goPage = useCallback((delta: number) => {
    setCurrentPage((cur) => {
      const next = cur + delta
      return next >= 1 && next <= numPages ? next : cur
    })
  }, [numPages])

  const jumpTo = (p: number) => {
    if (p >= 1 && p <= numPages) setCurrentPage(p)
  }

  // Keyboard navigation when the viewer is focused (RTL: ← next, → prev)
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPage(1) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goPage(-1) }
      else if (e.key === '+' || e.key === '=') setScale((s) => Math.min(3, s + 0.25))
      else if (e.key === '-') setScale((s) => Math.max(0.5, s - 0.25))
    }
    stage.addEventListener('keydown', onKey)
    return () => stage.removeEventListener('keydown', onKey)
  }, [goPage])

  // Keep active thumbnail in view
  useEffect(() => {
    thumbBtnRefs.current[currentPage - 1]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [currentPage])

  // Touch swipe (left = next, right = prev)
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
    if (dx < 0) goPage(1)
    else goPage(-1)
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center text-red-600 text-sm">
        {error}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      {(title || startDate || endDate) && (
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {title && <h3 className="font-semibold text-gray-800 text-sm truncate">{title}</h3>}
            {endDate && <ExpiryBadge validFrom={startDate} validTo={endDate} />}
          </div>
          {numPages > 0 && <span className="text-xs text-gray-500 flex-shrink-0">{numPages} صفحة</span>}
        </div>
      )}

      {/* Canvas Area (focusable for keyboard nav, swipeable) */}
      <div
        ref={stageRef}
        tabIndex={0}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative flex items-center justify-center min-h-[300px] bg-gray-100 outline-none focus:ring-2 focus:ring-pink-300"
        style={{ touchAction: 'pan-y' }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-pink-600 mb-2"></div>
              <p className="text-sm text-gray-500">جاري تحميل النشرة...</p>
            </div>
          </div>
        )}
        {rendering && !loading && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full z-10">
            جاري التحميل...
          </div>
        )}

        {/* Prev (right in RTL) */}
        {numPages > 1 && !loading && (
          <button
            onClick={() => goPage(-1)}
            disabled={currentPage <= 1}
            aria-label="الصفحة السابقة"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/80 shadow flex items-center justify-center text-gray-700 hover:bg-white disabled:opacity-30"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        )}

        <canvas ref={canvasRef} className="max-w-full h-auto" style={{ display: loading ? 'none' : 'block' }} />

        {/* Next (left in RTL) */}
        {numPages > 1 && !loading && (
          <button
            onClick={() => goPage(1)}
            disabled={currentPage >= numPages}
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
          {Array.from({ length: numPages }).map((_, i) => {
            const p = i + 1
            const active = p === currentPage
            return (
              <button
                key={p}
                ref={(el) => { thumbBtnRefs.current[i] = el }}
                onClick={() => jumpTo(p)}
                aria-label={`صفحة ${p}`}
                aria-current={active}
                className={`relative flex-shrink-0 rounded-md overflow-hidden border-2 transition bg-white ${
                  active ? 'border-pink-600 scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <canvas ref={(el) => { thumbRefs.current[i] = el }} className="block h-16 w-auto" />
                <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] text-center">{p}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Navigation + page counter */}
      {numPages > 1 && (
        <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between bg-white">
          <button
            onClick={() => goPage(1)}
            disabled={currentPage >= numPages || rendering}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            التالي
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">{currentPage}</span>
            <span className="text-xs text-gray-400">من</span>
            <span className="text-sm font-medium text-gray-700">{numPages}</span>
          </div>

          <button
            onClick={() => goPage(-1)}
            disabled={currentPage <= 1 || rendering}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            السابق
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      )}

      {/* Zoom Controls */}
      {numPages > 0 && (
        <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-center gap-3 bg-gray-50">
          <button
            onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
            className="w-8 h-8 flex items-center justify-center rounded bg-white border text-gray-600 hover:bg-gray-100 text-lg"
          >
            -
          </button>
          <span className="text-xs text-gray-500 w-12 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale(s => Math.min(3, s + 0.25))}
            className="w-8 h-8 flex items-center justify-center rounded bg-white border text-gray-600 hover:bg-gray-100 text-lg"
          >
            +
          </button>
        </div>
      )}
    </div>
  )
}
