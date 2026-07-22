import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sa.smartcopons.com'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/admin/',
          '/api/cron/',
          // On-site search results are near-infinite and duplicate the listings.
          // Handled here rather than via a noindex tag: reading searchParams in
          // generateMetadata forces dynamic streaming, and the response then
          // commits a 200 before notFound() can set a 404 for unknown slugs.
          '/*?*search=',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
