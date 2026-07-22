import { buildSitemapIndex, XML_HEADERS, SITE_URL } from '@/lib/sitemap-xml'

export const dynamic = 'force-dynamic'

/** Sitemap index — robots.txt points here. */
export async function GET() {
  const now = new Date()
  const xml = buildSitemapIndex([
    { loc: `${SITE_URL}/sitemap-pages.xml`, lastmod: now },
    { loc: `${SITE_URL}/sitemap-coupons.xml`, lastmod: now },
    { loc: `${SITE_URL}/sitemap-flyers.xml`, lastmod: now },
  ])
  return new Response(xml, { headers: XML_HEADERS })
}
