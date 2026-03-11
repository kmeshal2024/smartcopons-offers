/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  images: {
    domains: [
      'localhost',
      'sa.smartcopons.com',
      // Supermarket CDN domains (for scraped product images)
      'cdn.mafrservices.com',       // Carrefour KSA
      'www.carrefourksa.com',
      'images.deliveryhero.io',     // Panda / HungerStation
      'www.pfrmt.com',
      'www.panda.com.sa',
      'panda.sa',                    // Panda new domain
      'www.panda.sa',
      'cdn.panda.sa',
      'images.todoorstep.com',       // Panda product images
      'cdn.danube.sa',              // Danube / BinDawood
      'www.danube.sa',
      'd1c124wpoew66.cloudfront.net', // Danube product images (CloudFront CDN)
      'bindawood.com',
      'www.bindawood.com',
      'cdn.luluhypermarket.com',    // LuLu Hypermarket
      'gcc.luluhypermarket.com',
      'www.luluhypermarket.com',
      'bf1af2.akinoncloudcdn.com',  // LuLu product images (Akinon)
      'www.othaimmarkets.com',      // Othaim Markets
      'cdn.othaimmarkets.com',
      'www.tamimimarkets.com',      // Tamimi Markets
      'cdn.tamimimarkets.com',
      'www.farm.com.sa',            // Farm Superstores
      'cdn.farm.com.sa',
      'www.nesto.sa',               // Nesto Hypermarket
      'cdn.nesto.sa',
      'www.manuelmarket.com',       // Manuel Market
      'media.extra.com',            // Extra
      'www.extra.com',
      'www.saco.sa',                // Saco
      'cdn.saco.sa',
      'upload.wikimedia.org',       // Supermarket logos (Wikipedia)
      'i.imgur.com',                // Fallback logos
      'cdn.brandfetch.io',          // Supermarket logos (Brandfetch CDN)
      'images.ctfassets.net',       // Contentful CDN (Othaim logo)
      'farm.com.sa',                // Farm Superstores logo
      'nestogroup.com',             // Nesto logo
      'www.bindawoodholding.com',   // BinDawood logo
      'tamimi-corp-images.s3.me-south-1.amazonaws.com', // Tamimi logo
      'cdn.d4donline.com',          // Manuel Market logo
      'danube.sa',                  // Danube logo
    ],
    // Vercel handles image optimization automatically
    unoptimized: false,
  },

  // Disable source maps in production
  productionBrowserSourceMaps: false,

  // Exclude cheerio from webpack bundling (undici uses private class fields
  // that Next.js 14.2.0 webpack can't parse)
  experimental: {
    serverComponentsExternalPackages: ['cheerio'],
  },
}

module.exports = nextConfig
