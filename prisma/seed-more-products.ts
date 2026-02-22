import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Adding more products...')

  // Get existing supermarkets and categories
  const panda = await prisma.supermarket.findUnique({ where: { slug: 'panda' } })
  const danube = await prisma.supermarket.findUnique({ where: { slug: 'danube' } })
  const carrefour = await prisma.supermarket.findUnique({ where: { slug: 'carrefour' } })
  const alothaim = await prisma.supermarket.findUnique({ where: { slug: 'alothaim' } })
  const lulu = await prisma.supermarket.findUnique({ where: { slug: 'lulu' } })

  const riceCategory = await prisma.category.findUnique({ where: { slug: 'rice-grains' } })
  const dairyCategory = await prisma.category.findUnique({ where: { slug: 'dairy' } })
  const beveragesCategory = await prisma.category.findUnique({ where: { slug: 'beverages' } })
  const snacksCategory = await prisma.category.findUnique({ where: { slug: 'snacks' } })
  const foodCategory = await prisma.category.findUnique({ where: { slug: 'food-grocery' } })

  // Get flyers
  const pandaFlyer = await prisma.flyer.findFirst({ 
    where: { supermarketId: panda?.id } 
  })
  const danubeFlyer = await prisma.flyer.findFirst({ 
    where: { supermarketId: danube?.id } 
  })

  if (!panda || !pandaFlyer || !danubeFlyer) {
    console.log('❌ Required data not found. Run main seed first.')
    return
  }

  // Products to add
  const products = [
    // Panda Products
    {
      flyerId: pandaFlyer.id,
      supermarketId: panda.id,
      categoryId: riceCategory?.id,
      nameAr: 'أرز أبو كاس',
      nameEn: 'Abu Kass Rice',
      brand: 'Abu Kass',
      price: 45.95,
      oldPrice: 75.00,
      discountPercent: 39,
      sizeText: '10kg',
      pageNumber: 2,
    },
    {
      flyerId: pandaFlyer.id,
      supermarketId: panda.id,
      categoryId: dairyCategory?.id,
      nameAr: 'لبن المراعي',
      nameEn: 'Almarai Laban',
      brand: 'Almarai',
      price: 6.00,
      oldPrice: 8.50,
      discountPercent: 29,
      sizeText: '1L',
      pageNumber: 3,
    },
    {
      flyerId: pandaFlyer.id,
      supermarketId: panda.id,
      categoryId: dairyCategory?.id,
      nameAr: 'جبن كرافت شرائح',
      nameEn: 'Kraft Cheese Slices',
      brand: 'Kraft',
      price: 12.95,
      oldPrice: 18.95,
      discountPercent: 32,
      sizeText: '200g',
      pageNumber: 3,
    },
    {
      flyerId: pandaFlyer.id,
      supermarketId: panda.id,
      categoryId: beveragesCategory?.id,
      nameAr: 'عصير المراعي مشكل',
      nameEn: 'Almarai Mixed Juice',
      brand: 'Almarai',
      price: 7.50,
      oldPrice: 10.95,
      discountPercent: 32,
      sizeText: '1L',
      pageNumber: 4,
    },
    {
      flyerId: pandaFlyer.id,
      supermarketId: panda.id,
      categoryId: beveragesCategory?.id,
      nameAr: 'كوكاكولا',
      nameEn: 'Coca-Cola',
      brand: 'Coca-Cola',
      price: 8.00,
      oldPrice: 12.00,
      discountPercent: 33,
      sizeText: '2.25L',
      pageNumber: 4,
    },
    {
      flyerId: pandaFlyer.id,
      supermarketId: panda.id,
      categoryId: snacksCategory?.id,
      nameAr: 'شوكولاتة كيت كات',
      nameEn: 'KitKat Chocolate',
      brand: 'KitKat',
      price: 3.95,
      oldPrice: 6.95,
      discountPercent: 43,
      sizeText: '4 Fingers',
      pageNumber: 5,
    },
    {
      flyerId: pandaFlyer.id,
      supermarketId: panda.id,
      categoryId: snacksCategory?.id,
      nameAr: 'بسكويت أوريو',
      nameEn: 'Oreo Biscuits',
      brand: 'Oreo',
      price: 5.95,
      oldPrice: 9.95,
      discountPercent: 40,
      sizeText: '228g',
      pageNumber: 5,
    },
    {
      flyerId: pandaFlyer.id,
      supermarketId: panda.id,
      categoryId: foodCategory?.id,
      nameAr: 'زيت العافية',
      nameEn: 'Al Afia Oil',
      brand: 'Al Afia',
      price: 23.95,
      oldPrice: 35.00,
      discountPercent: 32,
      sizeText: '1.8L',
      pageNumber: 6,
    },

    // Danube Products
    {
      flyerId: danubeFlyer.id,
      supermarketId: danube!.id,
      categoryId: riceCategory?.id,
      nameAr: 'أرز الوليمة سيلا',
      nameEn: 'Al Walimah Sella Rice',
      brand: 'Al Walimah',
      price: 29.95,
      oldPrice: 52.00,
      discountPercent: 42,
      sizeText: '5kg',
      pageNumber: 2,
    },
    {
      flyerId: danubeFlyer.id,
      supermarketId: danube!.id,
      categoryId: riceCategory?.id,
      nameAr: 'أرز هندي',
      nameEn: 'Indian Rice',
      brand: 'India Gate',
      price: 38.00,
      oldPrice: 65.00,
      discountPercent: 42,
      sizeText: '5kg',
      pageNumber: 2,
    },
    {
      flyerId: danubeFlyer.id,
      supermarketId: danube!.id,
      categoryId: dairyCategory?.id,
      nameAr: 'حليب نادك',
      nameEn: 'Nadec Milk',
      brand: 'Nadec',
      price: 13.50,
      oldPrice: 17.00,
      discountPercent: 21,
      sizeText: '2L',
      pageNumber: 3,
    },
    {
      flyerId: danubeFlyer.id,
      supermarketId: danube!.id,
      categoryId: dairyCategory?.id,
      nameAr: 'زبادي الصافي',
      nameEn: 'Al Safi Yogurt',
      brand: 'Al Safi',
      price: 4.95,
      oldPrice: 7.50,
      discountPercent: 34,
      sizeText: '170g',
      pageNumber: 3,
    },
    {
      flyerId: danubeFlyer.id,
      supermarketId: danube!.id,
      categoryId: beveragesCategory?.id,
     nameAr: 'ماء نستله',
      nameEn: 'Nestle Water',
      brand: 'Nestle',
      price: 5.00,
      oldPrice: 8.00,
      discountPercent: 38,
      sizeText: '1.5L x 6',
      pageNumber: 4,
    },
    {
      flyerId: danubeFlyer.id,
      supermarketId: danube!.id,
      categoryId: beveragesCategory?.id,
      nameAr: 'عصير ربيع',
      nameEn: 'Rabeea Juice',
      brand: 'Rabeea',
      price: 6.50,
      oldPrice: 9.95,
      discountPercent: 35,
      sizeText: '1L',
      pageNumber: 4,
    },
    {
      flyerId: danubeFlyer.id,
      supermarketId: danube!.id,
      categoryId: snacksCategory?.id,
      nameAr: 'شيبس ليز',
      nameEn: 'Lays Chips',
      brand: 'Lays',
      price: 5.50,
      oldPrice: 8.95,
      discountPercent: 39,
      sizeText: 'Large Pack',
      pageNumber: 5,
    },
    {
      flyerId: danubeFlyer.id,
      supermarketId: danube!.id,
      categoryId: snacksCategory?.id,
      nameAr: 'شوكولاتة سنيكرز',
      nameEn: 'Snickers Chocolate',
      brand: 'Snickers',
      price: 2.95,
      oldPrice: 4.95,
      discountPercent: 40,
      sizeText: '50g',
      pageNumber: 5,
    },
    {
      flyerId: danubeFlyer.id,
      supermarketId: danube!.id,
      categoryId: foodCategory?.id,
      nameAr: 'معكرونة باريلا',
      nameEn: 'Barilla Pasta',
      brand: 'Barilla',
      price: 7.95,
      oldPrice: 12.00,
      discountPercent: 34,
      sizeText: '500g',
      pageNumber: 6,
    },

    // More variety from other stores
    {
      flyerId: pandaFlyer.id,
      supermarketId: panda.id,
      categoryId: foodCategory?.id,
      nameAr: 'سكر',
      nameEn: 'Sugar',
      brand: 'Savola',
      price: 9.95,
      oldPrice: 14.95,
      discountPercent: 33,
      sizeText: '2kg',
      pageNumber: 7,
    },
    {
      flyerId: pandaFlyer.id,
      supermarketId: panda.id,
      categoryId: foodCategory?.id,
      nameAr: 'دقيق',
      nameEn: 'Flour',
      brand: 'Al-Arabi',
      price: 11.50,
      oldPrice: 16.00,
      discountPercent: 28,
      sizeText: '5kg',
      pageNumber: 7,
    },
    {
      flyerId: danubeFlyer.id,
      supermarketId: danube!.id,
      categoryId: foodCategory?.id,
      nameAr: 'صلصة طماطم',
      nameEn: 'Tomato Paste',
      brand: 'Prego',
      price: 4.50,
      oldPrice: 7.00,
      discountPercent: 36,
      sizeText: '400g',
      pageNumber: 8,
    },
    {
      flyerId: pandaFlyer.id,
      supermarketId: panda.id,
      categoryId: beveragesCategory?.id,
      nameAr: 'شاي ربيع',
      nameEn: 'Rabeea Tea',
      brand: 'Rabeea',
      price: 16.95,
      oldPrice: 24.00,
      discountPercent: 29,
      sizeText: '400g',
      pageNumber: 8,
    },
    {
      flyerId: danubeFlyer.id,
      supermarketId: danube!.id,
      categoryId: beveragesCategory?.id,
      nameAr: 'قهوة نسكافيه',
      nameEn: 'Nescafe Coffee',
      brand: 'Nescafe',
      price: 18.95,
      oldPrice: 27.00,
      discountPercent: 30,
      sizeText: '200g',
      pageNumber: 8,
    },
    {
      flyerId: pandaFlyer.id,
      supermarketId: panda.id,
      categoryId: snacksCategory?.id,
      nameAr: 'كورن فليكس',
      nameEn: 'Corn Flakes',
      brand: 'Kelloggs',
      price: 14.50,
      oldPrice: 21.00,
      discountPercent: 31,
      sizeText: '500g',
      pageNumber: 9,
    },
    {
      flyerId: danubeFlyer.id,
      supermarketId: danube!.id,
      categoryId: dairyCategory?.id,
      nameAr: 'زبدة المراعي',
      nameEn: 'Almarai Butter',
      brand: 'Almarai',
      price: 8.95,
      oldPrice: 12.50,
      discountPercent: 28,
      sizeText: '200g',
      pageNumber: 9,
    },
  ]

  // Insert products
  let count = 0
  for (const product of products) {
    try {
      await prisma.productOffer.create({ data: product })
      count++
    } catch (error) {
      console.error('Error creating product:', error)
    }
  }

  console.log(`✅ Added ${count} more products!`)
  console.log(`📊 Total products in database: ${await prisma.productOffer.count()}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })