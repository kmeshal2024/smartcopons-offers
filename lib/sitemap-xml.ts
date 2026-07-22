/**
 * Minimal sitemap XML builders.
 *
 * The site is split into several sitemaps (pages / coupons / flyers) referenced
 * from a sitemap index. At the current URL count this is not about Google's
 * 50,000-URL limit — it's so Search Console reports indexing coverage per
 * section instead of lumping everything into one number.
 */

export interface SitemapEntry {
  loc: string
  lastmod?: Date | string
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: number
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toIsoDate(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

export function buildUrlSet(entries: SitemapEntry[]): string {
  const urls = entries
    .map(e => {
      const parts = [`    <loc>${escapeXml(e.loc)}</loc>`]
      if (e.lastmod) {
        const iso = toIsoDate(e.lastmod)
        if (iso) parts.push(`    <lastmod>${iso}</lastmod>`)
      }
      if (e.changefreq) parts.push(`    <changefreq>${e.changefreq}</changefreq>`)
      if (typeof e.priority === 'number') parts.push(`    <priority>${e.priority.toFixed(1)}</priority>`)
      return `  <url>\n${parts.join('\n')}\n  </url>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
}

export function buildSitemapIndex(sitemaps: { loc: string; lastmod?: Date | string }[]): string {
  const items = sitemaps
    .map(s => {
      const parts = [`    <loc>${escapeXml(s.loc)}</loc>`]
      if (s.lastmod) {
        const iso = toIsoDate(s.lastmod)
        if (iso) parts.push(`    <lastmod>${iso}</lastmod>`)
      }
      return `  <sitemap>\n${parts.join('\n')}\n  </sitemap>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</sitemapindex>`
}

export const XML_HEADERS = {
  'Content-Type': 'application/xml; charset=utf-8',
  // Cache at the CDN so crawler hits don't run these queries every time.
  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
} as const

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sa.smartcopons.com'
