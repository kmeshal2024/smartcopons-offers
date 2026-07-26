import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * One-off: create the push tables and store the VAPID private key.
 *
 * The private key authorises sending notifications to our subscribers, so it is
 * a real secret and must not sit in the repo. It's kept in app_settings, which
 * is only reachable through APP_SECRET-guarded routes — the same trust boundary
 * an env var would give us, without needing dashboard access to set one.
 *
 *   curl -X POST .../api/admin/migrate-push \
 *     -d '{"key":"$APP_SECRET","vapidPrivate":"..."}'
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
     id text PRIMARY KEY,
     "shopperId" text REFERENCES shoppers(id) ON DELETE CASCADE,
     endpoint text NOT NULL UNIQUE,
     p256dh text NOT NULL,
     auth text NOT NULL,
     failures integer NOT NULL DEFAULT 0,
     "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS push_subscriptions_shopperId_idx ON push_subscriptions ("shopperId")`,
  `CREATE TABLE IF NOT EXISTS app_settings (
     key text PRIMARY KEY,
     value text NOT NULL,
     "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
]

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { key, vapidPrivate } = body as { key?: string; vapidPrivate?: string }

  const appSecret = process.env.APP_SECRET
  if (!appSecret || key !== appSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { stmt: string; ok: boolean; error?: string }[] = []
  for (const stmt of STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(stmt)
      results.push({ stmt: stmt.slice(0, 46).replace(/\s+/g, ' '), ok: true })
    } catch (e) {
      results.push({
        stmt: stmt.slice(0, 46).replace(/\s+/g, ' '),
        ok: false,
        error: e instanceof Error ? e.message.slice(0, 140) : String(e),
      })
    }
  }

  let keyStored = false
  if (vapidPrivate) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO app_settings (key, value, "updatedAt") VALUES ('vapid_private', $1, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = now()`,
      vapidPrivate
    )
    keyStored = true
  }

  return NextResponse.json({ success: results.every(r => r.ok), results, keyStored })
}
