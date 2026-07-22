import { NextResponse } from 'next/server'
import { checkAllSources } from '@/lib/services/flyer-fetcher'
import { isAuthorizedCron } from '@/lib/cron-auth'

/**
 * Cron endpoint: Check Saudi supermarkets for new flyers.
 *
 * Hostinger cron setup (hPanel > Advanced > Cron Jobs):
 *   Schedule: 0 8 * * * (daily at 8 AM Saudi time)
 *   Command:  curl -s https://sa.smartcopons.com/api/cron/check-flyers?key=YOUR_CRON_SECRET
 *
 * Security: Protected by a simple shared secret in query params.
 */
export async function GET(request: Request) {

  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await checkAllSources()
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cron check-flyers error:', error)
    return NextResponse.json({ error: 'Check failed' }, { status: 500 })
  }
}
