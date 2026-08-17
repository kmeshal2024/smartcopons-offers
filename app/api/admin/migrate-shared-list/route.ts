import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Creates `shared_lists`, backing the WhatsApp-shareable shopping list.
 *
 * MUST RUN BEFORE the feature branch merges. The /list/[id] page and POST
 * /api/list both query this table, so merging first would 500 those two routes.
 * (Adding a new MODEL is less dangerous than adding a column to an existing one —
 * it only breaks queries that touch it — but the ordering rule is the same.)
 *
 * Runs through the app's own Prisma connection because the database is only
 * reachable from the deployment, and is idempotent so it is safe to re-run.
 *
 *   curl -X POST https://sa.smartcopons.com/api/admin/migrate-shared-list \
 *        -H "Authorization: Bearer $APP_SECRET"
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS shared_lists (
     id          TEXT PRIMARY KEY,
     "itemsJson" TEXT NOT NULL,
     "itemCount" INTEGER NOT NULL DEFAULT 0,
     total       DOUBLE PRECISION NOT NULL DEFAULT 0,
     savings     DOUBLE PRECISION NOT NULL DEFAULT 0,
     country     TEXT NOT NULL DEFAULT 'SA',
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "expiresAt" TIMESTAMP(3) NOT NULL
   )`,

  // The only query that scans rather than seeks: the retention sweep.
  `CREATE INDEX IF NOT EXISTS "shared_lists_expiresAt_idx"
     ON shared_lists ("expiresAt")`,

  // Guards against a client sending a short or sequential id. The application
  // generates 16 CSPRNG chars; this makes a regression fail loudly at the DB
  // rather than silently creating enumerable lists.
  `DO $$ BEGIN
     ALTER TABLE shared_lists
       ADD CONSTRAINT shared_lists_id_len_check CHECK (length(id) >= 10);
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
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

  const [{ n }] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(*)::bigint AS n FROM shared_lists`
  )
  return { statements: results, failed: results.filter(r => !r.ok).length, rows: Number(n) }
}

export async function POST(request: Request) {
  const secret = process.env.APP_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
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
