# SmartCopons - Saudi Arabia Supermarket Offers Data Source Map

> Complete architecture for collecting 10,000+ supermarket offers/month with minimal scraping

---

## PHASE 1 — OFFER AGGREGATOR WEBSITES (PRIMARY SOURCES)

These sites already aggregate offers from dozens of Saudi supermarkets. They are the **highest-value targets** because one source gives you data from 15-40+ supermarkets.

### 1.1 ClicFlyer
- **URL:** https://clicflyer.com/shoppers/en/saudi-arabia/riyadh/home
- **Coverage:** 275+ retail stores across Saudi Arabia
- **Cities:** Riyadh, Jeddah, Madinah, Mecca, Dammam, Al Khobar, and more
- **Data type:** Interactive digital flyers with individual offer cards
- **Supermarkets covered:** Hyper Panda, Lulu, Carrefour, Al Othaim, Nesto, Tamimi, Farm, Danube, Grand Hyper, and many more
- **Data format:** Flyer images broken into clickable individual product offers
- **Volume:** 266,000+ new offers added per month (6M+ in repository)
- **Update frequency:** Daily
- **How data is served:** Their web app loads flyer data dynamically (likely JSON API behind their SPA). The mobile app (iOS/Android) also uses API calls.
- **Extraction approach:**
  - **BEST:** Intercept mobile app API calls (JSON structured data with product name, price, store, dates)
  - **GOOD:** Parse their web pages per retailer/city (semi-structured HTML with offer cards)
  - Each offer card typically contains: product image, product name, price, old price, validity dates, store name
- **Difficulty:** Medium (API interception) / Low-Medium (web parsing)
- **Estimated yield:** 5,000-8,000 offers/week for Saudi Arabia alone

### 1.2 D4D Online
- **URL:** https://d4donline.com/en/saudi-arabia/ (also sa.d4donline.com)
- **Coverage:** 30+ supermarket chains in Saudi Arabia
- **Cities:** Riyadh, Jeddah, Dammam, Al Khobar, Taif, Hail, Abha, Jubail, and more
- **Data type:** Flyer catalog images organized by store and city
- **Supermarkets covered:** Hyper Panda, Lulu, Othaim, Carrefour, Nesto, Danube, Farm, and others
- **Data format:** Flyer page images (JPG/PNG) with catalog metadata
- **Update frequency:** Weekly (when new flyers are published)
- **How data is served:** Web pages with flyer images; mobile app with offer browsing
- **Extraction approach:**
  - Parse catalog listing pages to get flyer images + metadata (store, dates, city)
  - OCR flyer images to extract product names and prices
  - Or use as a **flyer detection source** — know when new flyers drop, then fetch from official sources
- **Difficulty:** Low (image collection) / Medium (OCR for structured data)
- **Estimated yield:** 2,000-4,000 offers/week

### 1.3 KSA Price
- **URL:** https://ksaprice.com/en/deal/index
- **Coverage:** 20+ major Saudi supermarket chains
- **Cities:** Riyadh, Jeddah, Jubail, Makkah, Khobar, Dammam, Madina, Yanbu
- **Data type:** Structured offer listings with product images and prices
- **Supermarkets covered:** Panda, Lulu, Carrefour, Hyperpanda, Othaim, Danube, Farm, Nesto, and more
- **Data format:** HTML pages with structured offer cards (product image, name, price, vendor, location)
- **Has mobile app:** Yes (KSAPrice on Google Play)
- **Extraction approach:**
  - **BEST:** Parse their vendor-specific pages (e.g., `/deal/index/vendor/panda`) — already filtered and organized
  - Offers appear as structured cards with clear fields
  - Pagination support for browsing all offers
- **Difficulty:** Low-Medium (well-structured HTML)
- **Estimated yield:** 3,000-5,000 offers/week

