'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/components/I18nProvider'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'sc-install-dismissed'

/**
 * A slim "install the app" bar. Chrome/Edge/Samsung/Huawei fire
 * `beforeinstallprompt` when the PWA is installable; we defer it and offer a
 * branded button instead of relying on the browser's own mini-infobar.
 *
 * Hidden once installed, already running standalone, or dismissed (remembered
 * for 30 days so it isn't nagging).
 */
export default function InstallPrompt() {
  const { t, dir } = useI18n()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Already installed / launched from the home screen: never show.
    if (window.matchMedia('(display-mode: standalone)').matches) return

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0)
    if (dismissedAt && Date.now() - dismissedAt < 30 * 86_400_000) return

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', () => setShow(false))
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setShow(false)
    setDeferred(null)
  }

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      dir={dir}
      className="fixed inset-x-0 bottom-16 z-40 mx-auto max-w-md px-3 sm:bottom-4"
    >
      <div className="flex items-center gap-3 rounded-xl border border-pink-100 bg-white px-4 py-3 shadow-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="SmartCopons" className="h-10 w-10 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900">{t('install.title')}</p>
          <p className="text-[11px] text-gray-500">{t('install.subtitle')}</p>
        </div>
        <button
          onClick={install}
          className="shrink-0 rounded-lg bg-pink-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-pink-700"
        >
          {t('install.button')}
        </button>
        <button onClick={dismiss} aria-label={t('common.close')} className="shrink-0 text-gray-400 hover:text-gray-600">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
