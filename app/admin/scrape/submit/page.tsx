'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function SubmitContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Receiving product data...')
  const [details, setDetails] = useState('')

  useEffect(() => {
    // Try URL data first (small payloads)
    const dataParam = searchParams.get('data')
    if (dataParam) {
      try {
        const data = JSON.parse(decodeURIComponent(dataParam))
        submitData(data)
      } catch (e: any) {
        setStatus('error')
        setMessage('Invalid data: ' + e.message)
      }
      return
    }

    // Listen for postMessage (large payloads)
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'smartcopons-scrape') {
        submitData({
          supermarketSlug: event.data.supermarketSlug,
          offers: event.data.offers,
          sourceUrl: event.data.sourceUrl,
        })
      }
    }
    window.addEventListener('message', handler)
    setMessage('Waiting for product data from bookmarklet...')

    // Timeout after 30s
    const timeout = setTimeout(() => {
      setStatus('error')
      setMessage('Timeout: No data received. Make sure you clicked the bookmarklet.')
    }, 30000)

    return () => {
      window.removeEventListener('message', handler)
      clearTimeout(timeout)
    }
  }, [searchParams])

  const submitData = async (data: { supermarketSlug: string; offers: any[]; sourceUrl: string }) => {
    setMessage(`Submitting ${data.offers.length} products from ${data.supermarketSlug}...`)

    try {
      const res = await fetch('/api/admin/scrape-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await res.json()

      if (result.success) {
        setStatus('success')
        setMessage(`${result.newOffers} new offers added!`)
        setDetails(`${result.duplicatesSkipped} duplicates skipped. Total received: ${result.received}, valid: ${result.valid}`)
      } else if (res.status === 401) {
        setStatus('error')
        setMessage('Not logged in. Please log into the admin panel first, then try again.')
      } else {
        setStatus('error')
        setMessage('Error: ' + (result.error || 'Unknown error'))
      }
    } catch (e: any) {
      setStatus('error')
      setMessage('Network error: ' + e.message)
      setDetails('Make sure you are logged into the admin panel at sa.smartcopons.com/admin')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <h1 className="text-xl font-bold mb-4 text-pink-600">SmartCopons Scraper</h1>

        {status === 'loading' && (
          <div className="space-y-3">
            <div className="animate-spin w-8 h-8 border-4 border-pink-200 border-t-pink-600 rounded-full mx-auto"></div>
            <p className="text-gray-600">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-3">
            <div className="text-5xl">&#10003;</div>
            <p className="text-green-700 font-semibold text-lg">{message}</p>
            {details && <p className="text-gray-500 text-sm">{details}</p>}
            <button
              onClick={() => window.close()}
              className="mt-4 px-6 py-2 bg-pink-600 text-white rounded hover:bg-pink-700"
            >
              Close Window
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-3">
            <div className="text-5xl">&#10007;</div>
            <p className="text-red-600 font-semibold">{message}</p>
            {details && <p className="text-gray-500 text-sm">{details}</p>}
            <button
              onClick={() => window.close()}
              className="mt-4 px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Close Window
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SubmitPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>}>
      <SubmitContent />
    </Suspense>
  )
}
