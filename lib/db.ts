import { PrismaClient } from '@prisma/client'

/**
 * The database is Neon in eu-central-1 (Frankfurt), and `vercel.json` pins
 * functions to `fra1` to sit next to it.
 *
 * That pin was missing until now: functions ran in `iad1` (Washington) while five
 * source comments across app/ asserted they were already in Frankfurt. Every
 * query crossed the Atlantic — roughly 180ms round trip, which was most of the
 * 2.2s homepage TTFB, and it held the Neon connection open proportionally longer
 * for identical work. Confirmed by `X-Vercel-Id: bom1::iad1::…` on live responses.
 *
 * NOTE: `vercel.json` is schema-validated by Vercel and rejects unknown keys, so
 * the reasoning cannot live there as a `//` pseudo-comment — a deploy fails
 * outright with "should NOT have additional property". Hence this note here.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Limit connection pool for shared hosting (default is 5 connections)
// Append connection_limit to DATABASE_URL in .env for shared hosting:
//   DATABASE_URL="mysql://...?connection_limit=3"
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
