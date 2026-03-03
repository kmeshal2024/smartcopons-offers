/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  images: {
    domains: [
      'localhost',
      'sa.smartcopons.com',
    ],
    // Vercel handles image optimization automatically
    // Set unoptimized: false if you want Vercel image optimization
    unoptimized: false,
  },

  // Disable source maps in production
  productionBrowserSourceMaps: false,
}

module.exports = nextConfig
