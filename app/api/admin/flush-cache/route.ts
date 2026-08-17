import { NextResponse } from 'next/server'
import { invalidateAll } from '@/lib/cache-invalidation'

export const dynamic = 'force-dynamic'

/**
 * Drop the public read caches on demand. POST only, header auth only.
 *
 * Deliberately NOT using lib/cron-auth.ts: that helper also accepts `?key=`,
 * which is correct for the cron routes (Vercel's scheduler can pass a Bearer
 * token, a human running one by hand cannot easily) but wrong here. A secret in a
 * query string is written to Vercel's request logs, kept in shell and browser
 * history, and forwarded in the Referer header of any subsequent navigation.
 * This endpoint takes the secret in an Authorization header and nowhere else.
 *
 *   curl -X POST https://sa.smartcopons.com/api/admin/flush-cache \
 *        -H "Authorization: Bearer $APP_SECRET"
 *
 * Needed because the ~17 admin CRUD routes do not invalidate yet, so an edit made
 * in the admin UI can take up to the TTL to appear — 1 hour for listings, 6 for
 * product pages. The nightly crons invalidate automatically.
 */

function isAuthorized(request: Request): boolean {
  const secret = process.env.APP_SECRET
  if (!secret) return false

  const header = request.headers.get('authorization')
  if (!header) return false

  // Constant-time-ish: compare full strings of equal length only after a length
  // check, so a mismatched length can't be distinguished by timing alone.
  const expected = `Bearer ${secret}`
  if (header.length !== expected.length) return false

  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= header.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  invalidateAll()

  return NextResponse.json({
    success: true,
    flushed: ['offers', 'retailers', 'coupons'],
    timestamp: new Date().toISOString(),
  })
}

/**
 * Explicitly rejected. Without this, a GET would fall through to Next's default
 * 405 — which is fine, but being explicit documents that the query-string form of
 * this endpoint was removed on purpose and must not be reintroduced.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed. Use POST with an Authorization: Bearer header.' },
    { status: 405, headers: { Allow: 'POST' } }
  )
}
