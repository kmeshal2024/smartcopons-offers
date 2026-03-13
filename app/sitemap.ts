import { MetadataRoute } from 'next'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sa.smartcopons.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let supermarkets: { slug: string; updatedAt: Date }[] = []
  let categories: { slug: string }[] = []

  try {
    ;[supermarkets, categories] = await Promise.all([
      prisma.supermarket.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
      }),
      prisma.category.findMany({
        where: { isActive: true },
        select: { slug: true },
      }),
    ])
  } catch {
    // DB not available during build — return static routes only
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE_URL}/offers`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/supermarkets`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ]

  const supermarketRoutes: MetadataRoute.Sitemap = supermarkets.map(sm => ({
    url: `${BASE_URL}/offers/${sm.slug}`,
    lastModified: sm.updatedAt,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }))

  const categoryRoutes: MetadataRoute.Sitemap = categories.map(cat => ({
    url: `${BASE_URL}/offers/category/${cat.slug}`,
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }))

  return [...staticRoutes, ...supermarketRoutes, ...categoryRoutes]
}
