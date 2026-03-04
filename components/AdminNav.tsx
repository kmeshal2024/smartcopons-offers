'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

export default function AdminNav() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  const links = [
    { href: '/admin/coupons', label: 'Coupons' },
    { href: '/admin/stores', label: 'Stores' },
    { href: '/admin/supermarkets', label: 'Supermarkets' },
    { href: '/admin/categories', label: 'Categories' },
    { href: '/admin/flyers', label: 'Flyers' },
    { href: '/admin/products', label: 'Products' },
    { href: '/admin/scrape', label: 'Scrape' },
  ]

  return (
    <nav className="bg-gray-800 text-white">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <div className="flex gap-6 flex-wrap">
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  pathname === link.href
                    ? 'font-bold underline text-pink-300'
                    : 'hover:underline hover:text-pink-200 transition'
                }
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex gap-4 items-center">
            <Link href="/offers" className="hover:underline text-sm text-gray-300">
              View Offers
            </Link>
            <Link href="/" className="hover:underline text-sm text-gray-300">
              View Site
            </Link>
            <button
              onClick={handleLogout}
              className="bg-red-600 px-4 py-2 rounded hover:bg-red-700 text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
