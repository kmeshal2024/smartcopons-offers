'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker once, after load. Kept as a tiny client
 * component mounted in the root layout so every route is in scope. No UI.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* registration failure must never break the page */
      })
    }
    window.addEventListener('load', onLoad)
    return () => window.removeEventListener('load', onLoad)
  }, [])

  return null
}
