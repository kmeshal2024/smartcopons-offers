import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/db'

async function getFooterData() {
  const supermarkets = await prisma.supermarket.findMany({
    where: { isActive: true },
    select: { nameAr: true, slug: true },
    orderBy: { viewCount: 'desc' },
    take: 6,
  })
  return supermarkets
}

export default async function Footer() {
  const supermarkets = await getFooterData()

  return (
    <footer className="bg-gray-900 text-gray-300 mt-16 pb-20 md:pb-0">
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="mb-3">
              <Image
                src="/logo.png.png"
                alt="SmartCopons"
                width={140}
                height={36}
                className="brightness-0 invert opacity-90"
              />
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              أفضل عروض وخصومات السوبرماركت في المملكة العربية السعودية. وفر أكثر كل يوم.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-bold text-white text-sm mb-4">روابط سريعة</h3>
            <div className="space-y-2.5 text-sm">
              <Link href="/" className="block text-gray-400 hover:text-white transition">
                الرئيسية
              </Link>
              <Link href="/offers" className="block text-gray-400 hover:text-white transition">
                العروض
              </Link>
              <Link href="/supermarkets" className="block text-gray-400 hover:text-white transition">
                المتاجر
              </Link>
              <Link href="/coupons" className="block text-gray-400 hover:text-white transition">
                كوبونات الخصم
              </Link>
            </div>
          </div>

          {/* Stores */}
          <div>
            <h3 className="font-bold text-white text-sm mb-4">المتاجر</h3>
            <div className="space-y-2.5 text-sm">
              {supermarkets.map(sm => (
                <Link
                  key={sm.slug}
                  href={`/offers/retailer/${sm.slug}`}
                  className="block text-gray-400 hover:text-white transition"
                >
                  عروض {sm.nameAr}
                </Link>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-bold text-white text-sm mb-4">تواصل معنا</h3>
            <div className="space-y-2.5 text-sm text-gray-400">
              <p>support@smartcopons.com</p>
              <div className="flex gap-3 mt-3">
                {/* Twitter/X */}
                <a href="#" className="w-8 h-8 rounded-full bg-gray-800 hover:bg-pink-600 flex items-center justify-center transition" aria-label="Twitter">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                {/* Instagram */}
                <a href="#" className="w-8 h-8 rounded-full bg-gray-800 hover:bg-pink-600 flex items-center justify-center transition" aria-label="Instagram">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright Bar */}
      <div className="border-t border-gray-800">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} SmartCopons - جميع الحقوق محفوظة
        </div>
      </div>
    </footer>
  )
}