### 1.4 Tsawq.net
- **URL:** https://www.tsawq.net/sa/en/home
- **Coverage:** 25+ Saudi supermarket chains
- **Data type:** Offer images/cards + video content of flyers
- **Supermarkets covered:** Carrefour, Al Othaim, Panda, Danube, Farm Superstores, Al Raya, Lulu, Tamimi, BinDawood, Nesto
- **Unique feature:** One-day offers section, video flyer walkthroughs
- **Data format:** Offer images with metadata; some video content
- **Extraction approach:**
  - Parse offer listing pages per store
  - Extract offer images and metadata
  - Video content less useful for structured data
- **Difficulty:** Low-Medium
- **Estimated yield:** 2,000-3,000 offers/week

### 1.5 OffersInMe (KSA)
- **URL:** https://ksa.offersinme.com/hypermarkets
- **Coverage:** 30+ hypermarkets and supermarkets
- **Data type:** Offer cards with images organized by store
- **Supermarkets covered:** Lulu, Carrefour, Nesto, Hyper Panda, Othaim, Ramez, Al Madina, Grand Mart, Spar, Danube, Farm, and many smaller chains
- **Data format:** Structured HTML offer pages per store
- **Also covers:** City-specific offers (Riyadh, Jeddah, etc.)
- **Extraction approach:**
  - Parse per-store pages for offer images and details
  - Well-organized URL structure makes crawling easy
- **Difficulty:** Low
- **Estimated yield:** 2,000-4,000 offers/week

### 1.6 GetCata (Cata!)
- **URL:** https://www.getcata.com/sa-en/category/supermarkets
- **Coverage:** 25+ Saudi supermarkets
- **Data type:** Digital catalog/flyer pages
- **Supermarkets covered:** Manuel, LuLu, Othaim, Nesto, Panda, Al Nokhba, BinDawood, Al Raya, Al Madina, Danube, and more
- **Data format:** Catalog page images with store metadata and validity dates
- **Extraction approach:**
  - Catalog page images are clean and well-organized
  - Good source for PDF/image flyers with OCR
- **Difficulty:** Low (image collection) / Medium (OCR)
- **Estimated yield:** 1,500-2,500 offers/week

### 1.7 DealzSaudi
- **URL:** https://www.dealzsaudi.com/en
- **Coverage:** 20+ Saudi retailers
- **Data type:** Catalogs, offers, branch information
- **Supermarkets covered:** Panda, Tamimi, Carrefour, Lulu, Farm, Al Othaim, Danube, Nesto, Al Nokhba
- **Unique value:** Also includes branch details and contact info
- **Extraction approach:** Parse catalog pages
- **Difficulty:** Low
- **Estimated yield:** 1,000-2,000 offers/week

### 1.8 WoWDeals
- **URL:** https://www.wowdeals.me/sa
- **Coverage:** Major KSA stores
- **Data type:** Deal listings
- **Difficulty:** Low
- **Estimated yield:** 500-1,000 offers/week

### 1.9 ClicoOffer
- **URL:** https://www.clicoffer.com/en/saudi-arabia/riyadh/offers/
- **Coverage:** Similar to ClicFlyer model
- **Data type:** Store-specific offer pages
- **Difficulty:** Low-Medium
- **Estimated yield:** 1,000-2,000 offers/week

---

## PHASE 2 — OFFICIAL SUPERMARKET SOURCES

### Major Saudi Supermarket Chains

