import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Protect admin routes (except login)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const sessionCookie = request.cookies.get('session')
    
    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    
    // Basic validation that session exists
    // Detailed verification happens in the route handlers
    try {
      const [payloadB64, signature] = sessionCookie.value.split('.')
      if (!payloadB64 || !signature) {
        return NextResponse.redirect(new URL('/admin/login', request.url))
      }
    } catch {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: '/admin/:path*',
}
