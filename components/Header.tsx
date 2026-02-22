import Link from 'next/link'
import Image from 'next/image'

export default function Header() {
  return (
    <header className="bg-gradient-to-r from-pink-600 to-red-500 text-white shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <Image 
              src="/logo.png" 
              alt="SmartCopons" 
              width={150} 
              height={50}
              className="h-12 w-auto"
            />
          </Link>
          <nav className="flex gap-6 items-center">
            <Link href="/" className="hover:text-pink-200 transition font-semibold">
              الرئيسية
            </Link>
            <Link href="/offers" className="hover:text-pink-200 transition font-semibold">
              عروض السوبرماركت
            </Link>
            <Link href="/admin/login" className="bg-white text-pink-600 px-6 py-2 rounded-full hover:bg-pink-50 transition font-semibold">
              لوحة التحكم
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}