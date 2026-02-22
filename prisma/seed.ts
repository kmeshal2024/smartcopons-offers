import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Create admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@smartcopons.com'
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeThisPassword123!'
  
  const passwordHash = await bcrypt.hash(adminPassword, 10)

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
    },
  })

  console.log('✅ Admin user created:', admin.email)

  // Create stores
  const stores = await Promise.all([
    prisma.store.upsert({
      where: { slug: 'noon' },
      update: {},
      create: {
        name: 'Noon',
        slug: 'noon',
        website: 'https://www.noon.com',
      },
    }),
    prisma.store.upsert({
      where: { slug: 'namshi' },
      update: {},
      create: {
        name: 'Namshi',
        slug: 'namshi',
        website: 'https://www.namshi.com',
      },
    }),
    prisma.store.upsert({
      where: { slug: 'amazon-sa' },
      update: {},
      create: {
        name: 'Amazon Saudi Arabia',
        slug: 'amazon-sa',
        website: 'https://www.amazon.sa',
      },
    }),
  ])

  console.log('✅ Created', stores.length, 'stores')

  // Create sample coupons
  const coupons = await Promise.all([
    prisma.coupon.create({
      data: {
        title: 'خصم 20% على جميع الأزياء',
        code: 'FASHION20',
        discountText: '20% OFF',
        url: 'https://www.noon.com',
        description: 'احصل على خصم 20% على جميع منتجات الأزياء',
        storeId: stores[0].id,
        isActive: true,
      },
    }),
    prisma.coupon.create({
      data: {
        title: 'شحن مجاني على جميع الطلبات',
        code: 'FREESHIP',
        discountText: 'Free Shipping',
        url: 'https://www.noon.com',
        description: 'شحن مجاني بدون حد أدنى للطلب',
        storeId: stores[0].id,
        isActive: true,
      },
    }),
    prisma.coupon.create({
      data: {
        title: 'خصم 15% على الملابس النسائية',
        code: 'WOMEN15',
        discountText: '15% OFF',
        url: 'https://www.namshi.com',
        description: 'خصم حصري على جميع الملابس النسائية',
        storeId: stores[1].id,
        isActive: true,
      },
    }),
    prisma.coupon.create({
      data: {
        title: 'خصم 100 ريال على أول طلب',
        code: 'FIRST100',
        discountText: '100 SAR OFF',
        url: 'https://www.namshi.com',
        description: 'خصم 100 ريال سعودي على طلبك الأول',
        storeId: stores[1].id,
        isActive: true,
      },
    }),
    prisma.coupon.create({
      data: {
        title: 'خصم 10% على الإلكترونيات',
        code: 'TECH10',
        discountText: '10% OFF',
        url: 'https://www.amazon.sa',
        description: 'وفر 10% على جميع الأجهزة الإلكترونية',
        storeId: stores[2].id,
        isActive: true,
      },
    }),
  ])

  console.log('✅ Created', coupons.length, 'coupons')

  // ============================================================================
  // PRODUCT CATEGORIES
  // ============================================================================
  const catDefs = [
    { nameAr: 'منتجات الألبان', nameEn: 'Dairy', slug: 'dairy', icon: '🥛', order: 1 },
    { nameAr: 'اللحوم والدواجن', nameEn: 'Meat & Poultry', slug: 'meat-poultry', icon: '🥩', order: 2 },
    { nameAr: 'الخضروات', nameEn: 'Vegetables', slug: 'vegetables', icon: '🥦', order: 3 },
    { nameAr: 'الفواكه', nameEn: 'Fruits', slug: 'fruits', icon: '🍎', order: 4 },
    { nameAr: 'المخبوزات', nameEn: 'Bakery', slug: 'bakery', icon: '🍞', order: 5 },
    { nameAr: 'المشروبات', nameEn: 'Beverages', slug: 'beverages', icon: '☕', order: 6 },
    { nameAr: 'الوجبات الخفيفة', nameEn: 'Snacks', slug: 'snacks', icon: '🍫', order: 7 },
    { nameAr: 'العناية الشخصية', nameEn: 'Personal Care', slug: 'personal-care', icon: '🧴', order: 8 },
    { nameAr: 'منتجات المنزل', nameEn: 'Household', slug: 'household', icon: '🧹', order: 9 },
    { nameAr: 'المعلبات والجاف', nameEn: 'Canned & Dry', slug: 'canned-dry', icon: '🥫', order: 10 },
  ]
  const cats: Record<string, any> = {}
  for (const def of catDefs) {
    cats[def.slug] = await prisma.category.upsert({
      where: { slug: def.slug },
      update: { nameAr: def.nameAr, nameEn: def.nameEn, icon: def.icon },
      create: { ...def, isActive: true },
    })
  }
  console.log('✅ Created', Object.keys(cats).length, 'categories')

  // ============================================================================
  // SUPERMARKETS
  // ============================================================================
  const smDefs = [
    { name: 'Carrefour', nameAr: 'كارفور', slug: 'carrefour', website: 'https://www.carrefourksa.com' },
    { name: 'Panda', nameAr: 'بنده', slug: 'panda', website: 'https://www.pandamart.com' },
    { name: 'Lulu Hypermarket', nameAr: 'لولو هايبرماركت', slug: 'lulu', website: 'https://www.luluhypermarket.com' },
    { name: 'Danube', nameAr: 'الدانوب', slug: 'danube', website: 'https://www.danubesupermarket.com' },
  ]
  const sms: Record<string, any> = {}
  for (const def of smDefs) {
    sms[def.slug] = await prisma.supermarket.upsert({
      where: { slug: def.slug },
      update: { name: def.name, nameAr: def.nameAr },
      create: { ...def, isActive: true },
    })
  }
  console.log('✅ Created', Object.keys(sms).length, 'supermarkets')

  // ============================================================================
  // FLYERS
  // ============================================================================
  const now = new Date()
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const flyerDefs = [
    { sm: 'carrefour', title: 'Carrefour Weekly Offers', titleAr: 'عروض كارفور الأسبوعية' },
    { sm: 'panda', title: 'Panda Best Deals', titleAr: 'أفضل عروض بنده' },
    { sm: 'lulu', title: 'LuLu Weekend Sale', titleAr: 'تخفيضات لولو نهاية الأسبوع' },
    { sm: 'danube', title: 'Danube Fresh Deals', titleAr: 'عروض الدانوب الطازجة' },
  ]
  const flyers: Record<string, any> = {}
  for (const def of flyerDefs) {
    const existing = await prisma.flyer.findFirst({ where: { supermarketId: sms[def.sm].id, title: def.title } })
    flyers[def.sm] = existing || await prisma.flyer.create({
      data: { supermarketId: sms[def.sm].id, title: def.title, titleAr: def.titleAr, startDate: now, endDate: nextMonth, status: 'ACTIVE', totalPages: 1 },
    })
  }
  console.log('✅ Created', Object.keys(flyers).length, 'flyers')

  // ============================================================================
  // SAMPLE PRODUCTS
  // ============================================================================
  await prisma.productOffer.deleteMany({})
  const prods = [
    { sm: 'carrefour', cat: 'dairy', nameAr: 'حليب الطازجة كامل الدسم', nameEn: 'Fresh Full Fat Milk', brand: 'الطازجة', price: 8.5, old: 12.0, disc: 29, size: '1 لتر', tags: 'dairy,milk' },
    { sm: 'carrefour', cat: 'meat-poultry', nameAr: 'دجاج مبرد طازج', nameEn: 'Fresh Chilled Chicken', brand: 'المزرعة', price: 25.0, old: 32.0, disc: 22, size: '1 كجم', tags: 'chicken,meat' },
    { sm: 'carrefour', cat: 'vegetables', nameAr: 'طماطم طازجة', nameEn: 'Fresh Tomatoes', brand: null, price: 4.5, old: 7.0, disc: 36, size: '1 كجم', tags: 'tomato,vegetables' },
    { sm: 'carrefour', cat: 'snacks', nameAr: 'شيبس ليز بالملح', nameEn: 'Lays Classic Chips', brand: 'Lays', price: 7.5, old: 10.0, disc: 25, size: '160 جم', tags: 'chips,snacks' },
    { sm: 'carrefour', cat: 'beverages', nameAr: 'عصير برتقال طبيعي', nameEn: 'Fresh Orange Juice', brand: 'تروبيكانا', price: 15.0, old: 20.0, disc: 25, size: '1 لتر', tags: 'juice,beverages' },
    { sm: 'panda', cat: 'dairy', nameAr: 'زبادي يوناني', nameEn: 'Greek Yogurt', brand: 'الماريكس', price: 12.0, old: 16.0, disc: 25, size: '500 جم', tags: 'yogurt,dairy' },
    { sm: 'panda', cat: 'bakery', nameAr: 'خبز توست أبيض', nameEn: 'White Toast Bread', brand: 'ساريو', price: 6.5, old: 9.0, disc: 28, size: '600 جم', tags: 'bread,bakery' },
    { sm: 'panda', cat: 'fruits', nameAr: 'موز طازج', nameEn: 'Fresh Banana', brand: null, price: 6.0, old: 9.0, disc: 33, size: '1 كجم', tags: 'banana,fruits' },
    { sm: 'panda', cat: 'beverages', nameAr: 'ماء معدني نيوفي', nameEn: 'Nuwafi Mineral Water', brand: 'نيوفي', price: 2.5, old: 4.0, disc: 38, size: '1.5 لتر', tags: 'water,beverages' },
    { sm: 'panda', cat: 'personal-care', nameAr: 'شامبو هيد شولدرز', nameEn: 'Head Shoulders Shampoo', brand: 'Head Shoulders', price: 22.0, old: 30.0, disc: 27, size: '400 مل', tags: 'shampoo,care' },
    { sm: 'lulu', cat: 'canned-dry', nameAr: 'أرز بسمتي ممتاز', nameEn: 'Premium Basmati Rice', brand: 'لولو', price: 35.0, old: 45.0, disc: 22, size: '5 كجم', tags: 'rice,basmati' },
    { sm: 'lulu', cat: 'meat-poultry', nameAr: 'لحم بقري مفروم طازج', nameEn: 'Fresh Ground Beef', brand: null, price: 45.0, old: 60.0, disc: 25, size: '500 جم', tags: 'beef,meat' },
    { sm: 'lulu', cat: 'household', nameAr: 'سائل غسيل الصحون فيري', nameEn: 'Fairy Dishwashing Liquid', brand: 'فيري', price: 18.0, old: 25.0, disc: 28, size: '750 مل', tags: 'dish,household' },
    { sm: 'lulu', cat: 'snacks', nameAr: 'شوكولاتة كيت كات', nameEn: 'KitKat Chocolate', brand: 'KitKat', price: 4.0, old: 6.0, disc: 33, size: '40 جم', tags: 'chocolate,snacks' },
    { sm: 'danube', cat: 'vegetables', nameAr: 'بطاطس مصرية', nameEn: 'Egyptian Potatoes', brand: null, price: 3.5, old: 6.0, disc: 42, size: '1 كجم', tags: 'potato,vegetables' },
    { sm: 'danube', cat: 'dairy', nameAr: 'جبنة شيدر كرافت', nameEn: 'Kraft Cheddar Cheese', brand: 'كرافت', price: 28.0, old: 38.0, disc: 26, size: '200 جم', tags: 'cheese,dairy' },
    { sm: 'danube', cat: 'canned-dry', nameAr: 'معكرونة باريلا سباغيتي', nameEn: 'Barilla Spaghetti', brand: 'باريلا', price: 9.5, old: 13.0, disc: 27, size: '500 جم', tags: 'pasta,spaghetti' },
    { sm: 'danube', cat: 'beverages', nameAr: 'قهوة نسكافيه كلاسيك', nameEn: 'Nescafe Classic Coffee', brand: 'نسكافيه', price: 32.0, old: 42.0, disc: 24, size: '200 جم', tags: 'coffee,nescafe' },
    { sm: 'danube', cat: 'fruits', nameAr: 'تفاح أحمر مستورد', nameEn: 'Imported Red Apple', brand: null, price: 12.0, old: 18.0, disc: 33, size: '1 كجم', tags: 'apple,fruits' },
    { sm: 'danube', cat: 'personal-care', nameAr: 'صابون دوف بالموسترة', nameEn: 'Dove Moisturizing Soap', brand: 'دوف', price: 9.0, old: 13.0, disc: 31, size: '4 قطع', tags: 'soap,dove' },
  ]
  for (const p of prods) {
    await prisma.productOffer.create({
      data: {
        flyerId: flyers[p.sm].id,
        supermarketId: sms[p.sm].id,
        categoryId: cats[p.cat]?.id || null,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        brand: p.brand || null,
        price: p.price,
        oldPrice: p.old,
        discountPercent: p.disc,
        sizeText: p.size,
        tags: p.tags,
        pageNumber: 1,
        confidence: 1.0,
        isHidden: false,
      },
    })
  }
  console.log('✅ Created', prods.length, 'sample products')

  console.log('🌱 Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
