import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { countryFromRequest } from '@/lib/countries'

export const dynamic = 'force-dynamic'

/**
 * Persists a shopping-list snapshot so it can be opened from a WhatsApp link.
 *
 * WRITE TIMING: this is called ONCE, on share — never on add/remove/quantity.
 * The list itself stays localStorage-only, so building and editing it costs zero
 * database work. Cost therefore scales with shares, not with edits or page views:
 * the opposite shape to the write-on-read that was removed from /api/offers.
 *
 * The id is generated CLIENT-side and posted here. That is deliberate: the share
 * button must call window.open() synchronously inside the click handler or the
 * popup blocker kills it, and it cannot wait for a round trip to learn the URL.
 * The client uses crypto.randomUUID(), so the token is CSPRNG-derived, not
 * sequential — sequential ids would let anyone walk other households' lists.
 * Everything below re-validates rather than trusting the client.
 */

const ID_RE = /^[A-Za-z0-9_-]{10,32}$/
const MAX_ITEMS = 200
const MAX_NAME = 120
const RETENTION_DAYS = 90

interface IncomingItem {
  name?: unknown
  price?: unknown
  oldPrice?: unknown
  qty?: unknown
  storeName?: unknown
}

function clean(items: unknown): Array<{
  name: string
  price: number
  oldPrice: number | null
  qty: number
  storeName: string | null
}> {
  if (!Array.isArray(items)) return []
  const out = []
  for (const raw of (items as IncomingItem[]).slice(0, MAX_ITEMS)) {
    const name = String(raw?.name ?? '').trim().slice(0, MAX_NAME)
    const price = Number(raw?.price)
    const qty = Math.min(999, Math.max(1, Math.floor(Number(raw?.qty) || 1)))
    if (!name || !Number.isFinite(price) || price < 0) continue
    const oldPrice = Number(raw?.oldPrice)
    out.push({
      name,
      price,
      oldPrice: Number.isFinite(oldPrice) && oldPrice > price ? oldPrice : null,
      qty,
      storeName: raw?.storeName ? String(raw.storeName).trim().slice(0, 60) : null,
    })
  }
  return out
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const id = String(body?.id ?? '')
    if (!ID_RE.test(id)) {
      return NextResponse.json({ error: 'Bad id' }, { status: 400 })
    }

    const items = clean(body?.items)
    if (items.length === 0) {
      return NextResponse.json({ error: 'Empty list' }, { status: 400 })
    }

    // Totals are recomputed here rather than trusted from the client, so a
    // shared link can never advertise a saving the items do not add up to.
    const total = items.reduce((a, i) => a + i.price * i.qty, 0)
    const savings = items.reduce(
      (a, i) => a + (i.oldPrice ? (i.oldPrice - i.price) * i.qty : 0),
      0
    )

    const expiresAt = new Date(Date.now() + RETENTION_DAYS * 86_400_000)

    // Snapshots are immutable: a re-share after edits mints a new id. `create`
    // rather than `upsert` so a colliding id fails instead of overwriting
    // somebody else's list.
    await prisma.sharedList.create({
      data: {
        id,
        itemsJson: JSON.stringify(items),
        itemCount: items.length,
        total: Math.round(total * 100) / 100,
        savings: Math.round(savings * 100) / 100,
        country: countryFromRequest(request),
        expiresAt,
      },
    })

    return NextResponse.json({ id, itemCount: items.length })
  } catch (e: any) {
    // A unique-constraint collision on a 16-char CSPRNG token is not realistically
    // reachable, but returning 409 beats a 500 if it ever is.
    if (String(e?.code) === 'P2002') {
      return NextResponse.json({ error: 'Duplicate id' }, { status: 409 })
    }
    console.error('Shared list create failed:', e)
    return NextResponse.json({ error: 'Failed to save list' }, { status: 500 })
  }
}
