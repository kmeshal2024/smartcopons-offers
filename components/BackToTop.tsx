'use client'

import { useState, useEffect } from 'react'

export default function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 400)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!visible) return null

  // Stacking, bottom-up: on mobile the bottom nav occupies 0-56px and this sits at
  // 80px, with no cart FAB on mobile any more. On desktop the cart FAB occupies
  // 20-76px and this sits at 96px. `md:bottom-8` (32px) used to overlap the FAB
  // outright — tolerable while the FAB also rendered on mobile, but the FAB is now
  // desktop-only, so that collision would have become its entire presentation.
  // Size is 44px, the site-wide minimum tap target.
  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-20 md:bottom-24 left-4 z-40 w-11 h-11 bg-pink-600 text-white rounded-full shadow-lg
                 hover:bg-pink-700 transition-all duration-200 flex items-center justify-center
                 animate-fade-in hover:scale-110 active:scale-95"
      aria-label="العودة للأعلى"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
      </svg>
    </button>
  )
}
