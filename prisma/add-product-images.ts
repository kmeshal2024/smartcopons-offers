import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🖼️ Adding product images...')

  const products = await prisma.productOffer.findMany()

  for (const product of products) {
    // Generate placeholder image URL based on product name
    const imageUrl = `https://via.placeholder.com/300x300/ff69b4/ffffff?text=${encodeURIComponent(product.nameAr || product.nameEn || 'Product')}`

    await prisma.productOffer.update({
      where: { id: product.id },
      data: { imageUrl },
    })
  }

  console.log(`✅ Added images to ${products.length} products`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })