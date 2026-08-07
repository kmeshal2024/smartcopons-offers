import { prisma } from '@/lib/db'

/**
 * Does `needle` appear in `haystack` as a whole word?
 *
 * Kept as a plain function rather than an inline template so the regex escaping
 * stays readable. `\p{L}` covers Arabic and Latin alike, so "زيت" (oil) does
 * not match inside "زيتون" (olives).
 */
function boundedMatch(haystack: string, needle: string): boolean {
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\p{L}])${esc}($|[^\\p{L}])`, 'u').test(haystack)
}

export class CategoryMapper {
  private categoryKeywords: Map<string, string[]> = new Map()
  /** Resolved once in initialize() — see the note in mapToCategory(). */
  private uncategorizedId: string | null = null

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

    this.uncategorizedId =
      categories.find(c => c.slug === 'uncategorized')?.id ??
      (await prisma.category.findFirst({ where: { slug: 'uncategorized' } }))?.id ??
      null
  }

  /**
   * Map product to category based on keywords
   */
  async mapToCategory(productName: string): Promise<string | null> {
    if (!productName) return null

    const normalizedName = productName.toLowerCase()

    // Score EVERY category and take the best, rather than returning the first
    // keyword that happens to hit. First-match-wins depended on the order the
    // categories came back from the database, so "ماء عطر جيفنشي" (eau de
    // parfum) landed in beverages because "ماء" was checked before "عطر" —
    // which then put perfume at the top of every search for water.
    //
    // The score is the length of the matched keyword, so the most specific
    // match wins: the phrase "ماء عطر" beats the bare word "ماء".
    let bestId: string | null = null
    let bestScore = 0

    for (const [categoryId, keywords] of Array.from(this.categoryKeywords.entries())) {
      let score = 0
      for (const keyword of keywords) {
        const k = keyword.toLowerCase()
        if (!normalizedName.includes(k)) continue
        // Whole-word matches count for more than a keyword buried inside a
        // longer word — "زيت" (oil) must not score on "زيتون" (olives).
        const bounded = boundedMatch(normalizedName, k)
        score = Math.max(score, bounded ? k.length * 2 : k.length)
      }
      if (score > bestScore) {
        bestScore = score
        bestId = categoryId
      }
    }
    if (bestId) return bestId

    // Fall back to "Uncategorized". This used to query the database on every
    // unmatched product — hundreds of extra round trips per scrape, which is
    // part of why a full catalogue run pushed the cron past its time limit.
    return this.uncategorizedId
  }

  /**
   * Get keywords for a category
   */
  private getCategoryKeywords(slug: string): string[] {
    const keywordMap: Record<string, string[]> = {
      'rice-grains': [
        'rice', 'أرز', 'grain', 'حبوب', 'basmati', 'بسمتي', 'flour', 'طحين', 'دقيق',
        'pasta', 'معكرونة', 'spaghetti', 'macaroni', 'noodle', 'oats', 'شوفان', 'cereal',
        'cornflakes', 'wheat', 'قمح', 'lentil', 'عدس', 'chickpea', 'حمص',
      ],
      dairy: [
        'milk', 'حليب', 'cheese', 'جبن', 'yogurt', 'لبن', 'cream', 'قشطة', 'زبدة',
        'butter', 'labneh', 'لبنه', 'nadec', 'almarai', 'المراعي', 'nada', 'ندى',
        'kiri', 'puck', 'philadelphia', 'mozzarella', 'cheddar', 'feta',
      ],
      beverages: [
        'juice', 'عصير', 'water', 'ماء', 'cola', 'pepsi', 'drink', 'مشروب',
        'tea', 'شاي', 'coffee', 'قهوة', 'nescafe', 'lipton', 'sprite', 'fanta',
        'mirinda', 'vimto', 'tang', 'soda', 'energy', 'redbull', 'red bull',
      ],
      snacks: [
        'chips', 'شيبس', 'chocolate', 'شوكولاتة', 'candy', 'حلوى', 'biscuit', 'بسكويت',
        'cookies', 'كوكيز', 'nuts', 'مكسرات', 'wafer', 'kit kat', 'kitkat', 'oreo',
        'pringles', 'lays', 'doritos', 'twix', 'snickers', 'galaxy', 'cadbury',
        'popcorn', 'فشار', 'pretzel', 'cracker',
      ],
      'meat-poultry': [
        'chicken', 'دجاج', 'meat', 'لحم', 'beef', 'lamb', 'ضأن', 'خروف',
        'turkey', 'ديك رومي', 'fish', 'سمك', 'shrimp', 'روبيان', 'salmon', 'سلمون',
        'tuna', 'تونة', 'fillet', 'فيليه', 'steak', 'ستيك', 'sausage', 'نقانق',
        'burger', 'برغر', 'minced', 'مفروم', 'fresh', 'طازج',
      ],
      // NOTE: these keys must match the category SLUGS in the database exactly.
      // They didn't — the map had 'fruits-vegetables', 'bread-bakery',
      // 'home-kitchen' and 'canned-goods' while the DB has 'fruits',
      // 'vegetables', 'bakery', 'household' and 'canned-dry'. Every lookup for
      // those returned an empty keyword list, so nothing could ever match and
      // five categories sat permanently at zero products.
      fruits: [
        'apple', 'تفاح', 'banana', 'موز', 'fruit', 'فواكه', 'فاكهة', 'orange', 'برتقال',
        'grape', 'عنب', 'mango', 'مانجو', 'strawberry', 'فراولة', 'lemon', 'ليمون',
        'avocado', 'أفوكادو', 'watermelon', 'بطيخ', 'melon', 'شمام', 'peach', 'خوخ',
        'pear', 'كمثرى', 'إجاص', 'pineapple', 'أناناس', 'kiwi', 'كيوي', 'تمر', 'dates',
        'رمان', 'pomegranate', 'تين', 'مشمش', 'برقوق', 'جوافة', 'papaya',
      ],
      vegetables: [
        'tomato', 'طماطم', 'potato', 'بطاطس', 'بطاطا', 'onion', 'بصل',
        'vegetable', 'خضار', 'خضروات', 'cucumber', 'خيار', 'carrot', 'جزر',
        'lettuce', 'خس', 'pepper', 'فلفل', 'garlic', 'ثوم', 'ginger', 'زنجبيل',
        'zucchini', 'كوسة', 'eggplant', 'باذنجان', 'cabbage', 'ملفوف', 'كرنب',
        'cauliflower', 'قرنبيط', 'broccoli', 'بروكلي', 'spinach', 'سبانخ',
        'okra', 'بامية', 'بقدونس', 'كزبرة', 'نعناع', 'فجل', 'شمندر', 'كرفس',
      ],
      frozen: [
        'frozen', 'مجمد', 'ice cream', 'آيس كريم', 'pizza', 'بيتزا', 'nuggets', 'ناجتس',
        'fries', 'بطاطس مقلية', 'baskin', 'magnum', 'cornetto', 'samosa', 'سمبوسة',
        'spring roll', 'popsicle',
      ],
      'baby-care': [
        'baby', 'أطفال', 'diaper', 'حفاضات', 'pampers', 'formula', 'حليب أطفال',
        'huggies', 'wipes', 'مناديل مبللة', 'nanny', 'similac', 'aptamil', 'cerelac',
      ],
      'personal-care': [
        // Phrases first: they outscore the bare words they contain, which is
        // how "ماء عطر" stops being read as water.
        'ماء عطر', 'ماء تواليت', 'eau de parfum', 'eau de toilette', 'ماء كولونيا',
        // "معجون" alone is ambiguous — tomato paste is معجون طماطم — and a
        // mint toothpaste was scoring on "نعناع" from the vegetables list.
        'معجون اسنان', 'معجون أسنان', 'غسول فم', 'فرشاة اسنان', 'فرشاة أسنان',
        'shampoo', 'شامبو', 'perfume', 'عطر', 'deodorant', 'مزيل عرق', 'toothpaste', 'معجون',
        'soap', 'صابون', 'body wash', 'غسول', 'lotion', 'مرطب', 'razor', 'شفرة',
        'pantene', 'dove', 'nivea', 'colgate', 'oral-b', 'head & shoulders', 'sunsilk',
      ],
      'oil-cooking': [
        'oil', 'زيت', 'cooking', 'طبخ', 'olive', 'زيتون', 'sunflower', 'عباد الشمس',
        'corn', 'ذرة', 'ghee', 'سمن', 'canola', 'vegetable oil', 'coconut oil',
        'noor', 'afia', 'عافية', 'mazola',
      ],
      household: [
        'plate', 'صحن', 'pot', 'قدر', 'pan', 'مقلاة', 'detergent', 'منظف', 'منظفات',
        'tissue', 'مناديل', 'cleaner', 'مطهر', 'bleach', 'مبيض', 'trash bag', 'أكياس',
        'fairy', 'dettol', 'clorox', 'persil', 'برسيل', 'ariel', 'اريال', 'tide', 'تايد',
        'downy', 'داوني', 'omo', 'أومو', 'اومو', 'مسحوق غسيل', 'غسيل', 'washing',
        'laundry', 'كلوركس', 'ديتول', 'معطر', 'freshener', 'aluminium foil', 'قصدير',
        'cling film', 'garbage', 'sponge', 'إسفنج', 'مكنسة', 'broom', 'ممسحة',
        'dishwash', 'صحون', 'fabric softener', 'منعم',
      ],
      bakery: [
        'bread', 'خبز', 'toast', 'توست', 'cake', 'كيك', 'croissant', 'كرواسان',
        'muffin', 'bun', 'samoli', 'صامولي', 'pita', 'بيتا', 'معجنات', 'pastry',
        'دونات', 'donut', 'بقسماط', 'rusk', 'فطائر', 'باغيت', 'baguette',
        'خبز عربي', 'صمون', 'بان كيك', 'pancake', 'waffle', 'وافل',
      ],
      'canned-dry': [
        'canned', 'معلب', 'معلبات', 'beans', 'فول', 'tomato paste', 'معجون طماطم',
        'sardine', 'سردين', 'mushroom', 'فطر', 'jam', 'مربى', 'honey', 'عسل',
        'nutella', 'نوتيلا', 'peanut butter', 'زبدة فول سوداني', 'ketchup', 'كاتشب',
        'mayonnaise', 'مايونيز', 'tuna', 'تونة', 'خل', 'vinegar', 'صلصة', 'sauce',
        'rice', 'أرز', 'ارز', 'رز', 'basmati', 'بسمتي', 'flour', 'طحين', 'دقيق',
        'pasta', 'معكرونة', 'مكرونة', 'spaghetti', 'شعيرية', 'noodle', 'oats', 'شوفان',
        'cereal', 'كورن فليكس', 'عدس', 'lentil', 'حمص', 'chickpea', 'سكر', 'sugar',
        'ملح', 'salt', 'توابل', 'spice', 'بهارات', 'زيت', 'oil', 'زيتون', 'olive',
        'سمن', 'ghee', 'عافية', 'afia',
      ],
      electronics: [
        'phone', 'هاتف', 'tv', 'تلفاز', 'laptop', 'كمبيوتر', 'tablet', 'تابلت',
        'airpods', 'سماعة', 'charger', 'شاحن', 'samsung', 'apple', 'iphone',
        'headphone', 'speaker', 'bluetooth', 'powerbank',
      ],
    }

    return keywordMap[slug] || []
  }
}