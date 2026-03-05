// Fetch products from Danube's Spree Commerce API and submit to SmartCopons
const API_URL = 'https://sa.smartcopons.com/api/admin/scrape-submit'
const SECRET = 'smartcopons-secret-2024-ksa'
const DANUBE_API = 'https://www.danube.sa/api/products'

async function fetchDanubePage(page) {
  const url = `${DANUBE_API}?page=${page}&per_page=50&q[s]=updated_at+desc`
  console.log(`Fetching page ${page}...`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return data.products || []
}

function transformProduct(p) {
  const price = parseFloat(p.price) || parseFloat(p.display_price?.replace(/[^\d.]/g, '')) || 0
  const oldPrice = parseFloat(p.original_price) || parseFloat(p.display_original_price?.replace(/[^\d.]/g, '')) || null

  // Get image URL — Spree Commerce stores images on master variant
  let imageUrl = null
  // Try master.images first (this is where Danube's Spree API puts them)
  if (p.master && p.master.images && p.master.images.length > 0) {
    const img = p.master.images[0]
    imageUrl = img.product_url || img.large_url || img.small_url || img.mini_url
  }
  // Fallback: top-level images array
  if (!imageUrl && p.images && p.images.length > 0) {
    const img = p.images[0]
    imageUrl = img.product_url || img.large_url || img.small_url || img.mini_url
  }
  // Ensure absolute URL
  if (imageUrl && !imageUrl.startsWith('http')) {
    imageUrl = 'https://www.danube.sa' + imageUrl
  }

  // Calculate discount
  let discountPercent = null
  if (oldPrice && oldPrice > price && price > 0) {
    discountPercent = Math.round(((oldPrice - price) / oldPrice) * 100)
  }

  return {
    nameEn: p.name_en || p.full_name_en || p.name || '',
    nameAr: p.name || '',
    price: price,
    oldPrice: oldPrice && oldPrice > price ? oldPrice : undefined,
    discountPercent: discountPercent,
    imageUrl: imageUrl,
    sourceUrl: `https://www.danube.sa/en/products/${p.slug || p.id}`,
  }
}

async function submitOffers(offers) {
  console.log(`Submitting ${offers.length} offers...`)
  const res = await fetch(`${API_URL}?secret=${SECRET}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      supermarketSlug: 'danube',
      offers: offers,
      sourceUrl: 'https://www.danube.sa/api/products',
    }),
  })
  const data = await res.json()
  console.log('Result:', JSON.stringify(data))
  return data
}

async function main() {
  const allProducts = []

  for (let page = 1; page <= 10; page++) {
    try {
      const products = await fetchDanubePage(page)
      if (products.length === 0) {
        console.log(`Page ${page}: empty, stopping`)
        break
      }
      console.log(`Page ${page}: ${products.length} products`)

      const transformed = products.map(transformProduct).filter(p => p.nameEn && p.price > 0)
      allProducts.push(...transformed)

      // Small delay to be nice
      await new Promise(r => setTimeout(r, 500))
    } catch (e) {
      console.log(`Page ${page} error: ${e.message}`)
      break
    }
  }

  console.log(`\nTotal products fetched: ${allProducts.length}`)

  if (allProducts.length > 0) {
    // Submit in batches of 50
    for (let i = 0; i < allProducts.length; i += 50) {
      const batch = allProducts.slice(i, i + 50)
      console.log(`\nBatch ${Math.floor(i/50)+1}: ${batch.length} products`)
      await submitOffers(batch)
      await new Promise(r => setTimeout(r, 500))
    }
  }
}

main().catch(e => console.error('Fatal:', e.message))