| # | Chain | Stores | Website | Offers Page | E-commerce | Mobile App |
|---|-------|--------|---------|-------------|------------|------------|
| 1 | **Hyper Panda** | 180+ | panda.sa | Weekly flyers on site | Yes (panda.sa) | Panda KSA |
| 2 | **Carrefour KSA** | 30+ | carrefourksa.com | Promotions section | Yes (full e-commerce) | Carrefour KSA |
| 3 | **Lulu Hypermarket** | 25+ | gcc.luluhypermarket.com/en-sa | /deals/ and /pages/instore-promotions | Yes (full e-commerce) | LuLu Online |
| 4 | **Danube** | 24+ | danube.sa | Weekly offers | Yes (danube.sa) | Danube App |
| 5 | **Al Othaim** | 200+ | othaim.com | Weekly offers page | Yes | Othaim App |
| 6 | **Tamimi Markets** | 165+ | tamimimarkets.com | /Offers | Yes (shop.tamimimarkets.com) | Tamimi App |
| 7 | **BinDawood** | 24+ | bindawoodholding.com | Offers section | Yes | BinDawood App |
| 8 | **Farm Superstores** | 107+ | farm.com.sa | Weekly offers | Limited | Farm App |
| 9 | **Nesto** | 20+ | nesto.sa | Offers page | Limited | Nesto App |
| 10 | **Manuel Market** | 5+ | manuelmarket.com | Offers section | Limited | N/A |
| 11 | **Al Raya** | 20+ | alraya.com.sa | Offers | Limited | N/A |
| 12 | **Nana Direct** | N/A | nana.sa | Deals section | Yes (delivery) | Nana App |

### Where Their Offers Appear

#### Tier A: Full E-commerce Sites (Best for API extraction)
These chains have full online shopping platforms with product catalogs, prices, and promotions that are served via internal APIs:

1. **Carrefour KSA** (carrefourksa.com) — Full product catalog with search, categories, promotions. Their frontend loads product data from internal APIs (likely REST/GraphQL). Can intercept product listing and promotion endpoints.

2. **Lulu Hypermarket** (gcc.luluhypermarket.com/en-sa) — Full e-commerce with deals page. Product data loaded dynamically. Deals endpoint at `/en-sa/deals/`.

3. **Danube** (danube.sa) — Full e-commerce with online ordering. Product promotions served via API.

4. **Tamimi Markets** (shop.tamimimarkets.com) — Full e-commerce platform with offers section.

5. **Nana Direct** (nana.sa) — Grocery delivery platform with product catalog and deals.

#### Tier B: Weekly Flyer/Catalog Publishers
These chains publish weekly promotional flyers (images/PDFs):

1. **Hyper Panda** — Weekly flyer images on their site and through aggregators
2. **Al Othaim** — Weekly catalog through their site
3. **Farm Superstores** — Weekly offers through their site
4. **BinDawood** — Catalog-style offers
5. **Nesto** — Flyer-based promotions

#### Tier C: Limited Digital Presence
Smaller chains with basic offer pages:

1. **Manuel Market** — Basic weekly offers page
2. **Al Raya** — Basic offers section

---

## PHASE 3 — LOW-COMPLEXITY EXTRACTION STRATEGY

### Priority Order (from easiest to hardest)

```
PRIORITY 1: Aggregator Websites (ONE source = 15-40 stores)
    ↓
PRIORITY 2: E-commerce Product APIs (structured JSON data)
    ↓
PRIORITY 3: PDF/Image Flyers + OCR (visual data extraction)
    ↓
PRIORITY 4: Official Weekly Offer Pages (semi-structured HTML)
    ↓
PRIORITY 5: HTML Scraping (last resort, most fragile)
```

### Why This Order?

| Priority | Source Type | Pros | Cons |
|----------|-----------|------|------|
| 1 | Aggregators | One integration = many stores; data already organized | May not have every small store |
| 2 | E-commerce APIs | Structured JSON; reliable; real-time | Per-store integration needed |
| 3 | PDF/Image Flyers | Official data; high accuracy | Requires OCR; layout varies |
| 4 | Official Offer Pages | Authoritative data | Format varies per store; changes break parsers |
| 5 | HTML Scraping | Can get any visible data | Fragile; maintenance-heavy; rate limiting |

### Recommended Implementation Order

**Week 1-2: Aggregator Integration (covers 80% of offers)**
- Integrate ClicFlyer (5,000-8,000 offers/week)
- Integrate KSA Price (3,000-5,000 offers/week)
- Integrate OffersInMe (2,000-4,000 offers/week)

**Week 3-4: E-commerce API Integration (structured data)**
- Reverse-engineer Carrefour KSA product/promotion API
- Reverse-engineer Lulu KSA deals API
- Reverse-engineer Danube product API

