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
      'cdn.danube.sa',              // Danube / BinDawood
      'www.danube.sa',
      'bindawood.com',
      'www.bindawood.com',
      'cdn.luluhypermarket.com',    // LuLu Hypermarket
      'gcc.luluhypermarket.com',
      'www.luluhypermarket.com',
      'www.othaimmarkets.com',      // Othaim Markets
      'cdn.othaimmarkets.com',
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
