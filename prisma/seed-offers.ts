import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting enhanced seed with offers module...')

  // ============================================================================
  // 1. CREATE ADMIN USER
  // ============================================================================
  
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

  console.log('✅ Admin user:', admin.email)

  // ============================================================================
  // 2. CREATE CITIES
  // ============================================================================
  
  const cities = await Promise.all([
    prisma.city.upsert({
      where: { slug: 'riyadh' },
      update: {},
      create: {
        nameAr: 'الرياض',
        nameEn: 'Riyadh',
        slug: 'riyadh',
        region: 'Riyadh Region',
      },
    }),
    prisma.city.upsert({
      where: { slug: 'jeddah' },
      update: {},
      create: {
        nameAr: 'جدة',
        nameEn: 'Jeddah',
        slug: 'jeddah',
        region: 'Makkah Region',
      },
    }),
    prisma.city.upsert({
      where: { slug: 'dammam' },
      update: {},
      create: {
        nameAr: 'الدمام',
        nameEn: 'Dammam',
        slug: 'dammam',
        region: 'Eastern Region',
      },
    }),
  ])

  console.log('✅ Created', cities.length, 'cities')

  // ============================================================================
  // 3. CREATE CATEGORIES
  // ============================================================================
  
  // Main categories
  const foodCategory = await prisma.category.upsert({
    where: { slug: 'food-grocery' },
    update: {},
    create: {
      nameAr: 'مواد غذائية',
      nameEn: 'Food & Grocery',
      slug: 'food-grocery',
      icon: '🛒',
      order: 1,
    },
  })

  const electronicsCategory = await prisma.category.upsert({
    where: { slug: 'electronics' },
    update: {},
    create: {
      nameAr: 'إلكترونيات',
      nameEn: 'Electronics',
      slug: 'electronics',
      icon: '📱',
      order: 2,
    },
  })

  const homeCategory = await prisma.category.upsert({
    where: { slug: 'home-kitchen' },
    update: {},
    create: {
      nameAr: 'منزل ومطبخ',
      nameEn: 'Home & Kitchen',
      slug: 'home-kitchen',
      icon: '🏠',
      order: 3,
    },
  })

  // Sub-categories for Food
  const subcategories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'rice-grains' },
      update: {},
      create: {
        nameAr: 'أرز وحبوب',
        nameEn: 'Rice & Grains',
        slug: 'rice-grains',
        parentId: foodCategory.id,
        order: 1,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'dairy' },
      update: {},
      create: {
        nameAr: 'ألبان ومشتقاتها',
        nameEn: 'Dairy Products',
        slug: 'dairy',
        parentId: foodCategory.id,
        order: 2,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'beverages' },
      update: {},
      create: {
        nameAr: 'مشروبات',
        nameEn: 'Beverages',
        slug: 'beverages',
        parentId: foodCategory.id,
        order: 3,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'snacks' },
      update: {},
      create: {
        nameAr: 'وجبات خفيفة',
        nameEn: 'Snacks',
        slug: 'snacks',
        parentId: foodCategory.id,
        order: 4,
      },
    }),
  ])

  console.log('✅ Created', 3 + subcategories.length, 'categories')

  // ============================================================================
  // 4. CREATE SUPERMARKETS
  // ============================================================================
  
  const supermarkets = await Promise.all([
    prisma.supermarket.upsert({
      where: { slug: 'panda' },
      update: {},
      create: {
        name: 'Panda',
        nameAr: 'بندة',
        slug: 'panda',
        cityId: cities[0].id,
        isActive: true,
      },
    }),
    prisma.supermarket.upsert({
      where: { slug: 'danube' },
      update: {},
      create: {
        name: 'Danube',
        nameAr: 'الدانوب',
        slug: 'danube',
        cityId: cities[0].id,
        isActive: true,
      },
    }),
    prisma.supermarket.upsert({
      where: { slug: 'carrefour' },
      update: {},
      create: {
        name: 'Carrefour',
        nameAr: 'كارفور',
        slug: 'carrefour',
        cityId: cities[1].id,
        isActive: true,
      },
    }),
    prisma.supermarket.upsert({
      where: { slug: 'alothaim' },
      update: {},
      create: {
        name: 'Alothaim',
        nameAr: 'العثيم',
        slug: 'alothaim',
        cityId: cities[0].id,
        isActive: true,
      },
    }),
    prisma.supermarket.upsert({
      where: { slug: 'lulu' },
      update: {},
      create: {
        name: 'Lulu Hypermarket',
        nameAr: 'لولو هايبر ماركت',
        slug: 'lulu',
        cityId: cities[2].id,
        isActive: true,
      },
    }),
  ])

  console.log('✅ Created', supermarkets.length, 'supermarkets')

  // ============================================================================
  // 5. CREATE SAMPLE FLYERS
  // ============================================================================
  
  const today = new Date()
  const nextWeek = new Date()
  nextWeek.setDate(today.getDate() + 7)

  const flyers = await Promise.all([
    prisma.flyer.create({
      data: {
        title: 'Panda Weekly Offers',
        titleAr: 'عروض بندة الأسبوعية',
        supermarketId: supermarkets[0].id,
        cityId: cities[0].id,
        startDate: today,
        endDate: nextWeek,
        status: 'ACTIVE',
        totalPages: 8,
        coverImage: '/sample-flyers/panda-cover.jpg',
      },
    }),
    prisma.flyer.create({
      data: {
        title: 'Danube Fresh Deals',
        titleAr: 'عروض الدانوب الطازجة',
        supermarketId: supermarkets[1].id,
        cityId: cities[0].id,
        startDate: today,
        endDate: nextWeek,
        status: 'ACTIVE',
        totalPages: 12,
        coverImage: '/sample-flyers/danube-cover.jpg',
      },
    }),
  ])

  console.log('✅ Created', flyers.length, 'sample flyers')

  // ============================================================================
  // 6. CREATE SAMPLE PRODUCT OFFERS
  // ============================================================================
  
  const products = await Promise.all([
    // Panda products
    prisma.productOffer.create({
      data: {
        flyerId: flyers[0].id,
        supermarketId: supermarkets[0].id,
        categoryId: subcategories[0].id, // Rice
        nameAr: 'أرز بسمتي هندي',
        nameEn: 'Indian Basmati Rice',
        brand: 'Al Walimah',
        price: 32.95,
        oldPrice: 66.95,
        discountPercent: 51,
        sizeText: '5kg',
        pageNumber: 2,
        confidence: 0.85,
      },
    }),
    prisma.productOffer.create({
      data: {
        flyerId: flyers[0].id,
        supermarketId: supermarkets[0].id,
        categoryId: subcategories[1].id, // Dairy
        nameAr: 'حليب طازج',
        nameEn: 'Fresh Milk',
        brand: 'Almarai',
        price: 14.00,
        oldPrice: 18.00,
        discountPercent: 22,
        sizeText: '2L',
        pageNumber: 3,
        confidence: 0.92,
      },
    }),
    prisma.productOffer.create({
      data: {
        flyerId: flyers[0].id,
        supermarketId: supermarkets[0].id,
        categoryId: subcategories[2].id, // Beverages
        nameAr: 'عصير برتقال',
        nameEn: 'Orange Juice',
        brand: 'Rani',
        price: 8.95,
        oldPrice: 12.95,
        discountPercent: 31,
        sizeText: '1L',
        pageNumber: 4,
        confidence: 0.78,
      },
    }),
    // Danube products
    prisma.productOffer.create({
      data: {
        flyerId: flyers[1].id,
        supermarketId: supermarkets[1].id,
        categoryId: subcategories[3].id, // Snacks
        nameAr: 'شيبس',
        nameEn: 'Potato Chips',
        brand: 'Lays',
        price: 6.50,
        oldPrice: 9.95,
        discountPercent: 35,
        sizeText: 'Family Pack',
        pageNumber: 5,
        confidence: 0.88,
      },
    }),
    prisma.productOffer.create({
      data: {
        flyerId: flyers[1].id,
        supermarketId: supermarkets[1].id,
        categoryId: subcategories[0].id, // Rice
        nameAr: 'أرز مصري',
        nameEn: 'Egyptian Rice',
        brand: 'Sunwhite',
        price: 28.00,
        oldPrice: 45.00,
        discountPercent: 38,
        sizeText: '5kg',
        pageNumber: 2,
        confidence: 0.91,
      },
    }),
  ])

  console.log('✅ Created', products.length, 'sample product offers')

  // ============================================================================
  // 7. ONLINE STORES & COUPONS (Keep existing)
  // ============================================================================
  
  const stores = await Promise.all([
    prisma.store.upsert({
      where: { slug: 'noon' },
      update: {},
      create: { name: 'Noon', slug: 'noon', website: 'https://www.noon.com' },
    }),
    prisma.store.upsert({
      where: { slug: 'namshi' },
      update: {},
      create: { name: 'Namshi', slug: 'namshi', website: 'https://www.namshi.com' },
    }),
    prisma.store.upsert({
      where: { slug: 'amazon-sa' },
      update: {},
      create: { name: 'Amazon Saudi Arabia', slug: 'amazon-sa', website: 'https://www.amazon.sa' },
    }),
  ])

  const coupons = await Promise.all([
    prisma.coupon.create({
      data: {
        title: 'خصم 20% على جميع الأزياء',
        code: 'FASHION20',
        discountText: '20% OFF',
        url: 'https://www.noon.com',
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
        storeId: stores[0].id,
        isActive: true,
      },
    }),
  ])

  console.log('✅ Created', stores.length, 'stores and', coupons.length, 'coupons')

  // ============================================================================
  // SUMMARY
  // ============================================================================
  
  console.log('\n🎉 Enhanced seed completed successfully!\n')
  console.log('📊 Summary:')
  console.log(`   👤 Admin Users: 1`)
  console.log(`   🌆 Cities: ${cities.length}`)
  console.log(`   📂 Categories: ${3 + subcategories.length}`)
  console.log(`   🏪 Supermarkets: ${supermarkets.length}`)
  console.log(`   📄 Flyers: ${flyers.length}`)
  console.log(`   🛍️  Product Offers: ${products.length}`)
  console.log(`   🏬 Online Stores: ${stores.length}`)
  console.log(`   🎫 Coupons: ${coupons.length}`)
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })