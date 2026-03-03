import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export class CategoryMapper {
  private categoryKeywords: Map<string, string[]> = new Map()

  async initialize() {
    // Load categories from database
    const categories = await prisma.category.findMany({
      where: { isActive: true },
    })

    // Build keyword map
    for (const category of categories) {
      const keywords = this.getCategoryKeywords(category.slug)
      this.categoryKeywords.set(category.id, keywords)
    }
  }

  /**
   * Map product to category based on keywords
   */
  async mapToCategory(productName: string): Promise<string | null> {
    if (!productName) return null

    const normalizedName = productName.toLowerCase()

    // Try to match keywords
    for (const [categoryId, keywords] of Array.from(this.categoryKeywords.entries())) {
      for (const keyword of keywords) {
        if (normalizedName.includes(keyword.toLowerCase())) {
          return categoryId
        }
      }
    }

    // Return "Uncategorized" or null
    const uncategorized = await prisma.category.findFirst({
      where: { slug: 'uncategorized' },
    })

    return uncategorized?.id || null
  }

  /**
   * Get keywords for a category
   */
  private getCategoryKeywords(slug: string): string[] {
    const keywordMap: Record<string, string[]> = {
      'rice-grains': ['rice', 'أرز', 'grain', 'حبوب', 'basmati', 'بسمتي'],
      dairy: ['milk', 'حليب', 'cheese', 'جبن', 'yogurt', 'لبن', 'cream'],
      beverages: ['juice', 'عصير', 'water', 'ماء', 'cola', 'pepsi', 'drink'],
      snacks: ['chips', 'شيبس', 'chocolate', 'شوكولاتة', 'candy', 'حلوى'],
      'home-kitchen': ['plate', 'صحن', 'pot', 'قدر', 'pan', 'مقلاة'],
      electronics: ['phone', 'هاتف', 'tv', 'تلفاز', 'laptop', 'كمبيوتر'],
    }

    return keywordMap[slug] || []
  }
}