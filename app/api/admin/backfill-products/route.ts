import { NextResponse } from 'next/server'
import { syncProducts } from '@/lib/services/product-sync'

/**
 * Stable products — phase 2 of 5: fill `products` and `product_prices` from the
 * offers already in the database, and link each offer to its product.
 *
 * Writes only to the two new tables and to `product_offers."productId"`, none of
 * which anything reads yet, so this is invisible to the site.
 *
 *   Measure:  POST {"dry": true}        — no writes; reports the match rate
 *   Apply:    POST {}                   — idempotent, safe to re-run
 *   One flyer: POST {"flyerId": "…"}   — exactly what the nightly ingest runs
 *
 * The dry run exists because the identity rule (lib/products.ts) is a guess
 * until it has met the real catalogue. It reports how many offers collapse into
 * how many products, how many products have already been seen at more than one
 * price (each of those is a URL that the old scheme broke), and the largest
 * groups, which is where a too-loose key shows up as unrelated items merged.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: Request) {
  const secret = process.env.APP_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body: any = await request.json().catch(() => ({}))
  try {
    const dry = body?.dry === true
    return NextResponse.json(
      typeof body?.flyerId === 'string'
        ? await syncProducts({ flyerId: body.flyerId }, { dry, observed: 'today' })
        : await syncProducts({ all: true }, { dry, observed: 'created', diagnostics: true })
    )
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message).slice(0, 400) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed. Use POST with an Authorization: Bearer header.' },
    { status: 405, headers: { Allow: 'POST' } }
  )
}
