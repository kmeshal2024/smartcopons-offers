import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getOrCreateShopper, findShopper, isValidDeviceId } from '@/lib/shopper'
import { VAPID_PUBLIC } from '@/lib/push'

/**
 * Register / drop a browser push endpoint, tied to the same anonymous device
 * token the favourites and price watches use — so a price-drop alert reaches
 * the device that asked for it.
 */
export const dynamic = 'force-dynamic'

// The client needs the public key to call pushManager.subscribe().
export async function GET() {
  return NextResponse.json({ publicKey: VAPID_PUBLIC })
}

export async function POST(request: Request) {
  const { deviceId, subscription } = (await request.json().catch(() => ({}))) as {
    deviceId?: string
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  }

  const endpoint = subscription?.endpoint
  const p256dh = subscription?.keys?.p256dh
  const auth = subscription?.keys?.auth
  if (!isValidDeviceId(deviceId) || !endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'deviceId and a full subscription are required' }, { status: 400 })
  }

  const shopper = await getOrCreateShopper(deviceId)
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    // Re-subscribing on the same endpoint should re-point it at this shopper
    // and clear any accumulated failures.
    update: { shopperId: shopper.id, p256dh, auth, failures: 0 },
    create: { shopperId: shopper.id, endpoint, p256dh, auth },
  })

  return NextResponse.json({ ok: true, subscribed: true })
}

export async function DELETE(request: Request) {
  const { endpoint } = (await request.json().catch(() => ({}))) as { endpoint?: string }
  if (!endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 })
  await prisma.pushSubscription.deleteMany({ where: { endpoint } })
  return NextResponse.json({ ok: true, subscribed: false })
}
