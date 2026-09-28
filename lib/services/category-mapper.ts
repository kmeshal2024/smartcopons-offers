import { prisma } from '@/lib/db'
import { classify } from './category-rules'

export class CategoryMapper {
  /** slug → id, for the categories that exist and are active. */
  private idBySlug: Map<string, string> = new Map()
  /** Resolved once in initialize() — see the note in mapToCategory(). */
  private uncategorizedId: string | null = null

  async initialize() {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
    })
    for (const category of categories) this.idBySlug.set(category.slug, category.id)

    this.uncategorizedId =
      categories.find(c => c.slug === 'uncategorized')?.id ??
      (await prisma.category.findFirst({ where: { slug: 'uncategorized' } }))?.id ??
      null
  }

  /**
   * Map a product to a category. The rules — and the reasons for them — live in
   * category-rules.ts, which is pure so it can be evaluated against a catalogue
   * dump without a database.
   *
   * Pass both names when available: ~1 product in 100 has only an English name,
   * and a few have an Arabic name too terse to classify.
   */
  async mapToCategory(productName: string, altName?: string | null): Promise<string | null> {
    if (!productName && !altName) return null

    const available = this.idBySlug.keys()
    const slugs = Array.from(available)
    let result = classify(productName || '', slugs)
    if (altName) {
      const alt = classify(altName, slugs)
      if (alt.score > result.score) result = alt
    }
    if (result.slug) return this.idBySlug.get(result.slug) ?? this.uncategorizedId

    // Fall back to "Uncategorized". This used to query the database on every
    // unmatched product — hundreds of extra round trips per scrape, which is
    // part of why a full catalogue run pushed the cron past its time limit.
    return this.uncategorizedId
  }
}
