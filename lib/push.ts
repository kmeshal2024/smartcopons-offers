import webpush from 'web-push'
import { prisma } from '@/lib/db'

/**
 * The public VAPID key is exactly that — public. It ships to every browser that
 * subscribes, so committing it is fine. The private key is a genuine secret and
 * lives in app_settings (see /api/admin/migrate-push).
 */
export const VAPID_PUBLIC =
  'BOiMTZff4Nl3cwWKC2n_27yxD49JBYX25jlD7R07xoGEeDXcmMDVfZrTNOkQ-eUXBtck_TngCfD04NZzlVgQTuI'

const CONTACT = 'mailto:mk2018ksa@gmail.com'

let configured = false

/** Load the private key once per warm instance and configure web-push. */
async function ensureConfigured(): Promise<boolean> {
  if (configured) return true
  const row = await prisma.appSetting.findUnique({ where: { key: 'vapid_private' } })
  const priv = process.env.VAPID_PRIVATE_KEY || row?.value
  if (!priv) return false
  webpush.setVapidDetails(CONTACT, VAPID_PUBLIC, priv)
  configured = true
  return true
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

/**
 * Send to one subscription. Returns false when the endpoint is dead (404/410),
 * so the caller can prune it — stale endpoints otherwise pile up forever.
 */
export async function sendToSubscription(
  sub: { id: string; endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
): Promise<boolean> {
  if (!(await ensureConfigured())) return false
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    )
    await prisma.pushSubscription.update({ where: { id: sub.id }, data: { failures: 0 } }).catch(() => {})
    return true
  } catch (e: any) {
    const gone = e?.statusCode === 404 || e?.statusCode === 410
    if (gone) {
      await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
    } else {
      await prisma.pushSubscription
        .update({ where: { id: sub.id }, data: { failures: { increment: 1 } } })
        .catch(() => {})
    }
    return false
  }
}

/** Send the same payload to every subscription a shopper has registered. */
export async function sendToShopper(shopperId: string, payload: PushPayload): Promise<number> {
  const subs = await prisma.pushSubscription.findMany({
    where: { shopperId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  })
  let sent = 0
  for (const s of subs) {
    if (await sendToSubscription(s, payload)) sent++
  }
  return sent
}
