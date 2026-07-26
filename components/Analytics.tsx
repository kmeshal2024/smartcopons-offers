'use client'

import Script from 'next/script'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'

/**
 * Google Analytics 4.
 *
 * The measurement id is committed rather than kept in an env var: a GA4 id is
 * public by design — it ships inside the page HTML of every site that loads
 * gtag — so it is not a secret. NEXT_PUBLIC_GA_ID still overrides it, which is
 * how you'd point a staging deploy at a separate property.
 *
 * The app is a client-side SPA once loaded, so route changes don't fire a fresh
 * page_view on their own — the inner component sends one on every path change.
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-9EHVGS1TJM'

function PageViews() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!GA_ID || typeof window === 'undefined' || !(window as any).gtag) return
    const qs = searchParams?.toString()
    ;(window as any).gtag('event', 'page_view', {
      page_path: pathname + (qs ? `?${qs}` : ''),
      page_location: window.location.href,
      page_title: document.title,
    })
  }, [pathname, searchParams])

  return null
}

export default function Analytics() {
  if (!GA_ID) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          // send_page_view off: PageViews below handles it, so SPA navigations
          // aren't missed and the initial load isn't counted twice.
          gtag('config', '${GA_ID}', { send_page_view: false });
        `}
      </Script>
      {/* useSearchParams needs a Suspense boundary in the App Router. */}
      <Suspense fallback={null}>
        <PageViews />
      </Suspense>
    </>
  )
}
