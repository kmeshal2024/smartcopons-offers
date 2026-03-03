import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'

/**
 * Local image storage for budget hosting.
 *
 * Directory structure:
 *   public/uploads/
 *     flyers/      — PDF files
 *     products/    — Cropped product images
 *     logos/       — Supermarket logos
 *     covers/      — Flyer cover thumbnails
 *
 * Naming convention:
 *   products: {flyerId}-{index}.png
 *   covers:   {flyerId}-cover.jpg
 *   logos:    {supermarketSlug}.png
 *   flyers:  {flyerId}-{timestamp}.pdf
 */

const UPLOADS_ROOT = path.join(process.cwd(), 'public', 'uploads')

const DIRS = {
  flyers: path.join(UPLOADS_ROOT, 'flyers'),
  products: path.join(UPLOADS_ROOT, 'products'),
  logos: path.join(UPLOADS_ROOT, 'logos'),
  covers: path.join(UPLOADS_ROOT, 'covers'),
}

export async function ensureUploadDirs() {
  for (const dir of Object.values(DIRS)) {
    await fs.mkdir(dir, { recursive: true })
  }
}

export function getUploadPath(type: keyof typeof DIRS, filename: string): string {
  return path.join(DIRS[type], filename)
}

export function getPublicUrl(type: keyof typeof DIRS, filename: string): string {
  return `/uploads/${type}/${filename}`
}

/**
 * Delete all product images associated with a flyer.
 * Called when re-extracting or deleting a flyer.
 */
export async function cleanupFlyerImages(flyerId: string): Promise<number> {
  const productsDir = DIRS.products
  if (!existsSync(productsDir)) return 0

  const files = await fs.readdir(productsDir)
  const flyerFiles = files.filter(f => f.startsWith(flyerId))

  let deleted = 0
  for (const file of flyerFiles) {
    try {
      await fs.unlink(path.join(productsDir, file))
      deleted++
    } catch {
      // Ignore missing files
    }
  }

  return deleted
}

/**
 * Delete expired flyer assets (PDFs and images).
 * Run periodically to reclaim disk space on shared hosting.
 */
export async function cleanupExpiredAssets(expiredFlyerIds: string[]): Promise<{ pdfs: number; images: number }> {
  let pdfs = 0
  let images = 0

  for (const flyerId of expiredFlyerIds) {
    // Clean product images
    images += await cleanupFlyerImages(flyerId)

    // Clean PDF
    const flyersDir = DIRS.flyers
    if (existsSync(flyersDir)) {
      const files = await fs.readdir(flyersDir)
      const pdfFiles = files.filter(f => f.startsWith(flyerId))
      for (const file of pdfFiles) {
        try {
          await fs.unlink(path.join(flyersDir, file))
          pdfs++
        } catch { /* ignore */ }
      }
    }

    // Clean cover
    const coversDir = DIRS.covers
    if (existsSync(coversDir)) {
      const coverFile = `${flyerId}-cover.jpg`
      try {
        await fs.unlink(path.join(coversDir, coverFile))
      } catch { /* ignore */ }
    }
  }

  return { pdfs, images }
}

/**
 * Get disk usage of uploads directory in MB.
 */
export async function getUploadsDiskUsage(): Promise<{ totalMB: number; breakdown: Record<string, number> }> {
  const breakdown: Record<string, number> = {}
  let total = 0

  for (const [type, dir] of Object.entries(DIRS)) {
    if (!existsSync(dir)) { breakdown[type] = 0; continue }
    const files = await fs.readdir(dir)
    let size = 0
    for (const file of files) {
      try {
        const stat = await fs.stat(path.join(dir, file))
        size += stat.size
      } catch { /* ignore */ }
    }
    breakdown[type] = Math.round((size / 1024 / 1024) * 100) / 100
    total += size
  }

  return {
    totalMB: Math.round((total / 1024 / 1024) * 100) / 100,
    breakdown,
  }
}
