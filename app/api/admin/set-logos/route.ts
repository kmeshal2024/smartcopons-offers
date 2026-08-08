import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Point retailer logos at the self-hosted copies in /public/logos.
 *
 * Some retailers' logo URLs 404 (the pharmacies referenced files that didn't
 * exist yet) or hotlink-protect (they return 200 to curl but block requests
 * whose Referer is another site, so the logo shows broken in the browser).
 * Self-hosting sidesteps both. The PNGs live in public/logos/<slug>.png.
 *
 * Guarded by APP_SECRET. Body: {"key":"…"} sets the defaults below, or pass
 * {"logos":{"slug":"/logos/x.png"}} to override.
 *
 *   curl -X POST .../api/admin/set-logos -d '{"key":"$APP_SECRET"}'
 */
export const dynamic = 'force-dynamic'

const DEFAULTS: Record<string, string> = {
  nahdi: '/logos/nahdi.png',
  aldawaa: '/logos/aldawaa.png',
  tamimi: '/logos/tamimi.png',
  extra: '/logos/extra.png',
  // UAE stores onboarded via ClicFlyer import — meta never carried a logo,
  // so these were null until backfilled from ClicFlyer's retailer pages.
  'nesto-ae': '/logos/nesto-ae.svg',
  'union-coop': '/logos/union-coop.jpg',
  adcoop: '/logos/adcoop.jpg',
  'km-trading': '/logos/km-trading.jpg',
  geant: '/logos/geant.jpg',
  gala: '/logos/gala.jpg',
  almaya: '/logos/almaya.jpg',
  'ansar-gallery': '/logos/ansar-gallery.jpg',
  aswaaq: '/logos/aswaaq.jpg',
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { key, logos } = body as { key?: string; logos?: Record<string, string> }

  const appSecret = process.env.APP_SECRET
  if (!appSecret || key !== appSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const map = logos && Object.keys(logos).length ? logos : DEFAULTS
  const updated: Record<string, string> = {}
  for (const [slug, logo] of Object.entries(map)) {
    const res = await prisma.supermarket.updateMany({ where: { slug }, data: { logo } })
    if (res.count > 0) updated[slug] = logo
  }

  return NextResponse.json({ success: true, updated })
}
