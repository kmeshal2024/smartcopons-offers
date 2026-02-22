import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import sharp from 'sharp'
import { createWorker } from 'tesseract.js'

interface ProductBlock {
  text: string
  confidence: number
  bbox: { x: number; y: number; width: number; height: number }
  price?: number
  productName?: string
}

interface ExtractionResult {
  products: Array<{
    nameAr?: string
    nameEn?: string
    price: number
    oldPrice?: number
    discountPercent?: number
    sizeText?: string
    imageBuffer?: Buffer
    pageNumber: number
    bbox: string
    confidence: number
  }>
  totalPages: number
  extractedAt: Date
  logs: string[]
}

export class PDFExtractor {
  private logs: string[] = []

  private log(message: string) {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] ${message}`
    this.logs.push(logMessage)
    console.log(logMessage)
  }

  /**
   * Extract products from a PDF flyer
   */
  async extractProducts(pdfPath: string): Promise<ExtractionResult> {
    this.logs = []
    this.log(`Starting extraction for: ${pdfPath}`)

    if (!existsSync(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`)
    }

    try {
      // Step 1: Convert PDF to images
      const images = await this.convertPDFToImages(pdfPath)
      this.log(`Converted ${images.length} pages to images`)

      // Step 2: Extract products from each page
      const allProducts = []
      
      for (let i = 0; i < images.length; i++) {
        this.log(`Processing page ${i + 1}...`)
        const pageProducts = await this.extractProductsFromPage(
          images[i],
          i + 1
        )
        allProducts.push(...pageProducts)
        this.log(`Found ${pageProducts.length} products on page ${i + 1}`)
      }

      this.log(`Total products extracted: ${allProducts.length}`)

      return {
        products: allProducts,
        totalPages: images.length,
        extractedAt: new Date(),
        logs: this.logs,
      }
    } catch (error) {
      this.log(`ERROR: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }

  /**
   * Convert PDF pages to PNG images
   */
  private async convertPDFToImages(pdfPath: string): Promise<string[]> {
    const outputDir = path.join(process.cwd(), 'temp', 'pdf-images')
    await fs.mkdir(outputDir, { recursive: true })

    // Use pdf-poppler to convert (requires poppler installed)
    const { convert } = await import('pdf-poppler')
    
    const options = {
      format: 'png',
      out_dir: outputDir,
      out_prefix: path.basename(pdfPath, '.pdf'),
      page: null, // all pages
    }

    try {
      await convert(pdfPath, options)
    } catch (error) {
      this.log('PDF conversion failed - trying alternative method')
      // Fallback: create placeholder images for testing
      return await this.createPlaceholderImages(1)
    }

    // Get generated image files
    const files = await fs.readdir(outputDir)
    const imageFiles = files
      .filter((f) => f.endsWith('.png'))
      .sort()
      .map((f) => path.join(outputDir, f))

    return imageFiles
  }

  /**
   * Extract products from a single page image
   */
  private async extractProductsFromPage(
    imagePath: string,
    pageNumber: number
  ): Promise<ExtractionResult['products']> {
    // Read image
    const imageBuffer = await fs.readFile(imagePath)
    const image = sharp(imageBuffer)
    const metadata = await image.metadata()

    // Perform OCR
    const ocrResult = await this.performOCR(imagePath)

    // Detect product blocks
    const products = this.detectProductBlocks(
      ocrResult,
      metadata.width || 0,
      metadata.height || 0,
      pageNumber,
      imageBuffer
    )

    return products
  }

  /**
   * Perform OCR on image
   */
  private async performOCR(imagePath: string) {
    const worker = await createWorker(['eng', 'ara'])
    
    try {
      const { data } = await worker.recognize(imagePath)
      await worker.terminate()
      return data
    } catch (error) {
      this.log(`OCR failed: ${error}`)
      return { words: [], text: '' }
    }
  }

  /**
   * Detect product blocks from OCR results
   */
  private detectProductBlocks(
    ocrData: any,
    imageWidth: number,
    imageHeight: number,
    pageNumber: number,
    imageBuffer: Buffer
  ): ExtractionResult['products'] {
    const products: ExtractionResult['products'] = []
    const words = ocrData.words || []

    // Find price patterns
    const priceRegex = /(\d+)[.,](\d+)|(\d+)\s*(ر\.س|SAR|SR|riyal)/gi
    const discountRegex = /(\d+)%/

    let currentProduct: any = null
    let productTexts: string[] = []

    for (let i = 0; i < words.length; i++) {
      const word = words[i]
      const text = word.text

      // Check if this is a price
      const priceMatch = text.match(priceRegex)
      
      if (priceMatch) {
        // Extract price value
        const priceText = text.replace(/[^\d.,]/g, '')
        const price = parseFloat(priceText.replace(',', '.'))

        if (price > 0 && price < 10000) {
          // Valid price found - create product
          const bbox = word.bbox || { x0: 0, y0: 0, x1: 100, y1: 100 }

          // Look for product name in previous words
          const nameWords = words
            .slice(Math.max(0, i - 10), i)
            .filter((w: any) => !w.text.match(priceRegex))
            .map((w: any) => w.text)
            .join(' ')

          // Look for discount percentage
          const discountMatch = productTexts.join(' ').match(discountRegex)
          const discountPercent = discountMatch
            ? parseInt(discountMatch[1])
            : undefined

          // Calculate old price if discount exists
          const oldPrice = discountPercent
            ? Math.round((price / (1 - discountPercent / 100)) * 100) / 100
            : undefined

          products.push({
            nameAr: this.isArabic(nameWords) ? nameWords : undefined,
            nameEn: !this.isArabic(nameWords) ? nameWords : undefined,
            price,
            oldPrice,
            discountPercent,
            sizeText: this.extractSize(productTexts.join(' ')),
            imageBuffer,
            pageNumber,
            bbox: JSON.stringify({
              x: bbox.x0,
              y: bbox.y0,
              width: bbox.x1 - bbox.x0,
              height: bbox.y1 - bbox.y0,
            }),
            confidence: word.confidence || 0.5,
          })

          productTexts = []
        }
      } else {
        productTexts.push(text)
      }
    }

    return products
  }

  /**
   * Check if text is Arabic
   */
  private isArabic(text: string): boolean {
    const arabicRegex = /[\u0600-\u06FF]/
    return arabicRegex.test(text)
  }

  /**
   * Extract size information from text
   */
  private extractSize(text: string): string | undefined {
    const sizeRegex = /(\d+)\s*(kg|g|ml|l|ltr|litre|pack)/i
    const match = text.match(sizeRegex)
    return match ? match[0] : undefined
  }

  /**
   * Crop product image from page
   */
  async cropProductImage(
    imageBuffer: Buffer,
    bbox: { x: number; y: number; width: number; height: number }
  ): Promise<Buffer> {
    try {
      // Add padding
      const padding = 10
      const cropRegion = {
        left: Math.max(0, bbox.x - padding),
        top: Math.max(0, bbox.y - padding),
        width: bbox.width + padding * 2,
        height: bbox.height + padding * 2,
      }

      const cropped = await sharp(imageBuffer)
        .extract(cropRegion)
        .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer()

      return cropped
    } catch (error) {
      this.log(`Image crop failed: ${error}`)
      return imageBuffer
    }
  }

  /**
   * Create placeholder images for testing (when PDF conversion fails)
   */
  private async createPlaceholderImages(count: number): Promise<string[]> {
    const outputDir = path.join(process.cwd(), 'temp', 'pdf-images')
    await fs.mkdir(outputDir, { recursive: true })

    const images = []
    for (let i = 0; i < count; i++) {
      const imagePath = path.join(outputDir, `placeholder-${i + 1}.png`)
      
      // Create a simple placeholder image
      await sharp({
        create: {
          width: 800,
          height: 1000,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .png()
        .toFile(imagePath)

      images.push(imagePath)
    }

    return images
  }
}