/**
 * Pure product → category classification. No database, no I/O, so it can be run
 * over a catalogue dump offline; CategoryMapper wraps it with the slug → id
 * lookup.
 *
 * WHY THIS REPLACED THE SUBSTRING SCORER
 *
 * The previous mapper tested `name.includes(keyword)` and scored a hit by the
 * keyword's character length. Opening "منتجات الألبان" on the live site showed
 * what that does:
 *
 *   - Substrings inside unrelated words. "لبن" is inside "البندق" (hazelnut),
 *     "للبنات" (for girls), "البناء" and "البنفسجية", so Nutella, a toy truck
 *     set, a study desk and a sunscreen were all dairy. "ندى" is inside
 *     "هولندي", "nada" inside the tablet model number "Nadal2".
 *   - Ingredients read as the product. "بلسم … زبدة الشيا" (conditioner with shea
 *     butter), "لوشن بزبدة الكاكاو", "فطيرة بالجبن", "قراقيش بطعم الجبن" — each
 *     names something that is merely IN or ON the product.
 *   - Brands read as the product. "المراعي" was a dairy keyword, so Almarai
 *     juice, honey, hummus and olive oil were dairy.
 *   - Diacritics. "منعّم" carries a shadda, so the household keyword "منعم" never
 *     matched a fabric softener, and it fell through to dairy on "ندى الربيع".
 *
 * THE RULES NOW
 *
 *   1. Whole words only. A keyword matches a token, or a token minus an Arabic
 *      clitic (ال، و، ب، ل، لل، بال), never the inside of a word.
 *   2. Arabic puts the head noun first, so earlier matches count for more.
 *   3. A word introduced by "ب"/"بال"/"و" or a marker (بطعم، بنكهة، برائحة، مع،
 *      with) describes an attribute and is heavily discounted.
 *   4. Brand and adjective keywords are weak: they break ties, they do not
 *      decide.
 *   5. Phrases outrank the single words inside them ("زبدة الشيا" beats "زبدة").
 *   6. A word that says what KIND of thing this is ("شامبو", "عصير") outranks a
 *      word that names an ingredient or raw produce ("حليب", "برتقال").
 *   7. Every category competes, including ones the database does not have. An
 *      iPhone is scored as electronics and then filed nowhere, instead of being
 *      handed to fruits because "Apple" was the only word a LIVE category knew.
 */

const DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g

// Built with the constructor: the project's TS target predates the `u` flag in a
// regex literal.
const NON_WORD = new RegExp('[^\\p{L}\\p{N}]+', 'gu')