**Week 5-6: Flyer/Catalog Sources**
- GetCata catalog images + OCR pipeline
- D4D Online flyer images + OCR
- Direct PDF flyer downloads from supermarket sites

**Week 7-8: Gap-filling**
- Official offer pages for stores not covered by aggregators
- HTML parsing for remaining sources

---

## PHASE 4 — DATA PIPELINE DESIGN

### Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   SOURCE LAYER                       │
├──────────┬──────────┬──────────┬────────────────────┤
│Aggregator│E-commerce│  Flyer   │  Official Offer    │
│ Websites │  APIs    │PDF/Images│     Pages          │
└────┬─────┴────┬─────┴────┬─────┴────────┬───────────┘
     │          │          │              │
     ▼          ▼          ▼              ▼
┌─────────────────────────────────────────────────────┐
│                 COLLECTOR LAYER                       │
├──────────┬──────────┬──────────┬────────────────────┤
│  HTTP    │  API     │  Image   │   HTML             │
│  Fetcher │  Client  │Downloader│   Parser           │
└────┬─────┴────┬─────┴────┬─────┴────────┬───────────┘
     │          │          │              │
     ▼          ▼          ▼              ▼
┌─────────────────────────────────────────────────────┐
│                 PARSER LAYER                         │
├──────────┬──────────┬──────────┬────────────────────┤
│  JSON    │  HTML    │   OCR    │   PDF              │
│  Parser  │  Parser  │  Engine  │   Extractor        │
└────┬─────┴────┬─────┴────┬─────┴────────┬───────────┘
     │          │          │              │
     ▼          ▼          ▼              ▼
