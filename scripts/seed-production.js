#!/usr/bin/env node
/**
 * Production seed script — runs with plain Node.js (no ts-node needed).
 *
 * Usage on Hostinger SSH:
 *   node scripts/seed-production.js
 *
 * Requires: @prisma/client, bcryptjs
 * Reads: DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD from .env or environment
 */

// Load .env file if it exists
const fs = require('fs')
const path = require('path')
const envPath = path.join(__dirname, '..', '.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex)
        let val = trimmed.slice(eqIndex + 1)
        // Remove surrounding quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1)
        }
        if (!process.env[key]) process.env[key] = val
      }
    }
  })
}

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('Starting production seed...\n')

  // ========== ADMIN USER ==========
  const email = process.env.ADMIN_EMAIL || 'admin@smartcopons.com'
  const password = process.env.ADMIN_PASSWORD || 'ChangeThisPassword123!'
  const hash = await bcrypt.hash(password, 10)

  const admin = await prisma.user.upsert({
    where: { email },
    update: { passwordHash: hash },
    create: { email, passwordHash: hash, role: 'ADMIN' },
  })
  console.log('[OK] Admin user:', admin.email)

  // ========== CITIES ==========
  const cityDefs = [
    { nameAr: 'الرياض', nameEn: 'Riyadh', slug: 'riyadh', region: 'Riyadh Region' },
    { nameAr: 'جدة', nameEn: 'Jeddah', slug: 'jeddah', region: 'Makkah Region' },
    { nameAr: 'الدمام', nameEn: 'Dammam', slug: 'dammam', region: 'Eastern Region' },
  ]
  for (const c of cityDefs) {
    await prisma.city.upsert({ where: { slug: c.slug }, update: {}, create: c })
  }
  console.log('[OK] Cities:', cityDefs.length)

  // ========== CATEGORIES ==========
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
  const cats = {}
  for (const c of catDefs) {
    cats[c.slug] = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { nameAr: c.nameAr, nameEn: c.nameEn, icon: c.icon },
      create: { ...c, isActive: true },
    })
  }
  console.log('[OK] Categories:', catDefs.length)

  // ========== SUPERMARKETS ==========
  const smDefs = [
    { name: 'Carrefour', nameAr: 'كارفور', slug: 'carrefour', website: 'https://www.carrefourksa.com' },
    { name: 'Panda', nameAr: 'بنده', slug: 'panda', website: 'https://www.pfrmt.com' },
    { name: 'Lulu Hypermarket', nameAr: 'لولو هايبرماركت', slug: 'lulu', website: 'https://www.luluhypermarket.com' },
    { name: 'Danube', nameAr: 'الدانوب', slug: 'danube', website: 'https://www.bindawood.com' },
    { name: 'Alothaim', nameAr: 'العثيم', slug: 'alothaim', website: 'https://www.othaimmarkets.com' },
  ]
  const sms = {}
  for (const s of smDefs) {
    sms[s.slug] = await prisma.supermarket.upsert({
      where: { slug: s.slug },
      update: { name: s.name, nameAr: s.nameAr },
      create: { ...s, isActive: true },
    })
  }
  console.log('[OK] Supermarkets:', smDefs.length)

  // ========== ONLINE STORES ==========
  const storeDefs = [
    { name: 'Noon', slug: 'noon', website: 'https://www.noon.com' },
    { name: 'Namshi', slug: 'namshi', website: 'https://www.namshi.com' },
    { name: 'Amazon Saudi Arabia', slug: 'amazon-sa', website: 'https://www.amazon.sa' },
  ]
  for (const s of storeDefs) {
    await prisma.store.upsert({ where: { slug: s.slug }, update: {}, create: s })
  }
  console.log('[OK] Online stores:', storeDefs.length)

  // ========== SAMPLE FLYERS ==========
  const now = new Date()
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const flyerDefs = [
    { sm: 'carrefour', title: 'Carrefour Weekly Offers', titleAr: 'عروض كارفور الأسبوعية' },
    { sm: 'panda', title: 'Panda Best Deals', titleAr: 'أفضل عروض بنده' },
    { sm: 'lulu', title: 'LuLu Weekend Sale', titleAr: 'تخفيضات لولو نهاية الأسبوع' },
    { sm: 'danube', title: 'Danube Fresh Deals', titleAr: 'عروض الدانوب الطازجة' },
  ]
  const flyers = {}
  for (const f of flyerDefs) {
    const existing = await prisma.flyer.findFirst({
      where: { supermarketId: sms[f.sm].id, title: f.title },
    })
    flyers[f.sm] = existing || await prisma.flyer.create({
      data: {
        supermarketId: sms[f.sm].id,
        title: f.title,
        titleAr: f.titleAr,
        startDate: now,
        endDate: nextMonth,
        status: 'ACTIVE',
        totalPages: 1,
      },
    })
  }
  console.log('[OK] Flyers:', Object.keys(flyers).length)

  // ========== SAMPLE PRODUCTS ==========
  const existingCount = await prisma.productOffer.count()
  if (existingCount === 0) {
    const prods = [
      { sm: 'carrefour', cat: 'dairy', nameAr: 'حليب الطازجة كامل الدسم', nameEn: 'Fresh Full Fat Milk', brand: 'الطازجة', price: 8.5, old: 12.0, disc: 29, size: '1 لتر' },
      { sm: 'carrefour', cat: 'vegetables', nameAr: 'طماطم طازجة', nameEn: 'Fresh Tomatoes', brand: null, price: 4.5, old: 7.0, disc: 36, size: '1 كجم' },
      { sm: 'carrefour', cat: 'snacks', nameAr: 'شيبس ليز بالملح', nameEn: 'Lays Classic Chips', brand: 'Lays', price: 7.5, old: 10.0, disc: 25, size: '160 جم' },
      { sm: 'carrefour', cat: 'beverages', nameAr: 'عصير برتقال طبيعي', nameEn: 'Fresh Orange Juice', brand: 'تروبيكانا', price: 15.0, old: 20.0, disc: 25, size: '1 لتر' },
      { sm: 'panda', cat: 'dairy', nameAr: 'زبادي يوناني', nameEn: 'Greek Yogurt', brand: 'الماريكس', price: 12.0, old: 16.0, disc: 25, size: '500 جم' },
      { sm: 'panda', cat: 'bakery', nameAr: 'خبز توست أبيض', nameEn: 'White Toast Bread', brand: 'ساريو', price: 6.5, old: 9.0, disc: 28, size: '600 جم' },
      { sm: 'panda', cat: 'personal-care', nameAr: 'شامبو هيد شولدرز', nameEn: 'Head Shoulders Shampoo', brand: 'Head Shoulders', price: 22.0, old: 30.0, disc: 27, size: '400 مل' },
      { sm: 'lulu', cat: 'canned-dry', nameAr: 'أرز بسمتي ممتاز', nameEn: 'Premium Basmati Rice', brand: 'لولو', price: 35.0, old: 45.0, disc: 22, size: '5 كجم' },
      { sm: 'lulu', cat: 'household', nameAr: 'سائل غسيل الصحون فيري', nameEn: 'Fairy Dishwashing Liquid', brand: 'فيري', price: 18.0, old: 25.0, disc: 28, size: '750 مل' },
      { sm: 'danube', cat: 'vegetables', nameAr: 'بطاطس مصرية', nameEn: 'Egyptian Potatoes', brand: null, price: 3.5, old: 6.0, disc: 42, size: '1 كجم' },
      { sm: 'danube', cat: 'dairy', nameAr: 'جبنة شيدر كرافت', nameEn: 'Kraft Cheddar Cheese', brand: 'كرافت', price: 28.0, old: 38.0, disc: 26, size: '200 جم' },
      { sm: 'danube', cat: 'beverages', nameAr: 'قهوة نسكافيه كلاسيك', nameEn: 'Nescafe Classic Coffee', brand: 'نسكافيه', price: 32.0, old: 42.0, disc: 24, size: '200 جم' },
    ]
    for (const p of prods) {
      await prisma.productOffer.create({
        data: {
          flyerId: flyers[p.sm].id,
          supermarketId: sms[p.sm].id,
          categoryId: cats[p.cat] ? cats[p.cat].id : null,
          nameAr: p.nameAr,
          nameEn: p.nameEn,
          brand: p.brand || null,
          price: p.price,
          oldPrice: p.old,
          discountPercent: p.disc,
          sizeText: p.size,
          pageNumber: 1,
          confidence: 1.0,
          isHidden: false,
        },
      })
    }
    console.log('[OK] Sample products:', prods.length)
  } else {
    console.log('[SKIP] Products already exist (' + existingCount + ')')
  }

  // ========== SAMPLE COUPONS ==========
  const couponCount = await prisma.coupon.count()
  if (couponCount === 0) {
    const stores = await prisma.store.findMany()
    const coupons = [
      { title: 'خصم 20% على جميع الأزياء', code: 'FASHION20', discountText: '20% OFF', url: 'https://www.noon.com', storeSlug: 'noon' },
      { title: 'شحن مجاني على جميع الطلبات', code: 'FREESHIP', discountText: 'Free Shipping', url: 'https://www.noon.com', storeSlug: 'noon' },
      { title: 'خصم 15% على الملابس النسائية', code: 'WOMEN15', discountText: '15% OFF', url: 'https://www.namshi.com', storeSlug: 'namshi' },
      { title: 'خصم 10% على الإلكترونيات', code: 'TECH10', discountText: '10% OFF', url: 'https://www.amazon.sa', storeSlug: 'amazon-sa' },
    ]
    for (const c of coupons) {
      const store = stores.find(s => s.slug === c.storeSlug)
      if (store) {
        await prisma.coupon.create({
          data: { title: c.title, code: c.code, discountText: c.discountText, url: c.url, storeId: store.id, isActive: true },
        })
      }
    }
    console.log('[OK] Sample coupons:', coupons.length)
  } else {
    console.log('[SKIP] Coupons already exist (' + couponCount + ')')
  }

  console.log('\nSeed completed successfully!')
}

main()
  .catch(e => { console.error('Seed error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
