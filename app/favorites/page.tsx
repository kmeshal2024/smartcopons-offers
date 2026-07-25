import type { Metadata } from 'next'
import FavoritesClient from './FavoritesClient'

export const metadata: Metadata = {
  title: 'المفضّلة',
  // Personal, per-device — never index it.
  robots: { index: false, follow: false },
}

// Nothing to prerender: the list is device-local and loads on the client.
export const dynamic = 'force-dynamic'

export default function FavoritesPage() {
  return <FavoritesClient />
}
