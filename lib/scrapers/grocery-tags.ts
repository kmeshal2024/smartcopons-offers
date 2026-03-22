/**
 * Maps English grocery keywords to Arabic tags.
 * Used during scraping to add Arabic searchability to English-only products.
 */
const GROCERY_TAG_RULES: Array<{ match: RegExp; tags: string[] }> = [
  { match: /milk|laban/i, tags: ['حليب', 'لبن', 'البان'] },
  { match: /yogurt|yoghurt/i, tags: ['زبادي', 'لبن'] },
  { match: /cheese|kashkawan/i, tags: ['جبن', 'اجبان'] },
  { match: /butter|margarine/i, tags: ['زبدة'] },
  { match: /cream/i, tags: ['كريم', 'كريمة'] },
  { match: /egg/i, tags: ['بيض'] },
  { match: /chicken/i, tags: ['دجاج', 'فراخ'] },
  { match: /beef|veal/i, tags: ['لحم', 'لحم بقر'] },
  { match: /lamb|mutton/i, tags: ['لحم', 'لحم غنم'] },
  { match: /meat/i, tags: ['لحم', 'لحوم'] },
  { match: /fish|tuna|salmon|shrimp|seafood/i, tags: ['سمك', 'أسماك', 'مأكولات بحرية'] },
  { match: /rice/i, tags: ['أرز', 'رز'] },
  { match: /bread/i, tags: ['خبز'] },
  { match: /flour/i, tags: ['طحين', 'دقيق'] },
  { match: /pasta|macaroni|spaghetti|noodle/i, tags: ['معكرونة', 'مكرونة'] },
  { match: /oil/i, tags: ['زيت'] },
  { match: /olive/i, tags: ['زيتون'] },
  { match: /sugar/i, tags: ['سكر'] },
  { match: /salt/i, tags: ['ملح'] },
  { match: /honey/i, tags: ['عسل'] },
  { match: /jam/i, tags: ['مربى'] },
  { match: /tea\b/i, tags: ['شاي'] },
  { match: /coffee/i, tags: ['قهوة'] },
  { match: /juice/i, tags: ['عصير'] },
  { match: /water\b/i, tags: ['ماء', 'مياه'] },
  { match: /soft drink|soda|cola|pepsi|fanta|sprite/i, tags: ['مشروب', 'مشروبات غازية'] },
  { match: /biscuit|cookie/i, tags: ['بسكويت'] },
  { match: /chocolate/i, tags: ['شوكولاتة'] },
  { match: /chip|crisp/i, tags: ['شيبس', 'رقائق'] },
  { match: /cake/i, tags: ['كيك', 'كعك'] },
  { match: /cereal|corn flake|oat/i, tags: ['رقائق', 'حبوب'] },
  { match: /dates?\b/i, tags: ['تمر', 'تمور'] },
  { match: /nut|almond|cashew|pistachio|peanut/i, tags: ['مكسرات'] },
  { match: /tomato/i, tags: ['طماطم'] },
  { match: /potato|fries/i, tags: ['بطاطس'] },
  { match: /onion/i, tags: ['بصل'] },
  { match: /garlic/i, tags: ['ثوم'] },
  { match: /fruit/i, tags: ['فواكه'] },
  { match: /vegetable/i, tags: ['خضار', 'خضروات'] },
  { match: /frozen/i, tags: ['مجمد', 'مجمدات'] },
  { match: /canned|tinned/i, tags: ['معلبات'] },
  { match: /sauce|ketchup/i, tags: ['صلصة'] },
  { match: /vinegar/i, tags: ['خل'] },
  { match: /ghee/i, tags: ['سمن'] },
  { match: /hummus|chickpea/i, tags: ['حمص'] },
  { match: /foul|fava|bean/i, tags: ['فول'] },
  { match: /lentil/i, tags: ['عدس'] },
  { match: /spice|cumin|pepper|turmeric/i, tags: ['بهارات', 'توابل'] },
  { match: /soap/i, tags: ['صابون'] },
  { match: /shampoo/i, tags: ['شامبو'] },
  { match: /detergent|cleaner|cleaning/i, tags: ['منظف', 'تنظيف'] },
  { match: /tissue|napkin/i, tags: ['مناديل'] },
  { match: /diaper|nappy/i, tags: ['حفاضات'] },
  { match: /laundry|wash/i, tags: ['غسيل'] },
  { match: /toothpaste/i, tags: ['معجون أسنان'] },
  { match: /ice cream/i, tags: ['مثلجات', 'ايس كريم'] },
  { match: /baby/i, tags: ['أطفال', 'طفل'] },
]

/**
 * Generate Arabic tags from an English product name + existing tags.
 * Returns comma-separated Arabic tags to append.
 */
export function generateArabicTags(name: string, existingTags?: string): string {
  const input = `${name} ${existingTags || ''}`.toLowerCase()
  const arabicTags: string[] = []

  for (const rule of GROCERY_TAG_RULES) {
    if (rule.match.test(input)) {
      arabicTags.push(...rule.tags)
    }
  }

  return [...new Set(arabicTags)].join(',')
}
