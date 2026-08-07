import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { getLang } from '@/lib/i18n-server'
import { t as translate, dirOf } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'سياسة الخصوصية',
  description:
    'سياسة خصوصية سمارت كوبونز — ما نجمعه، وكيف نستخدمه، وحقوقك. لا نطلب حساباً ولا بيانات دفع.',
  alternates: { canonical: 'https://sa.smartcopons.com/privacy' },
}

// Dynamic like the other DB-backed pages: the shared Footer queries retailers,
// and Neon auto-suspends, so a build landing during a suspend can't prerender.
export const dynamic = 'force-dynamic'

// Required by Google Play and Huawei AppGallery, and it must describe what the
// app ACTUALLY does — an anonymous device id, a shopping list, and analytics.
export default function PrivacyPage() {
  const lang = getLang()
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars)
  const updated = lang === 'en' ? '26 July 2026' : '26 يوليو 2026'

  return (
    <div className="min-h-screen bg-gray-50" dir={dirOf(lang)}>
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-3xl">
        <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/" className="hover:text-pink-600 transition">{t('nav.home')}</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-900 font-semibold">{t('privacy.title')}</span>
        </nav>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('privacy.title')}</h1>
          <p className="text-xs text-gray-400 mb-6">{t('privacy.updated', { date: updated })}</p>

          <div className="space-y-6 text-sm leading-relaxed text-gray-700">
            <section>
              <p>{t('privacy.intro')}</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">{t('privacy.h.noAccount')}</h2>
              <p>{t('privacy.p.noAccount')}</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">{t('privacy.h.store')}</h2>
              <ul className="list-disc pr-5 space-y-2">
                <li>{t('privacy.li.device')}</li>
                <li>{t('privacy.li.local')}</li>
                <li>{t('privacy.li.usage')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">{t('privacy.h.analytics')}</h2>
              <p>
                {t('privacy.p.analytics')}{' '}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pink-600 hover:underline"
                >
                  {t('privacy.link.google')}
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">{t('privacy.h.external')}</h2>
              <p>{t('privacy.p.external')}</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">{t('privacy.h.sharing')}</h2>
              <p>{t('privacy.p.sharing')}</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">{t('privacy.h.rights')}</h2>
              <p>{t('privacy.p.rights')}</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">{t('privacy.h.children')}</h2>
              <p>{t('privacy.p.children')}</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">{t('privacy.h.changes')}</h2>
              <p>{t('privacy.p.changes')}</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">{t('privacy.h.contact')}</h2>
              <p>
                {t('privacy.p.contact')}{' '}
                <a href="mailto:mk2018ksa@gmail.com" className="text-pink-600 hover:underline">
                  mk2018ksa@gmail.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
