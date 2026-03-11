'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface FlyerViewerProps {
  pdfUrl: string
  title?: string
}

export default function FlyerViewer({ pdfUrl, title }: FlyerViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
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

  // Render current page
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current || rendering) return

    setRendering(true)
    try {
      const page = await pdfDoc.getPage(pageNum)
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Calculate scale to fit container width
      const containerWidth = containerRef.current?.clientWidth || 600
      const viewport = page.getViewport({ scale: 1 })
      const fitScale = (containerWidth - 32) / viewport.width // 32px padding
      const actualScale = Math.min(fitScale, scale)
      const scaledViewport = page.getViewport({ scale: actualScale })

      canvas.height = scaledViewport.height
      canvas.width = scaledViewport.width

      await page.render({
        canvasContext: ctx,
        viewport: scaledViewport,
      }).promise
    } catch (err: any) {
      console.error('Render error:', err)
    } finally {
      setRendering(false)
    }
  }, [pdfDoc, scale, rendering])

  useEffect(() => {
    if (pdfDoc && currentPage > 0) {
      renderPage(currentPage)
    }
  }, [pdfDoc, currentPage, renderPage])

  // Re-render on resize
  useEffect(() => {
    const handleResize = () => {
      if (pdfDoc && currentPage > 0) renderPage(currentPage)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [pdfDoc, currentPage, renderPage])

  const goPage = (delta: number) => {
    const next = currentPage + delta
    if (next >= 1 && next <= numPages) setCurrentPage(next)
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
      {title && (
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
          {numPages > 0 && (
            <span className="text-xs text-gray-500">{numPages} صفحة</span>
          )}
        </div>
      )}

      {/* Canvas Area */}
      <div className="relative flex items-center justify-center min-h-[300px] bg-gray-100">
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
        <canvas
          ref={canvasRef}
          className="max-w-full h-auto"
          style={{ display: loading ? 'none' : 'block' }}
        />
      </div>

      {/* Navigation */}
      {numPages > 1 && (
        <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between bg-white">
          {/* RTL: Next page is on left, Prev on right */}
          <button
            onClick={() => goPage(1)}
            disabled={currentPage >= numPages || rendering}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
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
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
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
