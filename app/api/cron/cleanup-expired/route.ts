import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAuthorizedCron } from '@/lib/cron-auth'

/**
 * Cron endpoint: Hard-delete expired flyers (and their offers) past retention.
 *
 * Complements `/api/cron/expire-flyers` (which only flips status=EXPIRED).
 * This one physically removes EXPIRED flyers older than CLEANUP_RETENTION_DAYS,
 * cascading to ProductOffer rows via the schema's onDelete: Cascade.
 *
 * Vercel cron setup (weekly):
 *   Schedule: 0 1 * * 0 (Sundays 01:00 UTC)
 *   Path:     /api/cron/cleanup-expired
 *
 * Manual preview (no deletes):
 *   curl "https://sa.smartcopons.com/api/cron/cleanup-expired?key=$APP_SECRET&dryRun=1"
 *
 * Manual run:
 *   curl "https://sa.smartcopons.com/api/cron/cleanup-expired?key=$APP_SECRET"
 *
 * Tunables (env):
 *   CLEANUP_RETENTION_DAYS  default 30 — how long expired flyers stick around
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get('dryRun') === '1'

  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const retentionDays = parseInt(process.env.CLEANUP_RETENTION_DAYS || '30', 10)

  try {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

    // Identify candidates first — same set used for counting and deletion.
    const candidates = await prisma.flyer.findMany({
      where: {
        status: 'EXPIRED',
        endDate: { lt: cutoff },
      },
      select: {
        id: true,
        _count: { select: { productOffers: true } },
      },
    })

    const flyerCount = candidates.length
    const offerCount = candidates.reduce((sum, f) => sum + f._count.productOffers, 0)

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        retentionDays,
        cutoff: cutoff.toISOString(),
        flyersToDelete: flyerCount,
        offersToDelete: offerCount,
      })
    }

    // Cascade delete: ProductOffer.flyer has onDelete: Cascade in schema.prisma
    const result = await prisma.flyer.deleteMany({
      where: { id: { in: candidates.map(c => c.id) } },
    })

    return NextResponse.json({
      success: true,
      retentionDays,
      cutoff: cutoff.toISOString(),
      flyersDeleted: result.count,
      offersDeleted: offerCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cron cleanup-expired error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
