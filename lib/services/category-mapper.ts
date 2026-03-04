import { prisma } from '@/lib/db'

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
      'fruits-vegetables': [
        'apple', 'تفاح', 'banana', 'موز', 'tomato', 'طماطم', 'potato', 'بطاطس',
        'onion', 'بصل', 'fruit', 'فواكه', 'vegetable', 'خضار', 'orange', 'برتقال',
        'grape', 'عنب', 'mango', 'مانجو', 'strawberry', 'فراولة', 'lemon', 'ليمون',
        'cucumber', 'خيار', 'carrot', 'جزر', 'lettuce', 'خس', 'pepper', 'فلفل',
        'garlic', 'ثوم', 'ginger', 'زنجبيل', 'avocado', 'أفوكادو',
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
        'shampoo', 'شامبو', 'perfume', 'عطر', 'deodorant', 'مزيل عرق', 'toothpaste', 'معجون',
        'soap', 'صابون', 'body wash', 'غسول', 'lotion', 'مرطب', 'razor', 'شفرة',
        'pantene', 'dove', 'nivea', 'colgate', 'oral-b', 'head & shoulders', 'sunsilk',
      ],
      'oil-cooking': [
        'oil', 'زيت', 'cooking', 'طبخ', 'olive', 'زيتون', 'sunflower', 'عباد الشمس',
        'corn', 'ذرة', 'ghee', 'سمن', 'canola', 'vegetable oil', 'coconut oil',
        'noor', 'afia', 'عافية', 'mazola',
      ],
      'home-kitchen': [
        'plate', 'صحن', 'pot', 'قدر', 'pan', 'مقلاة', 'detergent', 'منظف',
        'tissue', 'مناديل', 'cleaner', 'مطهر', 'bleach', 'مبيض', 'trash bag', 'أكياس',
        'fairy', 'dettol', 'clorox', 'persil', 'ariel', 'tide', 'downy',
        'aluminium foil', 'cling film', 'garbage', 'sponge',
      ],
      'bread-bakery': [
        'bread', 'خبز', 'toast', 'توست', 'cake', 'كيك', 'croissant', 'كرواسان',
        'muffin', 'bun', 'samoli', 'صامولي', 'pita', 'بيتا',
      ],
      'canned-goods': [
        'canned', 'معلب', 'beans', 'فول', 'tomato paste', 'معجون طماطم', 'sardine', 'سردين',
        'corn', 'ذرة', 'mushroom', 'فطر', 'jam', 'مربى', 'honey', 'عسل',
        'nutella', 'peanut butter', 'زبدة فول سوداني', 'ketchup', 'كاتشب', 'mayonnaise', 'مايونيز',
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