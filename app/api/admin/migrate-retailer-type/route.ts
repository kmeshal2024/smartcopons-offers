import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Adds `supermarkets.retailerType` — grocery | pharmacy | electronics.
 *
 * WHY A RETAILER FIELD RATHER THAN FIXING CATEGORIES
 * --------------------------------------------------
 * The homepage's biggest-discount section was four Nahdi rows: a nursing wrap, two
 * gummy-vitamin packs and an anti-dandruff shampoo, on a supermarket deals site.
 * The obvious fix — prefer food categories — does not work, because the category
 * data is itself wrong: that nursing wrap is filed as `canned-dry` and the
 * vitamins as `snacks`. Categorisation is re-derived as products arrive nightly,
 * so it rots continuously; retailer identity does not change. One field per store
 * is stable, and it is not a Nahdi-specific hack — eXtra is an electronics chain
 * listing ACER at 7,599 SAR and APPLE at 5,899 next to groceries.
 *
 * Beyond featured-section ranking this enables filtering non-grocery out of
 * supermarket contexts, and more accurate page titles/descriptions per store.
 *
 * Runs through the app's own Prisma connection because the database is only
 * reachable from the deployment — same approach as migrate-country /
 * migrate-shopper / migrate-push. Every statement is idempotent: the ALTER is
 * IF NOT EXISTS with a DEFAULT, and the seeding UPDATEs are keyed on slug, so the
 * route is safe to re-run.
 *
 * Auth is POST + Authorization: Bearer only — no `?key=`, which would put the
 * secret into Vercel's request logs, shell history and the Referer header. (The
 * older migrate-* routes still accept a query key; they predate that decision.)
 *
 *   curl -X POST https://sa.smartcopons.com/api/admin/migrate-retailer-type \
 *        -H "Authorization: Bearer $APP_SECRET"
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Everything not listed is left at the 'grocery' default. */
const PHARMACY = ['nahdi', 'aldawaa']
const ELECTRONICS = ['extra']

const STATEMENTS = [
  `ALTER TABLE supermarkets
     ADD COLUMN IF NOT EXISTS "retailerType" TEXT NOT NULL DEFAULT 'grocery'`,

  // Featured-section queries filter/rank on this, so it needs an index next to
  // the existing country+isActive one.
  `CREATE INDEX IF NOT EXISTS "supermarkets_retailerType_idx"
     ON supermarkets ("retailerType")`,

  `UPDATE supermarkets SET "retailerType" = 'pharmacy'
     WHERE slug IN (${PHARMACY.map(s => `'${s}'`).join(', ')})`,

  `UPDATE supermarkets SET "retailerType" = 'electronics'
     WHERE slug IN (${ELECTRONICS.map(s => `'${s}'`).join(', ')})`,

  // Belt and braces: DEFAULT only applies to rows inserted after the ALTER.
  `UPDATE supermarkets SET "retailerType" = 'grocery'
     WHERE "retailerType" IS NULL OR "retailerType" = ''`,
]

async function run() {
  const results: Array<{ sql: string; ok: boolean; error?: string }> = []
  for (const sql of STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(sql)
      results.push({ sql: sql.replace(/\s+/g, ' ').slice(0, 90), ok: true })
    } catch (e: any) {
      results.push({
        sql: sql.replace(/\s+/g, ' ').slice(0, 90),
        ok: false,
        error: String(e?.message).slice(0, 180),
      })
    }
  }

  const rows = await prisma.$queryRawUnsafe<Array<{ retailerType: string; slug: string }>>(
    `SELECT "retailerType", slug FROM supermarkets ORDER BY "retailerType", slug`
  )
  const byType: Record<string, string[]> = {}
  for (const r of rows) (byType[r.retailerType] ||= []).push(r.slug)

  return {
    statements: results,
    failed: results.filter(r => !r.ok).length,
    byType,
  }
}

export async function POST(request: Request) {
  const secret = process.env.APP_SECRET
  const header = request.headers.get('authorization')
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await run())
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed. Use POST with an Authorization: Bearer header.' },
    { status: 405, headers: { Allow: 'POST' } }
  )
}
