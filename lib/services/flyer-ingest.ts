import { PrismaClient } from '@prisma/client'
import { PDFExtractor } from './pdf-extractor'
import { CategoryMapper } from './category-mapper'
import path from 'path'
import fs from 'fs/promises'

const prisma = new PrismaClient()

interface IngestOptions {
  flyerId: string
  pdfPath: string
  supermarketId: string
}

export class FlyerIngestService {
  private extractor: PDFExtractor
  private categoryMapper: CategoryMapper

  constructor() {
    this.extractor = new PDFExtractor()
    this.categoryMapper = new CategoryMapper()
  }

  /**
   * Ingest a flyer PDF and extract products
   */
  async ingestFlyer(options: IngestOptions) {
    console.log('🔄 Starting flyer ingestion...')

    // Initialize category mapper
    await this.categoryMapper.initialize()

    // Update flyer status to PROCESSING
    await prisma.flyer.update({
      where: { id: options.flyerId },
      data: { status: 'PROCESSING' },
    })

    try {
      // Extract products from PDF
      const result = await this.extractor.extractProducts(options.pdfPath)

      console.log(`📊 Extracted ${result.products.length} products`)

      // Save products to database
      let savedCount = 0

      for (const product of result.products) {
        try {
          // Map to category
          const categoryId = await this.categoryMapper.mapToCategory(
            product.nameAr || product.nameEn || ''
          )

          // Save product image if exists
          let imageUrl = null
          if (product.imageBuffer) {
            imageUrl = await this.saveProductImage(
              product.imageBuffer,
              options.flyerId,
              savedCount
            )
          }

          // Create product offer
          await prisma.productOffer.create({
            data: {
              flyerId: options.flyerId,
              supermarketId: options.supermarketId,
              categoryId,
              nameAr: product.nameAr,
              nameEn: product.nameEn,
              price: product.price,
              oldPrice: product.oldPrice,
              discountPercent: product.discountPercent,
              sizeText: product.sizeText,
              imageUrl,
              pageNumber: product.pageNumber,
              bbox: product.bbox,
              confidence: product.confidence,
            },
          })

          savedCount++
        } catch (error) {
          console.error('Error saving product:', error)
        }
      }

      // Update flyer status
      await prisma.flyer.update({
        where: { id: options.flyerId },
        data: {
          status: 'ACTIVE',
          totalPages: result.totalPages,
          extractedAt: result.extractedAt,
          extractionLog: result.logs.join('\n'),
        },
      })

      console.log(`✅ Ingestion complete: ${savedCount} products saved`)

      return {
        success: true,
        productsExtracted: result.products.length,
        productsSaved: savedCount,
        totalPages: result.totalPages,
      }
    } catch (error) {
      // Update flyer status to FAILED
      await prisma.flyer.update({
        where: { id: options.flyerId },
        data: {
          status: 'FAILED',
          extractionLog: error instanceof Error ? error.message : String(error),
        },
      })

      throw error
    }
  }

  /**
   * Save product image to disk
   */
  private async saveProductImage(
    imageBuffer: Buffer,
    flyerId: string,
    index: number
  ): Promise<string> {
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'products')
    await fs.mkdir(uploadsDir, { recursive: true })

    const filename = `${flyerId}-${index}.png`
    const filepath = path.join(uploadsDir, filename)

    await fs.writeFile(filepath, imageBuffer)

    return `/uploads/products/${filename}`
  }
}