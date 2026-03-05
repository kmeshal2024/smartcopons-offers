import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import MobileBottomNav from '@/components/MobileBottomNav'
import BackToTop from '@/components/BackToTop'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#db2777',
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
        <MobileBottomNav />
        <BackToTop />
      </body>
    </html>
  )
}
