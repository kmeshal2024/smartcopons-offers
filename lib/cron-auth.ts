/**
 * Shared auth for cron endpoints.
 *
 * Vercel's scheduler calls cron paths with `Authorization: Bearer $CRON_SECRET`
 * — it cannot append a query string. Routes that only accepted `?key=` were
 * therefore rejecting every scheduled run with 401, silently. That is why
 * expired flyers were never marked EXPIRED and never cleaned up, leaving
 * thousands of stale offers visible on the site.
 *
 * Accept either:
 *   - Vercel's Bearer token (scheduled runs)
 *   - ?key=APP_SECRET      (manual runs from a terminal)
 */
export function isAuthorizedCron(request: Request): boolean {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')

  const appSecret = process.env.APP_SECRET
  const cronSecret = process.env.CRON_SECRET

  const authHeader = request.headers.get('authorization')
  const isVercelCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`
  const isKeyAuth = !!appSecret && key === appSecret

  return isVercelCron || isKeyAuth
}
