import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { CategoryMapper } from '@/lib/services/category-mapper'

/**
 * Re-run the category mapper over offers already in the database.
 *
 * The mapper used to return the FIRST category whose keyword appeared in the
 * name, and the order depended on how the categories came back from the
 * database. "ماء عطر جيفنشي" (eau de parfum) therefore landed in beverages
 * because "ماء" was tested before "عطر" — which put perfume at the top of
 * every search for water. The mapper now scores every category and keeps the
 * most specific match, but rows stamped by the old logic keep their wrong
 * category until this runs.
 *
 * Guarded by APP_SECRET. Idempotent — a row whose category already matches is
 * left alone, so it is safe to re-run.
 *
 *   Preview:  GET  ...?key=$APP_SECRET&dry=1
 *   Apply:    POST ... {"key":"..."}
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function run(dry: boolean, limit: number) {
  const mapper = new CategoryMapper()
  await mapper.initialize()

  const cats = await prisma.category.findMany({ select: { id: true, slug: true } })
  const slugById = new Map(cats.map(c => [c.id, c.slug]))

  // Cursor-paginate the whole table. A plain `take: 50000` silently truncated:
  // the offers API reports ~38k because it counts only visible, unexpired rows,
  // while product_offers itself holds more — so everything past the cut kept its
  // old category and the run still reported "0 to change".
  const offers: Array<{ id: string; nameAr: string | null; nameEn: string | null; categoryId: string | null }> = []
  let cursor: string | undefined
  while (offers.length < limit) {
    const page = await prisma.productOffer.findMany({
      select: { id: true, nameAr: true, nameEn: true, categoryId: true },
      take: 5000,
      orderBy: { id: 'asc' },
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    })
    if (!page.length) break
    offers.push(...page)
    cursor = page[page.length - 1].id
    if (page.length < 5000) break
  }

  const changes: Array<{ id: string; name: string; from: string; to: string }> = []
  for (const o of offers) {
    const name = o.nameAr || o.nameEn || ''
    if (!name) continue
    const next = await mapper.mapToCategory(name)
    if (!next || next === o.categoryId) continue
    changes.push({
      id: o.id,
      name: name.slice(0, 55),
      from: slugById.get(o.categoryId || '') || '(none)',
      to: slugById.get(next) || '(none)',
    })
  }

  if (!dry) {
    // Group by target so this is a handful of updateMany calls rather than one
    // round trip per row.
    const byTarget = new Map<string, string[]>()
    for (const c of changes) {
      const target = cats.find(x => slugById.get(x.id) === c.to)?.id
      if (!target) continue
      const list = byTarget.get(target) || []
      list.push(c.id)
      byTarget.set(target, list)
    }
    for (const [categoryId, ids] of Array.from(byTarget.entries())) {
      for (let i = 0; i < ids.length; i += 500) {
        await prisma.productOffer.updateMany({
          where: { id: { in: ids.slice(i, i + 500) } },
          data: { categoryId },
        })
      }
    }
  }

  const moves: Record<string, number> = {}
  for (const c of changes) {
    const k = `${c.from} -> ${c.to}`
    moves[k] = (moves[k] || 0) + 1
  }

  return {
    scanned: offers.length,
    changed: changes.length,
    dry,
    topMoves: Object.fromEntries(Object.entries(moves).sort((a, b) => b[1] - a[1]).slice(0, 12)),
    samples: changes.slice(0, 15).map(c => `[${c.from} -> ${c.to}] ${c.name}`),
  }
}

function authed(key: string | null) {
  return !!process.env.APP_SECRET && key === process.env.APP_SECRET
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  if (!authed(url.searchParams.get('key'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // GET is preview-only so a leaked URL can never rewrite the catalogue.
  return NextResponse.json(await run(true, Number(url.searchParams.get('limit')) || 200000))
}

export async function POST(request: Request) {
  const body: any = await request.json().catch(() => ({}))
  const key = body?.key ?? new URL(request.url).searchParams.get('key')
  if (!authed(key)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await run(body?.dry === true, Number(body?.limit) || 200000))
}
