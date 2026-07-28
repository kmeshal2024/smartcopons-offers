import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import FavoritesClient from './FavoritesClient'

export const metadata: Metadata = {
  title: 'المفضّلة',
  // Personal, per-device — never index it.
  robots: { index: false, follow: false },
}

// Nothing to prerender: the list is device-local and loads on the client.
export const dynamic = 'force-dynamic'

// Header and Footer are rendered HERE, not inside FavoritesClient. Footer is an
// async server component that queries Prisma, so importing it from a 'use client'
// file bundles PrismaClient into the browser and the page dies on mount with
// "Application error: a client-side exception has occurred".
export default function FavoritesPage() {
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header />
      <FavoritesClient />
      <Footer />
    </div>
  )
}
