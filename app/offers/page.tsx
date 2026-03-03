import { Suspense } from 'react'
import OffersClient from './OffersClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'عروض السوبرماركت اليوم | SmartCopons',
  description: 'تصفح أحدث عروض السوبرماركت في السعودية. عروض بنده، كارفور، لولو، الدانوب. أسعار مخفضة يومياً.',
  keywords: 'عروض اليوم, عروض السوبرماركت, خصومات, عروض بنده اليوم, عروض كارفور اليوم',
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-red-50 flex items-center justify-center" dir="rtl">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-pink-200 border-t-pink-600"></div>
        <p className="mt-4 text-gray-600 text-lg">جاري التحميل...</p>
      </div>
    </div>
  )
}

export default function OffersPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <OffersClient />
    </Suspense>
  )
}
