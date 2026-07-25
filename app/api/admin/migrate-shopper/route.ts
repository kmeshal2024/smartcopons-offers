import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * One-off: create the shopper/favorites/price-watch tables on the production DB.
 *
 * The DB is only reachable from the deployment, so — like optimize-search — the
 * DDL runs through the app's own Prisma connection. Idempotent (IF NOT EXISTS),
 * guarded by APP_SECRET. Column names are quoted to match Prisma's camelCase.
 *
 *   curl -X POST .../api/admin/migrate-shopper -d '{"key":"$APP_SECRET"}'
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS shoppers (
     id text PRIMARY KEY,
     "deviceId" text NOT NULL UNIQUE,
     email text UNIQUE,
     "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE TABLE IF NOT EXISTS favorites (
     id text PRIMARY KEY,
     "shopperId" text NOT NULL REFERENCES shoppers(id) ON DELETE CASCADE,
     "productId" text NOT NULL,
     "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT favorites_shopper_product_key UNIQUE ("shopperId", "productId")
   )`,
  `CREATE INDEX IF NOT EXISTS favorites_shopperId_idx ON favorites ("shopperId")`,
  `CREATE TABLE IF NOT EXISTS price_watches (
     id text PRIMARY KEY,
     "shopperId" text NOT NULL REFERENCES shoppers(id) ON DELETE CASCADE,
     "productId" text NOT NULL,
     "nameKey" text NOT NULL,
     "basePrice" double precision NOT NULL,
     "targetPrice" double precision,
     "lastNotifiedPrice" double precision,
     "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT price_watches_shopper_product_key UNIQUE ("shopperId", "productId")
   )`,
  `CREATE INDEX IF NOT EXISTS price_watches_shopperId_idx ON price_watches ("shopperId")`,
  `CREATE INDEX IF NOT EXISTS price_watches_nameKey_idx ON price_watches ("nameKey")`,
]

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { key } = body as { key?: string }

  const appSecret = process.env.APP_SECRET
  if (!appSecret || key !== appSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { stmt: string; ok: boolean; error?: string }[] = []
  for (const stmt of STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(stmt)
      results.push({ stmt: stmt.slice(0, 48).replace(/\s+/g, ' '), ok: true })
    } catch (e) {
      results.push({
        stmt: stmt.slice(0, 48).replace(/\s+/g, ' '),
        ok: false,
        error: e instanceof Error ? e.message.slice(0, 160) : String(e),
      })
    }
  }

  return NextResponse.json({ success: results.every(r => r.ok), results })
}
