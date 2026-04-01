/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // Clean store URLs: /offers/danube → /offers/retailer/danube
  async rewrites() {
    return [
      { source: '/offers/danube', destination: '/offers/retailer/danube' },
      { source: '/offers/carrefour', destination: '/offers/retailer/carrefour' },
      { source: '/offers/panda', destination: '/offers/retailer/panda' },
      { source: '/offers/tamimi', destination: '/offers/retailer/tamimi' },
      { source: '/offers/lulu', destination: '/offers/retailer/lulu' },
      { source: '/offers/alothaim', destination: '/offers/retailer/alothaim' },
      { source: '/offers/bindawood', destination: '/offers/retailer/bindawood' },
      { source: '/offers/nesto', destination: '/offers/retailer/nesto' },
      { source: '/offers/extra', destination: '/offers/retailer/extra' },
      { source: '/offers/saco', destination: '/offers/retailer/saco' },
      { source: '/offers/farm', destination: '/offers/retailer/farm' },
      { source: '/offers/manuel', destination: '/offers/retailer/manuel' },
    ]
  },

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
      'shop.tamimimarkets.com',     // Tamimi online shop
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
      's3.eu-west-1.amazonaws.com',  // BinDawood product images (S3)
      'aym-bindawood-production.s3.eu-west-1.amazonaws.com', // BinDawood S3 bucket
      'www.bindawood.sa',            // BinDawood
      'media.extra.com',             // Extra product images (Amplience CDN)
      'aym-bindawood-production.herokuapp.com', // BinDawood logo (Heroku)
    ],
    // Skip Vercel image optimization (402 on free plan)
    unoptimized: true,
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
