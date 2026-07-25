import { prisma } from '@/lib/db'

/** A device token must look like our client-generated id: 16–64 url-safe chars. */
export function isValidDeviceId(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(id)
}

/**
 * Find or create the anonymous shopper for a device token. Shoppers are created
 * lazily — only when a device first saves a favourite or a watch — so random
 * visitors don't spawn rows.
 */
export async function getOrCreateShopper(deviceId: string): Promise<{ id: string }> {
  return prisma.shopper.upsert({
    where: { deviceId },
    update: {},
    create: { deviceId },
    select: { id: true },
  })
}

export async function findShopper(deviceId: string): Promise<{ id: string } | null> {
  return prisma.shopper.findUnique({ where: { deviceId }, select: { id: true } })
}
