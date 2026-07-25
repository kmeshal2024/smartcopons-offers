import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'لا يوجد اتصال',
  robots: { index: false, follow: false },
}

// Served by the service worker when a navigation fails offline.
export default function OfflinePage() {
  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <span className="text-6xl block mb-4">📡</span>
        <h1 className="text-xl font-bold text-gray-900 mb-2">لا يوجد اتصال بالإنترنت</h1>
        <p className="text-sm text-gray-500 mb-6">
          تحقّق من اتصالك وحاول مرة أخرى. الصفحات التي تصفّحتها سابقاً قد تظل متاحة.
        </p>
        <Link
          href="/"
          className="inline-block bg-pink-600 text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-pink-700 transition"
        >
          إعادة المحاولة
        </Link>
      </div>
    </div>
  )
}
