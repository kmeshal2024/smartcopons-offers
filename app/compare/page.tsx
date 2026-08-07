import Header from '@/components/Header'
import Footer from '@/components/Footer'
import PriceComparison from '@/components/PriceComparison'
import type { Metadata } from 'next'
import { getLang } from '@/lib/i18n-server'
import { t as translate, dirOf } from '@/lib/i18n'

export const metadata: Metadata = {
  // The root layout applies `%s | SmartCopons` — don't repeat the brand here.
  title: 'مقارنة الأسعار بين المتاجر',
  description: 'قارن سعر أي منتج بين بنده، كارفور، لولو، الدانوب وغيرها واعثر على الأرخص.',
}

// Dynamic, not build-prerendered: the Neon DB auto-suspends and a build during
// a suspend can't reach it. Functions sit next to the DB in Frankfurt.
export const dynamic = 'force-dynamic'

export default function ComparePage() {
  const lang = getLang()
  const t = (key: string) => translate(lang, key)
  return (
    <div className="min-h-screen bg-gray-50" dir={dirOf(lang)}>
      <Header />
      <main className="container mx-auto px-4 py-6">
        <div className="mb-6 text-center">
          <h1 className="mb-2 text-2xl font-bold text-gray-800">⚖️ {t('compare.title')}</h1>
          <p className="text-gray-500">{t('compare.subtitle')}</p>
        </div>
        <div className="mx-auto max-w-4xl">
          <PriceComparison />
        </div>
      </main>
      <Footer />
    </div>
  )
}