export function normalizeName(input: string): string {
  return input
    .toLowerCase()
    .replace(DIACRITICS, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    // Punctuation, brackets and hyphens all become separators.
    .replace(NON_WORD, ' ')
    .trim()
}

/**
 * Attached particles that make a word secondary — rule 3. "ب"/"بال" is "with";
 * "و" joins a second item or adjective to the thing already named, which is how
 * "سمك هامور كامل ومنظف" (whole and CLEANED) stopped being a detergent.
 */
const ATTRIBUTE_PREFIXES = ['بال', 'وال', 'ب', 'و']
/** Clitics that carry no meaning for classification — rule 1. */
const NEUTRAL_PREFIXES = ['لل', 'ال', 'ل']

const ATTRIBUTE_MARKERS = new Set(
  [
    'بطعم', 'طعم', 'بنكهه', 'نكهه', 'بنكهات', 'نكهات', 'برائحه', 'رائحه', 'بخلاصه', 'خلاصه',
    'بعطر', 'مع', 'محشو', 'محشوه', 'مغطي', 'مغطاه', 'غير', 'كامل', 'كامله',
    // Free-standing conjunctions, for names typed as "شوكولا و زبدة".
    'و', 'او',
    'with', 'and', 'in', 'flavour', 'flavor', 'flavoured', 'flavored', 'scent', 'scented',
    'filled',
  ].map(normalizeName)
)

interface Token {
  /** The word as written (normalised). */
  raw: string
  /** Candidate stems with an affix removed, and whether it marks an attribute. */
  stems: Array<{ stem: string; attribute: boolean }>
}

function tokenize(name: string): Token[] {
  return normalizeName(name)
    .split(' ')
    .filter(Boolean)
    .map(raw => {
      const stems: Token['stems'] = []
      // Latin tokens have no clitics, but they do have plurals: "Grapes",
      // "Lemons", "Tomatoes".
      if (/^[a-z]+$/.test(raw) && raw.length >= 5) {
        if (raw.endsWith('es')) stems.push({ stem: raw.slice(0, -2), attribute: false })
        if (raw.endsWith('s')) stems.push({ stem: raw.slice(0, -1), attribute: false })
      }
      if (/[\u0600-\u06FF]/.test(raw)) {
        for (const p of ATTRIBUTE_PREFIXES) {
          if (raw.startsWith(p) && raw.length - p.length >= 3) {
            stems.push({ stem: raw.slice(p.length), attribute: true })
          }
        }
        for (const p of NEUTRAL_PREFIXES) {
          if (raw.startsWith(p) && raw.length - p.length >= 3) {
            stems.push({ stem: raw.slice(p.length), attribute: false })
          }
        }
      }
      return { raw, stems }
    })
}

type Keyword = string | { k: string; weak: true }
const weak = (...ks: string[]): Keyword[] => ks.map(k => ({ k, weak: true as const }))

/**
 * How strongly a category's keywords say what KIND of product this is — rule 6.
 * Non-food type words are the strongest signal there is: nothing edible is
 * called "شامبو". Packaged-food words outrank raw produce, because produce names
 * double as flavours ("عصير برتقال" is a juice, "بطاطس شيبس" is a snack).
 */
const CATEGORY_WEIGHT: Record<string, number> = {
  'personal-care': 1.8,
  household: 1.8,
  'baby-care': 1.8,
  electronics: 1.8,
  frozen: 1.5,
  beverages: 1.4,
  snacks: 1.4,
  bakery: 1.4,
  'canned-dry': 1.4,
  'oil-cooking': 1.4,
  'rice-grains': 1.4,
  dairy: 1.4,
  'meat-poultry': 1.2,
  fruits: 1.0,
  vegetables: 1.0,
}

/**
 * What to do when the winning category has no row in the database — rule 7.
 *   a slug      → file it there instead
 *   'runner-up' → take the best category that does exist
 *   null        → file it nowhere
 */
const FALLBACK: Record<string, string | null> = {
  frozen: 'runner-up',
  'baby-care': 'personal-care',
  'oil-cooking': 'canned-dry',
  'rice-grains': 'canned-dry',
  electronics: null,
  'non-grocery': null,
}

// NOTE: keys must match the category SLUGS in the database exactly. The live DB
// currently has ten categories; frozen, baby-care, electronics, oil-cooking and
// rice-grains are not among them, and FALLBACK above says where those go.
const KEYWORDS: Record<string, Keyword[]> = {
  'rice-grains': [
    'rice', 'أرز', 'رز', 'grain', 'حبوب', 'basmati', 'بسمتي', 'flour', 'طحين', 'دقيق',
    'pasta', 'معكرونة', 'مكرونة', 'spaghetti', 'macaroni', 'noodle', 'oats', 'شوفان', 'cereal',
    'cornflakes', 'wheat', 'قمح', 'lentil', 'عدس', 'chickpea', 'حمص',
  ],
  dairy: [
    'milk', 'حليب', 'cheese', 'جبن', 'جبنة', 'أجبان', 'yogurt', 'yoghurt', 'زبادي', 'روب',
    'لبن', 'ألبان', 'لبنة', 'labneh', 'laban', 'قشطة', 'قيمر', 'زبدة', 'butter',
    'كريمة الطبخ', 'كريمة الخفق', 'كريمة حامضة', 'كريم طبخ', 'كريم الطبخ', 'كريمة طبخ',
    'cooking cream', 'whipping cream', 'sour cream', 'cream cheese', 'mozzarella',
    'موزاريلا', 'cheddar', 'شيدر', 'feta', 'فيتا', 'halloumi', 'حلوم', 'حلومي', 'kashkaval',
    'قشقوان', 'كفير', 'kefir', 'بيض', 'egg',
    // Also under `frozen`, which outweighs this when that category exists. The
    // live DB has no frozen category, and dairy is the honest second choice.
    'ice cream', 'آيس كريم', 'ايسكريم',
    // Brands: tie-breakers only. "المراعي عصير تفاح" is a juice.
    ...weak('nadec', 'نادك', 'almarai', 'المراعي', 'nada', 'ندى', 'kiri', 'كيري', 'puck', 'بوك',
      'philadelphia', 'lurpak', 'لورباك', 'الصافي', 'cream', 'كريمة'),
  ],
  beverages: [
    'juice', 'عصير', 'nectar', 'نكتار', 'water', 'ماء', 'مياه', 'cola', 'كولا', 'pepsi', 'بيبسي',
    'drink', 'مشروب', 'شراب', 'tea', 'شاي', 'coffee', 'قهوة', 'nescafe', 'نسكافيه', 'lipton',
    'ليبتون', 'sprite', 'fanta', 'mirinda', 'ميرندا', 'vimto', 'فيمتو', 'tang', 'soda', 'صودا',
    'مشروب طاقة', 'energy drink', 'redbull', 'red bull', 'كابتشينو', 'cappuccino',
  ],
  snacks: [
    'chips', 'شيبس', 'chocolate', 'شوكولاتة', 'شوكولاته', 'شوكولا', 'candy', 'حلوى', 'حلاوة',
    'biscuit', 'بسكويت', 'cookie', 'كوكيز', 'nuts', 'مكسرات', 'wafer', 'ويفر',
    'kit kat', 'kitkat', 'كيت كات', 'oreo', 'اوريو', 'pringles', 'برينجلز', 'lays', 'doritos',
    'twix', 'snickers', 'cadbury', 'كادبوري', 'milk chocolate', 'شوكولاتة الحليب',
    'شوكولاتة بالحليب', 'رقائق', 'popcorn', 'فشار', 'pretzel', 'cracker', 'كراكرز', 'قراقيش',
    'منتفخات', 'علكة', 'gum',
    // Spreads that are not butter, whatever the first word says.
    'كريمة البندق', 'hazelnut spread', 'nutella', 'نوتيلا', 'نيوتيلا',
    // Also a Samsung phone line and a rice brand.
    ...weak('galaxy', 'جالكسي'),
  ],
  'meat-poultry': [
    'chicken', 'دجاج', 'دجاجة', 'meat', 'لحم', 'لحوم', 'beef', 'بقري', 'lamb', 'ضأن', 'خروف',
    'غنم', 'turkey', 'ديك رومي', 'fish', 'سمك', 'سمكة', 'أسماك', 'shrimp', 'روبيان', 'salmon',
    'سلمون', 'fillet', 'فيليه', 'steak', 'ستيك', 'sausage', 'نقانق', 'burger', 'برغر', 'برجر',
    'minced', 'مفروم', 'كبدة', 'شاورما', 'كفتة',
    // "طازج" describes milk, juice and bread as readily as meat.
    ...weak('fresh', 'طازج', 'طازجة'),
  ],
  fruits: [
    'apple', 'تفاح', 'banana', 'موز', 'fruit', 'فواكه', 'فاكهة', 'orange', 'برتقال',
    'grape', 'عنب', 'mango', 'مانجو', 'strawberry', 'فراولة', 'lemon', 'ليمون',
    'avocado', 'أفوكادو', 'watermelon', 'بطيخ', 'melon', 'شمام', 'peach', 'خوخ',
    'pear', 'كمثرى', 'إجاص', 'pineapple', 'أناناس', 'kiwi', 'كيوي', 'تمر', 'تمور', 'dates',
    'رمان', 'pomegranate', 'تين', 'مشمش', 'برقوق', 'جوافة', 'papaya',
  ],
  vegetables: [
    'tomato', 'طماطم', 'potato', 'بطاطس', 'بطاطا', 'onion', 'بصل',
    'vegetable', 'خضار', 'خضروات', 'cucumber', 'خيار', 'carrot', 'جزر',
    'lettuce', 'خس', 'pepper', 'فلفل', 'garlic', 'ثوم', 'ginger', 'زنجبيل',
    'zucchini', 'كوسة', 'eggplant', 'باذنجان', 'cabbage', 'ملفوف', 'كرنب',
    'cauliflower', 'قرنبيط', 'broccoli', 'بروكلي', 'spinach', 'سبانخ',
    'okra', 'بامية', 'بقدونس', 'parsley', 'كزبرة', 'نعناع', 'فجل', 'شمندر', 'كرفس',
  ],
  frozen: [
    'frozen', 'مجمد', 'مجمدة', 'ice cream', 'آيس كريم', 'ايسكريم', 'بوظة', 'pizza', 'بيتزا',
    'nuggets', 'ناجتس', 'fries', 'بطاطس مقلية', 'baskin', 'magnum', 'cornetto', 'samosa',
    'سمبوسة', 'spring roll', 'popsicle',
  ],
  'baby-care': [
    // No infant-formula keywords here on purpose: with no baby category in the
    // database formula would be sent to personal-care, and it is milk.
    'diaper', 'حفاضات', 'حفائض', 'pampers', 'بامبرز', 'huggies', 'هجيز', 'wipes',
    'مناديل مبللة',
  ],
  'personal-care': [
    // Phrases first: they outscore the bare words they contain, which is how
    // "ماء عطر" stops being read as water and "زبدة الشيا" as butter.
    'ماء عطر', 'ماء تواليت', 'eau de parfum', 'eau de toilette', 'ماء كولونيا', 'كولونيا',
    'زبدة الشيا', 'زبدة الكاكاو', 'shea butter', 'cocoa butter', 'body butter', 'زبدة الجسم',
    'hair cream', 'كريم شعر', 'كريم الشعر', 'كريم للشعر', 'face cream', 'hand cream',
    'body cream', 'كريم اليدين', 'كريم الجسم', 'كريم الوجه', 'كريم مرطب', 'واقي شمس',
    'واقي الشمس', 'sunscreen', 'مزيل عرق', 'مزيل العرق',
    // "معجون" alone is ambiguous — tomato paste is معجون طماطم.
    'معجون اسنان', 'معجون أسنان', 'معجون الأسنان', 'غسول فم', 'غسول الفم', 'فرشاة اسنان',
    'فرشاة أسنان', 'toothpaste', 'toothbrush', 'mouthwash',
    'shampoo', 'شامبو', 'conditioner', 'بلسم', 'perfume', 'عطر', 'deodorant', 'soap', 'صابون',
    'body wash', 'غسول', 'lotion', 'لوشن', 'مرطب', 'سيروم', 'serum', 'ماسك', 'صبغة', 'razor',
    'شفرة', 'شفرات', 'مكياج', 'makeup', 'أحمر شفاه', 'lipstick', 'مسكارا', 'mascara',
    'فوط صحية', 'vitamin', 'فيتامين', 'فيتامينات', 'مكمل غذائي', 'supplement',
    // Coffee comes in capsules and dishwasher detergent in tablets.
    ...weak('كبسولة', 'كبسولات', 'capsule', 'tablet', 'أقراص'),
    ...weak('pantene', 'بانتين', 'dove', 'دوف', 'nivea', 'نيفيا', 'colgate', 'كولجيت', 'oral-b',
      'sunsilk', 'garnier', 'غارنييه', 'جونسون', 'معجون', 'كريم'),
  ],
  'oil-cooking': [
    'sunflower', 'عباد الشمس', 'ghee', 'سمن', 'canola', 'vegetable oil', 'coconut oil',
    'زيت زيتون', 'زيت الزيتون', 'olive oil', 'زيت نباتي', 'زيت طبخ', 'زيت الطبخ', 'mazola',
  ],
  household: [
    'detergent', 'منظف', 'منظفات',
    'tissue', 'مناديل', 'cleaner', 'مطهر', 'bleach', 'مبيض', 'trash bag',
    'أكياس نفايات', 'أكياس قمامة', 'مسحوق غسيل', 'سائل غسيل', 'صابون غسيل', 'صابون صحون',
    'صابون سائل لغسل', 'شامبو عباية', 'شامبو العباية', 'شامبو العبايات', 'غسيل', 'laundry',
    'معطر', 'freshener', 'aluminium foil', 'قصدير', 'cling film', 'garbage', 'sponge',
    'إسفنج', 'إسفنجة', 'broom', 'ممسحة', 'dishwash', 'dishwashing', 'fabric softener',
    'softener', 'منعم', 'للأقمشة', 'مبيد', 'ورق حمام', 'ورق تواليت', 'ورق مطبخ', 'مكنسة',
    'غسالة صحون', 'غسالة الصحون', 'غسالة أطباق', 'غسالة الأطباق', 'لغسل الأطباق',
    // "خيار (صحن)" is cucumbers on a tray; "المقلاة الهوائية" is air-fryer chicken.
    ...weak('plate', 'صحن', 'صحون', 'قدر', 'مقلاة', 'أكياس', 'شمع', 'شموع', 'fairy', 'فيري',
      'dettol', 'ديتول', 'clorox', 'كلوركس', 'persil', 'برسيل', 'ariel', 'اريال', 'tide',
      'تايد', 'downy', 'داوني', 'comfort', 'كومفورت', 'omo', 'أومو'),
  ],
  bakery: [
    'bread', 'خبز', 'toast', 'توست', 'cake', 'كيك', 'كيكة', 'كعك', 'croissant', 'كرواسان',
    'كرواسون', 'muffin', 'مافن', 'bun', 'samoli', 'صامولي', 'pita', 'بيتا', 'معجنات', 'pastry',
    'دونات', 'donut', 'بقسماط', 'rusk', 'فطائر', 'فطيرة', 'باغيت', 'baguette',
    'خبز عربي', 'صمون', 'بان كيك', 'بانكيك', 'pancake', 'waffle', 'وافل', 'مادلين', 'تورتيلا',
  ],
  'canned-dry': [
    'canned', 'معلب', 'معلبة', 'معلبات', 'beans', 'فول', 'فاصوليا', 'tomato paste',
    'معجون طماطم', 'معجون الطماطم', 'sardine', 'سردين', 'mushroom', 'فطر', 'jam', 'مربى',
    'honey', 'عسل', 'peanut butter', 'زبدة فول سوداني', 'زبدة الفول السوداني',
    'زبدة فول السوداني', 'زبدة لوز', 'زبدة اللوز', 'almond butter', 'ketchup', 'كاتشب',
    'mayonnaise', 'مايونيز', 'tuna', 'تونة', 'تونا', 'خل', 'vinegar', 'صلصة', 'sauce',
    'dressing', 'rice', 'أرز', 'رز', 'basmati', 'بسمتي', 'flour', 'طحين', 'دقيق',
    'pasta', 'معكرونة', 'مكرونة', 'spaghetti', 'شعيرية', 'noodle', 'نودلز', 'ramen', 'رامين',
    'اندومي', 'زبدة سوداني',
    'oats', 'شوفان', 'cereal', 'كورن فليكس', 'عدس', 'lentil', 'حمص', 'chickpea', 'سكر',
    'sugar', 'ملح', 'salt', 'توابل', 'spice', 'بهارات', 'زيت', 'oil', 'زيتون', 'olive',
    'عافية', 'afia', 'طحينة', 'tahina', 'tahini', 'خليط كيك', 'خليط الكيك', 'cake mix',
    ...weak('خليط'),
  ],
  electronics: [
    'phone', 'هاتف', 'جوال', 'tv', 'تلفاز', 'تلفزيون', 'laptop', 'لابتوب', 'كمبيوتر',
    'تابلت', 'جهاز لوحي', 'airpods', 'سماعة', 'سماعات', 'charger', 'شاحن', 'samsung', 'iphone',
    'ايفون', 'أيفون', 'ipad', 'ايباد', 'أيباد', 'ايربودز', 'macbook', 'watch', 'headphone',
    'speaker', 'bluetooth', 'بلوتوث', 'powerbank', 'cable', 'كابل', 'usb', 'مكيف',
    'camera', 'كاميرا', 'ميكروفون', 'ميكروفونات', 'غسالة', 'ثلاجة', 'مكنسة كهربائية',
    'مكنسة لاسلكية', 'كواية',
    'dishwasher', 'playstation', 'بلايستيشن', 'نوت بوك', 'فيفو بوك', 'ميت بوك', 'ماك بوك',
    'جيجا', 'جيجابايت', 'واي فاي',
  ],
  // Things a supermarket sells that belong in none of the grocery categories.
  // Never a database slug: FALLBACK files these nowhere.
  'non-grocery': [
    'طعام قطط', 'طعام القطط', 'طعام كلاب', 'طعام الكلاب', 'مكافآت قطط', 'cat food', 'dog food',
    'لعبة', 'ألعاب', 'بلاستيك', 'بلاستيكية', 'بلاستيكي', 'plastic', 'دفتر', 'قلم', 'أقلام',
    'شنطة', 'حقيبة', 'gift card',
  ],
}

interface Compiled {
  slug: string
  tokens: string[]
  weak: boolean
}

const COMPILED: Compiled[] = Object.entries(KEYWORDS).flatMap(([slug, list]) =>
  list.map(entry => {
    const k = typeof entry === 'string' ? entry : entry.k
    return {
      slug,
      tokens: normalizeName(k).split(' ').filter(Boolean),
      weak: typeof entry !== 'string',
    }
  })
)

/** Does `token` match keyword word `word`? Returns the attribute flag, or null. */
function matchToken(token: Token, word: string): { attribute: boolean } | null {
  if (token.raw === word) return { attribute: false }
  // Stems are at least three letters (see tokenize), so "لبن" is never read as
  // "ل" + "بن" nor "بصل" as "ب" + "صل".
  for (const s of token.stems) if (s.stem === word) return { attribute: s.attribute }
  return null
}

export interface Classification {
  slug: string | null
  score: number
  /** The keyword that decided it — for dry-run reports and debugging. */
  matched: string | null
}

interface Hit {
  slug: string
  score: number
  start: number
  length: number
  matched: string
}

function collectHits(tokens: Token[]): { kept: Hit[]; every: Hit[] } {
  const hits: Hit[] = []
  for (const kw of COMPILED) {
    for (let i = 0; i + kw.tokens.length <= tokens.length; i++) {
      let attribute = false
      let ok = true
      for (let j = 0; j < kw.tokens.length; j++) {
        const m = matchToken(tokens[i + j], kw.tokens[j])
        if (!m) { ok = false; break }
        // Only the particle on the FIRST word says how the phrase relates to
        // the product; "زبدة الفول السوداني" has "ال" inside it and is not an
        // attribute.
        if (j === 0 && m.attribute) attribute = true
      }
      if (!ok) continue

      // Rule 3: a marker within the two words before the match.
      if (!attribute) {
        for (let b = Math.max(0, i - 2); b < i; b++) {
          if (ATTRIBUTE_MARKERS.has(tokens[b].raw)) { attribute = true; break }
        }
      }

      let score = 10 * kw.tokens.length            // rule 5
      score *= 1 + 1 / (1 + i)                     // rule 2
      score *= CATEGORY_WEIGHT[kw.slug] ?? 1       // rule 6
      if (kw.weak) score *= 0.3                    // rule 4
      if (attribute) score *= 0.3                  // rule 3

      hits.push({ slug: kw.slug, score, start: i, length: kw.tokens.length, matched: kw.tokens.join(' ') })
      break // the earliest occurrence of this keyword is the best one
    }
  }

  // Rule 5, second half: a word inside a longer matched phrase has already been
  // accounted for. Without this "بزبدة الفول السوداني" is discounted as an
  // attribute and then "الفول" scores in full on its own.
  const kept = hits.filter(
    h =>
      !hits.some(
        o => o.length > h.length && o.start <= h.start && o.start + o.length >= h.start + h.length
      )
  )
  return { kept, every: hits }
}

/**
 * Classify a product name. `available` lists the categories that exist; without
 * it every category in the table is a valid answer.
 */
export function classify(name: string, available?: Iterable<string>): Classification {
  const none: Classification = { slug: null, score: 0, matched: null }
  const tokens = tokenize(name || '')
  if (!tokens.length) return none

  const all = collectHits(tokens)
  const hits = all.kept.sort((a, b) => b.score - a.score)
  if (!hits.length) return none

  const top = hits[0]
  const result = (h: Hit, slug: string = h.slug): Classification => ({
    slug,
    score: h.score,
    matched: h.matched,
  })
  if (!available) return result(top)

  const allowed = new Set(available)
  if (allowed.has(top.slug)) return result(top)

  // Rule 7.
  const fallback = FALLBACK[top.slug] ?? null
  if (fallback === 'runner-up') {
    // Searched over every hit, including words inside the winning phrase:
    // "بطاطس مقلية" has no frozen aisle to go to, but "بطاطس" still says vegetables.
    const next = all.every.sort((a, b) => b.score - a.score).find(h => allowed.has(h.slug))
    return next ? result(next) : { ...none, matched: top.matched }
  }
  if (fallback && allowed.has(fallback)) return result(top, fallback)
  return { ...none, matched: top.matched }
}