┌─────────────────────────────────────────────────────┐
│              NORMALIZATION LAYER                     │
│                                                      │
│  Raw Offer → Normalized Offer Schema:                │
│  {                                                   │
│    id, source, store_chain, store_branch,            │
│    product_name_en, product_name_ar,                 │
│    original_price, offer_price, discount_pct,        │
│    currency: "SAR",                                  │
│    category, subcategory,                            │
│    image_url, flyer_page_url,                        │
│    valid_from, valid_to,                             │
│    city, region,                                     │
│    created_at, updated_at,                           │
│    source_url, source_type                           │
│  }                                                   │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│             DEDUPLICATION LAYER                      │
│                                                      │
│  Step 1: Exact match on (store + product + price)    │
│  Step 2: Fuzzy match on product_name (Levenshtein)   │
│  Step 3: Image hash comparison (perceptual hash)     │
│  Step 4: Merge → keep richest record,               │
│          track all source_urls                        │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│                 STORAGE LAYER                        │
│                                                      │
│  PostgreSQL:                                         │
│  - offers (main table)                               │
│  - stores (chain + branch info)                      │
│  - categories (product categories)                   │
│  - flyers (flyer metadata + images)                  │
│  - offer_sources (which sources provided each offer) │
│                                                      │
│  Redis: cache layer for dedup + rate limiting        │
│  S3/MinIO: flyer images + product images             │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│                    API LAYER                         │
│  REST API serving offers to SmartCopons frontend     │
└─────────────────────────────────────────────────────┘
```

### Collector Implementations

#### Collector 1: Aggregator Web Parser
```
Schedule: Every 6 hours
Targets: ClicFlyer, KSA Price, OffersInMe, Tsawq, GetCata, DealzSaudi
Method: HTTP GET → HTML parse → extract offer cards
Output: Normalized offer objects
```

#### Collector 2: E-commerce API Client
```
Schedule: Every 12 hours
Targets: Carrefour KSA, Lulu KSA, Danube, Tamimi, Nana
Method: Intercept frontend API calls → replicate with HTTP client
Output: JSON product/promotion data → normalized offers
```

#### Collector 3: Flyer Image Processor
```
Schedule: Daily (check for new flyers)
Targets: D4D Online, GetCata, direct supermarket PDF flyers
Method: Download flyer images → OCR (Google Vision / Tesseract Arabic) → parse
Output: Extracted product names + prices → normalized offers
```

#### Collector 4: Official Page Parser
```
Schedule: Daily
Targets: Panda, Al Othaim, Farm, BinDawood, Nesto offer pages
Method: HTTP GET → HTML parse → extract offers
Output: Normalized offer objects
```

### Deduplication Strategy

**The Problem:** The same "Lulu Hypermarket - Sunsilk Shampoo 50% off" offer will appear on ClicFlyer, KSA Price, OffersInMe, and Lulu's own website.

**Solution: Multi-layer dedup**

1. **Hash-based exact dedup:**
   - Generate hash from: `store_chain + product_name_normalized + offer_price + valid_from`
   - If hash exists, merge sources (don't create duplicate)

2. **Fuzzy product name matching:**
   - Normalize: lowercase, remove Arabic diacritics, strip "buy X get Y" variants
   - Levenshtein distance < 3 on product name within same store + same week = likely duplicate
   - Use Arabic text normalization (alef variants, taa marbuta, etc.)

3. **Image perceptual hashing:**
   - For image-based offers, compute pHash
   - Similar pHash within same store + date range = same offer

4. **Source priority for merged records:**
   - If duplicate found, keep the record with the most complete data
   - Track all source URLs for attribution

---

## PHASE 5 — RANKED SOURCE LIST

### Tier 1: Highest Value (Start Here)

| Source | Type | Stores Covered | Est. Offers/Week | Extraction Difficulty | Data Quality |
|--------|------|---------------|-------------------|----------------------|--------------|
| **ClicFlyer** | Aggregator | 40+ Saudi stores | 5,000-8,000 | Medium | High (structured) |
| **KSA Price** | Aggregator | 20+ Saudi stores | 3,000-5,000 | Low | High (structured) |
| **OffersInMe** | Aggregator | 30+ Saudi stores | 2,000-4,000 | Low | Medium-High |
| **Carrefour KSA API** | E-commerce | 1 (but 30+ branches) | 500-1,000 | Medium | Very High (JSON) |
| **Lulu KSA API** | E-commerce | 1 (25+ branches) | 500-1,000 | Medium | Very High (JSON) |

**Tier 1 total: ~11,000-18,000 offers/week from 5 integrations**

### Tier 2: Strong Supplementary

| Source | Type | Stores Covered | Est. Offers/Week | Extraction Difficulty | Data Quality |
|--------|------|---------------|-------------------|----------------------|--------------|
| **Tsawq.net** | Aggregator | 25+ Saudi stores | 2,000-3,000 | Low | Medium |
| **GetCata** | Catalog aggregator | 25+ Saudi stores | 1,500-2,500 | Low (images) | Medium (needs OCR) |
| **D4D Online** | Flyer aggregator | 30+ Saudi stores | 2,000-4,000 | Low (images) | Medium (needs OCR) |
| **DealzSaudi** | Aggregator | 20+ retailers | 1,000-2,000 | Low | Medium |
| **Danube API** | E-commerce | 1 (24+ branches) | 300-600 | Medium | Very High |
| **Tamimi API** | E-commerce | 1 (165+ branches) | 300-500 | Medium | Very High |

**Tier 2 total: ~7,000-12,500 offers/week from 6 integrations**

### Tier 3: Gap Fillers

| Source | Type | Stores Covered | Est. Offers/Week | Extraction Difficulty | Data Quality |
|--------|------|---------------|-------------------|----------------------|--------------|
| **WoWDeals** | Aggregator | 10+ stores | 500-1,000 | Low | Medium |
| **ClicoOffer** | Aggregator | 15+ stores | 1,000-2,000 | Low-Medium | Medium |
| **Panda.sa offers** | Official | 1 (180+ branches) | 200-500 | Medium | High |
| **Al Othaim offers** | Official | 1 (200+ branches) | 200-400 | Medium | High |
| **Farm offers** | Official | 1 (107+ branches) | 100-300 | Medium | High |
| **Nesto offers** | Official | 1 (20+ branches) | 100-200 | Medium | High |
| **Nana Direct** | Delivery app | Multiple chains | 300-500 | Medium | High |

**Tier 3 total: ~2,400-4,900 offers/week**

### Combined Estimate (after deduplication)

| Metric | Value |
|--------|-------|
| **Gross offers collected** | 20,000-35,000/week |
| **After deduplication** | 8,000-15,000 unique offers/week |
| **Monthly unique offers** | **32,000-60,000** |
| **Supermarket chains covered** | 40+ |
| **Cities covered** | 15+ Saudi cities |

---

## PHASE 6 — RECOMMENDED ARCHITECTURE

### System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     SCHEDULER (Cron)                          │
│  - Aggregator crawl: every 6h                                │
│  - E-commerce API poll: every 12h                            │
│  - Flyer check: daily at 8am                                 │
│  - Official pages: daily at 10am                             │
└──────────────┬───────────────────────────────────────────────┘
               │ triggers
               ▼
┌──────────────────────────────────────────────────────────────┐
│              COLLECTOR WORKERS (Node.js / Python)             │
│                                                               │
│  Worker 1: AggregatorCollector                                │
│    - ClicFlyer parser                                         │
│    - KSAPrice parser                                          │
│    - OffersInMe parser                                        │
│    - Tsawq parser                                             │
│    - DealzSaudi parser                                        │
│                                                               │
│  Worker 2: EcommerceAPICollector                              │
│    - Carrefour KSA API client                                 │
│    - Lulu KSA API client                                      │
│    - Danube API client                                        │
│    - Tamimi API client                                        │
│                                                               │
│  Worker 3: FlyerCollector                                     │
│    - GetCata image downloader                                 │
│    - D4D flyer downloader                                     │
│    - Direct PDF downloader                                    │
│    → Google Cloud Vision OCR (Arabic + English)               │
│                                                               │
│  Worker 4: OfficialPageCollector                              │
│    - Panda.sa parser                                          │
│    - Al Othaim parser                                         │
│    - Farm parser                                              │
│    - Nesto parser                                             │
└──────────────┬───────────────────────────────────────────────┘
               │ raw offers
               ▼
┌──────────────────────────────────────────────────────────────┐
│              PROCESSING PIPELINE                              │
│                                                               │
│  1. Normalize text (Arabic + English)                         │
│  2. Categorize products (ML or rule-based)                    │
│  3. Deduplicate (hash + fuzzy + image)                        │
│  4. Validate (price sanity check, date validation)            │
│  5. Enrich (add category, brand, unit)                        │
│  6. Store in PostgreSQL                                       │
│  7. Cache hot offers in Redis                                 │
│  8. Store images in S3-compatible storage                     │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│              DATABASE (PostgreSQL)                             │
│                                                               │
│  Tables:                                                      │
│  - offers (id, store_id, product_name_en, product_name_ar,   │
│            original_price, offer_price, discount_pct,         │
│            category_id, image_url, valid_from, valid_to,      │
│            city, region, source_type, created_at)             │
│  - stores (id, chain_name, branch_name, city, region, lat,   │
│            lng, type)                                         │
│  - categories (id, name_en, name_ar, parent_id)              │
│  - flyers (id, store_id, title, image_urls, pdf_url,         │
│            valid_from, valid_to, source)                      │
│  - sources (id, offer_id, source_name, source_url,           │
│             collected_at)                                     │
└──────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Component | Recommendation | Why |
|-----------|---------------|-----|
| **Scheduler** | Node-cron or BullMQ | Simple, reliable, built into Node.js ecosystem |
| **Collectors** | Node.js (Cheerio + Axios) or Python (BeautifulSoup + requests) | Fast parsing, good Arabic support |
| **OCR** | Google Cloud Vision API | Best Arabic OCR accuracy; pay-per-use |
| **Database** | PostgreSQL | Robust, supports Arabic text, full-text search |
| **Cache** | Redis | Fast dedup lookups, rate limiting |
| **Image Storage** | Cloudflare R2 or AWS S3 | Cheap, reliable, CDN built-in |
| **Hosting** | Single VPS (4GB RAM) or Vercel + Supabase | Low cost, sufficient for this workload |
| **Monitoring** | Simple health checks + Telegram alerts | Know when a source breaks |

### Cost Estimate (Monthly)

| Item | Cost |
|------|------|
| VPS (4GB RAM) | $20-40 |
| Google Cloud Vision OCR (5,000 images/month) | $7.50 |
| Cloudflare R2 storage (10GB) | ~$0.50 |
| Domain + SSL | ~$1 |
| **Total** | **~$30-50/month** |

---

## IMPLEMENTATION ROADMAP

### Sprint 1 (Week 1-2): Core Aggregator Integration
- [ ] Set up project structure (Node.js or Python)
- [ ] Build KSA Price parser (easiest, well-structured)
- [ ] Build OffersInMe parser
- [ ] Build ClicFlyer parser
- [ ] Set up PostgreSQL schema
- [ ] Build normalization pipeline
- [ ] Build basic deduplication (hash-based)
- **Expected output: 8,000-15,000 offers/week**

### Sprint 2 (Week 3-4): E-commerce API Integration
- [ ] Reverse-engineer Carrefour KSA frontend API
- [ ] Reverse-engineer Lulu KSA deals API
- [ ] Build API clients for both
- [ ] Add Tsawq.net parser
- [ ] Add DealzSaudi parser
- [ ] Implement fuzzy deduplication
- **Expected output: 12,000-20,000 offers/week**

### Sprint 3 (Week 5-6): Flyer/OCR Pipeline
- [ ] Build flyer image downloader (GetCata + D4D)
- [ ] Integrate Google Cloud Vision OCR
- [ ] Build OCR result parser for Arabic + English
- [ ] Add Danube and Tamimi API clients
- [ ] Build image perceptual hashing for dedup
- **Expected output: 15,000-25,000 offers/week**

### Sprint 4 (Week 7-8): Official Pages + Polish
- [ ] Build parsers for Panda, Othaim, Farm, Nesto
- [ ] Implement product categorization
- [ ] Build monitoring and alerting
- [ ] Add auto-retry and error handling
- [ ] Build REST API for SmartCopons frontend
- [ ] Performance optimization and caching
- **Expected output: 18,000-30,000+ offers/week (8,000-15,000 unique after dedup)**

### Sprint 5 (Week 9-10): Scale and Maintain
- [ ] Add remaining Tier 3 sources
- [ ] Build admin dashboard for source health
- [ ] Implement source quality scoring
- [ ] Set up automated tests for parser stability
- [ ] Document all integrations

---

## SUMMARY

### Key Numbers

| Metric | Target |
|--------|--------|
| **Unique offers/month** | 32,000-60,000 |
| **Supermarket chains** | 40+ |
| **Saudi cities** | 15+ |
| **Data sources** | 15-20 integrations |
| **Infrastructure cost** | $30-50/month |
| **Time to MVP** | 2 weeks (Tier 1 only) |
| **Time to full coverage** | 8-10 weeks |

### Data Source Summary

| Source Type | Count | Offers/Week | Difficulty |
|-------------|-------|-------------|------------|
| Aggregator websites | 7-8 | 15,000-25,000 | Low |
| E-commerce APIs | 4-5 | 1,600-3,100 | Medium |
| Flyer/OCR sources | 2-3 | 2,000-4,000 | Medium |
| Official pages | 4-6 | 600-1,400 | Medium |
| **Total (gross)** | **17-22** | **19,200-33,500** | |
| **Total (deduplicated)** | | **8,000-15,000** | |

### Top 5 Sources to Start With

1. **ClicFlyer** — Highest volume, best data quality among aggregators
2. **KSA Price** — Well-structured, easy to parse
3. **OffersInMe** — Good coverage of smaller chains
4. **Carrefour KSA API** — Structured JSON, very reliable
5. **Lulu KSA API** — Structured JSON, good deal coverage
