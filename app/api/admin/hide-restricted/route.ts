import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isRestrictedProduct, restrictedReason } from '@/lib/restricted-products'

/**
 * Hide age-restricted offers (tobacco, OTC medicine, alcohol) so the app can
 * carry a 3+ content rating instead of 16+. See lib/restricted-products.ts.
 *
 * Runs through the app's own Prisma connection because the database is only
 * reachable from the deployment, and is guarded by APP_SECRET like the other
 * admin maintenance routes. Idempotent — re-running only affects rows whose
 * visibility does not already match.
 *
 * Preview (changes nothing):
 *   curl "https://sa.smartcopons.com/api/admin/hide-restricted?key=$APP_SECRET&dry=1"
 * Apply:
 *   curl -X POST "https://sa.smartcopons.com/api/admin/hide-restricted" \
 *     -H "Content-Type: application/json" -d '{"key":"'"$APP_SECRET"'"}'
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

type Row = { id: string; nameAr: string; nameEn: string | null; brand: string | null; isHidden: boolean }

async function run(dry: boolean) {
  // Scan every offer: the terms live in free-text names, so there is no
  // indexable predicate to push into SQL.
  const offers = (await prisma.productOffer.findMany({
    select: { id: true, nameAr: true, nameEn: true, brand: true, isHidden: true },
  })) as Row[]

  const shouldHide: Row[] = []
  const reasons: Record<string, number> = {}
  for (const o of offers) {
    if (!isRestrictedProduct(o.nameAr, o.nameEn, o.brand)) continue
    const why = restrictedReason(o.nameAr, o.nameEn, o.brand) || '?'
    reasons[why] = (reasons[why] || 0) + 1
    if (!o.isHidden) shouldHide.push(o)
  }

  const result = {
    scanned: offers.length,
    matched: Object.values(reasons).reduce((a, b) => a + b, 0),
    newlyHidden: shouldHide.length,
    byTerm: Object.fromEntries(Object.entries(reasons).sort((a, b) => b[1] - a[1])),
    samples: shouldHide.slice(0, 25).map(o => o.nameAr.slice(0, 70)),
    dry,
  }

  if (!dry && shouldHide.length) {
    // Chunked: a single updateMany with tens of thousands of ids can exceed
    // the statement parameter limit.
    for (let i = 0; i < shouldHide.length; i += 500) {
      await prisma.productOffer.updateMany({
        where: { id: { in: shouldHide.slice(i, i + 500).map(o => o.id) } },
        data: { isHidden: true },
      })
    }
  }
  return result
}

function authed(key: string | null) {
  const secret = process.env.APP_SECRET
  return !!secret && key === secret
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  if (!authed(url.searchParams.get('key'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // GET is preview-only so a leaked URL can never mutate data.
  return NextResponse.json(await run(true))
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  if (!authed(body?.key ?? new URL(request.url).searchParams.get('key'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await run(body?.dry === true))
}
