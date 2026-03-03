import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, string> = {
    server: '✅ OK',
    node_version: process.version,
    env_NODE_ENV: process.env.NODE_ENV || 'not set',
    env_DATABASE_URL: process.env.DATABASE_URL ? '✅ Set' : '❌ MISSING',
    env_APP_SECRET: process.env.APP_SECRET ? '✅ Set' : '❌ MISSING',
    env_NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'not set',
    database: '⏳ checking...',
    timestamp: new Date().toISOString(),
  }

  // Test database connection
  try {
    await prisma.$queryRaw`SELECT 1 as test`
    checks.database = '✅ Connected'

    // Count records
    const [users, supermarkets, categories, products, coupons] = await Promise.all([
      prisma.user.count(),
      prisma.supermarket.count(),
      prisma.category.count(),
      prisma.productOffer.count(),
      prisma.coupon.count(),
    ])
    checks.db_users = String(users)
    checks.db_supermarkets = String(supermarkets)
    checks.db_categories = String(categories)
    checks.db_products = String(products)
    checks.db_coupons = String(coupons)
  } catch (err: any) {
    checks.database = `❌ Error: ${err.message}`
  }

  return NextResponse.json(checks, {
    headers: { 'Cache-Control': 'no-store' }
  })
}
