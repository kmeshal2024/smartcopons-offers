// One-time fix: Update existing Danube products with correct image URLs from API
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient({
  datasources: { db: { url: 'postgresql://neondb_owner:npg_7L4qtUlXmWaz@ep-crimson-hat-algvpgi2-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require' }}
})

async function main() {
  // Get all Danube products with no image
  const danube = await p.supermarket.findUnique({ where: { slug: 'danube' } })
  if (!danube) { console.log('Danube not found'); return }

  const noImage = await p.productOffer.count({
    where: { supermarketId: danube.id, imageUrl: null }
  })
  const withImage = await p.productOffer.count({
    where: { supermarketId: danube.id, NOT: { imageUrl: null } }
  })
  console.log(`Danube: ${noImage} without image, ${withImage} with image`)

  if (noImage === 0) {
    console.log('All Danube products already have images!')
    await p.$disconnect()
    return
  }

  // Fetch all products from Danube API and build a name->imageUrl map
  const imageMap = new Map()
  for (let page = 1; page <= 15; page++) {
    const res = await fetch(`https://www.danube.sa/api/products?page=${page}&per_page=50&q[s]=updated_at+desc`)
    const data = await res.json()
    const products = data.products || []
    if (products.length === 0) break

    for (const prod of products) {
      let imageUrl = null
      if (prod.master?.images?.length > 0) {
        const img = prod.master.images[0]
        imageUrl = img.product_url || img.large_url || img.small_url || img.mini_url
      }
      if (imageUrl) {
        // Map by Arabic name (which is what's stored in nameAr)
        imageMap.set(prod.name, imageUrl)
        if (prod.name_en) imageMap.set(prod.name_en, imageUrl)
      }
    }
    console.log(`  API page ${page}: ${products.length} products (map size: ${imageMap.size})`)
    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`\nImage map has ${imageMap.size} entries`)

  // Get all Danube products without images
  const productsToFix = await p.productOffer.findMany({
    where: { supermarketId: danube.id, imageUrl: null },
    select: { id: true, nameAr: true, nameEn: true }
  })

  let fixed = 0
  for (const prod of productsToFix) {
    const imageUrl = imageMap.get(prod.nameAr) || imageMap.get(prod.nameEn)
    if (imageUrl) {
      await p.productOffer.update({
        where: { id: prod.id },
        data: { imageUrl }
      })
      fixed++
    }
  }

  console.log(`\nFixed ${fixed} out of ${productsToFix.length} products`)
  await p.$disconnect()
}

main().catch(e => { console.error(e.message); process.exit(1) })
