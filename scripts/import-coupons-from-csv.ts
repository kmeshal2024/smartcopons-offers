import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import csv from 'csv-parser'

const prisma = new PrismaClient()

interface CouponRow {
  Title: string
  'Coupon Code': string
  'Coupon Url': string
  Stores: string
  Categories: string
  Content: string
}

async function importCouponsFromCSV() {
  console.log('Starting CSV import...')

  const csvPath = path.join(__dirname, '../data/smartcopons_coupon_codes.csv')
  
  if (!fs.existsSync(csvPath)) {
    console.error('CSV file not found at:', csvPath)
    console.log('Please place smartcopons_coupon_codes.csv in the /data folder')
    return
  }

  const results: CouponRow[] = []

  await new Promise((resolve, reject) => {
    fs.createReadStream(csvPath, { encoding: 'utf-8' })
      .pipe(csv())
      .on('data', (data: any) => results.push(data))
      .on('end', resolve)
      .on('error', reject)
  })

  console.log(`Found ${results.length} coupons in CSV`)

  let imported = 0
  let skipped = 0

  for (const row of results) {
    try {
      if (!row.Title || !row['Coupon Code']) {
        skipped++
        continue
      }

      const storeName = row.Stores?.trim()
      if (!storeName) {
        skipped++
        continue
      }

      let store = await prisma.store.findFirst({
        where: { name: storeName },
      })

      if (!store) {
        const slug = storeName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
        
        store = await prisma.store.create({
          data: {
            name: storeName,
            slug,
          },
        })
        console.log(`  Created store: ${storeName}`)
      }

      const discountMatch = row.Title.match(/(\d+)%/i)
      const discountText = discountMatch ? `${discountMatch[1]}% OFF` : 'Discount'

      const description = row.Content
        ? row.Content.replace(/<[^>]*>/g, '').substring(0, 500)
        : null

      await prisma.coupon.create({
        data: {
          title: row.Title,
          code: row['Coupon Code'],
          discountText,
          url: row['Coupon Url'] || '#',
          description,
          storeId: store.id,
          isActive: true,
        },
      })

      imported++

      if (imported % 10 === 0) {
        console.log(`  Imported ${imported} coupons...`)
      }
    } catch (error) {
      console.error(`  Error importing coupon: ${row.Title}`)
      skipped++
    }
  }

  console.log(`Import complete!`)
  console.log(`  Imported: ${imported} coupons`)
  console.log(`  Skipped: ${skipped} coupons`)
}

importCouponsFromCSV()
  .catch((e) => {
    console.error('Import failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })