import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PriceComparison from '@/components/PriceComparison'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'مقارنة الأسعار بين المتاجر | SmartCopons',
  description: 'قارن سعر أي منتج بين بنده، كارفور، لولو، الدانوب وغيرها واعثر على الأرخص.',
}

export default function ComparePage() {
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <div className="mb-6 text-center">
          <h1 className="mb-2 text-2xl font-bold text-gray-800">⚖️ مقارنة الأسعار</h1>
          <p className="text-gray-500">قارن سعر المنتج بين جميع المتاجر واعثر على الأرخص</p>
        </div>
        <div className="mx-auto max-w-4xl">
          <PriceComparison />
        </div>
      </main>
      <Footer />
    </div>
  )
}
