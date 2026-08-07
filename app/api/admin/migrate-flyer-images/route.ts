import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Adds Flyer.pageImages — a JSON array of full-page image URLs for retailers
 * that publish their weekly flyer as page images rather than a PDF (LuLu UAE's
 * in-store promotions are portrait campaign posters on their CDN, not a PDF).
 *
 * Same APP_SECRET-guarded raw-DDL pattern as migrate-country: the database is
 * only reachable from the deployment, the column is IF NOT EXISTS, so this is
 * safe to re-run.
 *
 *   curl -X POST "https://sa.smartcopons.com/api/admin/migrate-flyer-images" \
 *     -H "Content-Type: application/json" -d '{"key":"'"$APP_SECRET"'"}'
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const STATEMENTS = [
  `ALTER TABLE flyers ADD COLUMN IF NOT EXISTS "pageImages" TEXT`,
]

async function run() {
  const results: Array<{ sql: string; ok: boolean; error?: string }> = []
  for (const sql of STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(sql)
      results.push({ sql: sql.replace(/\s+/g, ' ').slice(0, 80), ok: true })
    } catch (e: any) {
      results.push({ sql: sql.replace(/\s+/g, ' ').slice(0, 80), ok: false, error: String(e?.message).slice(0, 160) })
    }
  }
  const withImages = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(*)::bigint AS n FROM flyers WHERE "pageImages" IS NOT NULL`
  )
  return { statements: results, failed: results.filter(r => !r.ok).length, flyersWithPageImages: Number(withImages[0]?.n || 0) }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const key = body?.key ?? new URL(request.url).searchParams.get('key')
  if (!process.env.APP_SECRET || key !== process.env.APP_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await run())
}
