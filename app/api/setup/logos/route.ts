import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * One-time setup endpoint to populate supermarket logos
 * Auth: ?key=APP_SECRET
 * Usage: GET /api/setup/logos?key=YOUR_SECRET
 */

const LOGOS: Record<string, string> = {
  panda: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Panda_Retail_Company_Logo.svg/250px-Panda_Retail_Company_Logo.svg.png',
  danube: 'https://danube.sa/assets/logo/danube-logo-sa-en-black-1777a8c9f8306e6b24ee878f733a0ef034591ba3031cdeb45404f184bc1f94bc.svg',
  carrefour: 'https://upload.wikimedia.org/wikipedia/en/thumb/6/65/Carrefour_Groupe.svg/250px-Carrefour_Groupe.svg.png',
  lulu: 'https://upload.wikimedia.org/wikipedia/en/b/b3/LuLuGroupInternationalLogo.png',
  alothaim: 'https://images.ctfassets.net/l7jj78cw6vpe/5rvw3PGe0yeQuH85lj0yN9/2fe5bacdedc98cdade9acbea0b3b144c/othaim-logo.svg',
  tamimi: 'https://www.tamimimarkets.com/__template/images/logo-01.png',
  bindawood: 'https://aym-bindawood-production.herokuapp.com/assets/logo/bindawood-logo-sa-en-white-c7398374050a5514c9de186b63bfe168f0bae76e8bd3a5993ddc7dba26b6c86d.png',
  extra: 'https://media.extra.com/i/aurora/extra-logo?fmt=png&w=200',
  saco: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/SACO_Hardware_Logo.svg/330px-SACO_Hardware_Logo.svg.png',
  nesto: 'https://nestogroup.com/wp-content/themes/Netstager_Creative_Suite-3.0/images/nesto-logo.svg',
  farm: 'https://farm.com.sa/images/FrontEnd/New-Farm-Logo.png',
  manuel: 'https://cdn.d4donline.com/u/c/59c847e865475604d5894b9c06ce94f5.jpg',
}

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key')
  if (key !== process.env.APP_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { slug: string; status: string }[] = []

  for (const [slug, logoUrl] of Object.entries(LOGOS)) {
    try {
      const supermarket = await prisma.supermarket.findUnique({ where: { slug } })
      if (!supermarket) {
        results.push({ slug, status: 'not found in DB' })
        continue
      }

      await prisma.supermarket.update({
        where: { slug },
        data: { logo: logoUrl },
      })
      results.push({ slug, status: `updated ✓` })
    } catch (e) {
      results.push({ slug, status: `error: ${e instanceof Error ? e.message : e}` })
    }
  }

  return NextResponse.json({
    success: true,
    message: 'Logo update complete',
    results,
  })
}
