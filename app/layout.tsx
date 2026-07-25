import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import MobileBottomNav from '@/components/MobileBottomNav'
import BackToTop from '@/components/BackToTop'
import ShoppingListWidget from '@/components/ShoppingListWidget'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import InstallPrompt from '@/components/InstallPrompt'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Match the manifest theme_color so the browser/app chrome is consistent.
  themeColor: '#E91E8C',
}

export const metadata: Metadata = {
  title: {
    default: 'SmartCopons | عروض وكوبونات السوبرماركت في السعودية',
    template: '%s | SmartCopons',
  },
  description: 'اكتشف أحدث عروض السوبرماركت وكوبونات الخصم في السعودية',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://sa.smartcopons.com'),
  openGraph: {
    type: 'website',
    locale: 'ar_SA',
    siteName: 'SmartCopons',
  },
  robots: {
    index: true,
    follow: true,
  },
  // iOS install support (Android/Huawei read the manifest, which Next links
  // automatically from app/manifest.ts).
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'سمارت كوبونز',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className={inter.className}>
        {children}
        <ShoppingListWidget />
        <MobileBottomNav />
        <BackToTop />
        <ServiceWorkerRegister />
        <InstallPrompt />
      </body>
    </html>
  )
}
