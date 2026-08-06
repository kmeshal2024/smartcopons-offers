/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // Clean store URLs: /offers/danube → /offers/retailer/danube
  async rewrites() {
    // Canonical retailer URLs are /offers/{slug}; the page itself lives at
    // /offers/retailer/{slug}. This used to be twelve hand-written entries, so
    // any retailer added later 404'd on its own canonical URL until someone
    // remembered to edit this file.
    //
    // `:slug` matches a single segment, so /offers, /offers/retailer/x and
    // /offers/category/x are untouched. The lookahead additionally protects the
    // bare /offers/retailer and /offers/category paths, which would otherwise
    // rewrite to /offers/retailer/retailer.
    const WP_ORIGIN = 'https://wp.smartcopons.com'
    // Only fires for requests whose Host is the bare apex, so sa.smartcopons.com
    // and every preview deployment are untouched. Inert until the apex A record
    // is pointed at Vercel.
    const APEX = [{ type: 'host', value: 'smartcopons.com' }]

    return {
      // The apex still belongs to the WordPress site (homepage, /blog, 86 posts,
      // 87 coupon-store pages). Next.js only owns /ae there, so everything else
      // proxies back to WordPress at its own hostname.
      //
      // The exclusions are not optional: /_next and /api are what the /ae pages
      // load their JS, CSS and offer data from, and sending those to WordPress
      // would render /ae as an unstyled, dataless shell.
      beforeFiles: [
        // The homepage cannot be proxied as `/`. WordPress's canonical redirect
        // sends wp.smartcopons.com/ back to smartcopons.com/, which once the
        // apex is on Vercel is an infinite loop. Addressing the front page by
        // its id skips redirect_canonical entirely and needs no change to the
        // WordPress install. Every other path proxies untouched — verified:
        // /blog/, /browse-coupons/, /coupon-store/*, /wp-content/*, /wp-json/*
        // all return 200 on the wp. host.
        { source: '/', has: APEX, destination: `${WP_ORIGIN}/?page_id=557` },
        {
          source:
            '/:path((?!ae$|ae/|_next/|api/|favicon\\.ico|icon|apple-icon|manifest|robots\\.txt|sitemap).*)',
          has: APEX,
          destination: `${WP_ORIGIN}/:path`,
        },
      ],
      afterFiles: [
        {
          source: '/offers/:slug((?!retailer|category)[a-z0-9][a-z0-9-]*)',
          destination: '/offers/retailer/:slug',
        },
      ],
    }
  },

  images: {
    // Both `domains` and `remotePatterns` cap at 50 entries in this Next
    // version, and the per-subdomain list hit that ceiling. Consolidated to
    // wildcard hostnames — one `**.retailer.com` covers www/cdn/media/etc. and
    // any new subdomain a retailer starts serving from. Apex-only hosts and a
    // few shared CDNs are listed directly.
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      ...[
        '**.smartcopons.com',
        '**.mafrservices.com',       // Carrefour KSA
        '**.carrefourksa.com',
        '**.deliveryhero.io',        // Panda / HungerStation
        '**.pfrmt.com',
        '**.panda.com.sa',
        '**.panda.sa',
        '**.todoorstep.com',         // Panda product images
        '**.danube.sa', 'danube.sa', // Danube (apex + subdomains)
        '**.cloudfront.net',         // Danube product images (CloudFront)
        '**.bindawood.com', 'bindawood.com',
        '**.bindawood.sa',
        '**.bindawoodholding.com',
        '**.luluhypermarket.com',    // LuLu
        '**.akinoncloudcdn.com',     // LuLu product images (Akinon)
        '**.othaimmarkets.com',      // Othaim
        '**.tamimimarkets.com',      // Tamimi
        '**.farm.com.sa', 'farm.com.sa', // Farm Superstores
        '**.nesto.sa',               // Nesto
        'nestogroup.com',
        '**.manuelmarket.com',       // Manuel
        '**.d4donline.com',          // Manuel logo
        '**.extra.com',              // Extra
        '**.saco.sa',                // Saco
        '**.al-dawaa.com',           // Al Dawaa pharmacy
        '**.amazonaws.com',          // Tamimi logo + BinDawood S3
        '**.herokuapp.com',          // BinDawood logo
        'storage.googleapis.com',    // Tamimi product images (Zopsmart)
        'upload.wikimedia.org',      // Logos (Wikipedia)
        'i.imgur.com',               // Fallback logos
        '**.brandfetch.io',          // Logos (Brandfetch)
        '**.ctfassets.net',          // Contentful (Othaim logo)
      ].map(hostname => ({ protocol: 'https', hostname })),
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
