/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // Retailer pages now LIVE at /offers/{slug} — that is a real route
  // (app/offers/[slug]), not a rewrite. The old /offers/retailer/{slug} pattern
  // 301s to it; see redirects() below.
  //
  // Previously the page lived at /offers/retailer/{slug} while canonical, og:url,
  // the Store/ItemList JSON-LD and sitemap-pages.xml all pointed at
  // /offers/{slug}, which a rewrite served as a duplicate. Every internal link
  // pointed at the pattern the page then disavowed, so link equity flowed to a
  // URL nothing claimed. Moving the route rather than adding a redirect on top of
  // the rewrite is deliberate: rewrite + 301 in opposite directions is an
  // infinite loop.
  async redirects() {
    return [
      // Consolidate the retired pattern. `statusCode: 301` rather than
      // `permanent: true`, which emits 308 — Google treats the two as equivalent
      // for consolidation, but 301 is what every audit tool and log analyser
      // expects, and these are GET-only page URLs so 308's method-preservation
      // buys nothing.
      {
        source: '/offers/retailer/:slug',
        destination: '/offers/:slug',
        statusCode: 301,
      },
      // The bare segment was never a page; it used to fall through the rewrite's
      // lookahead. Send it to the offers listing rather than rendering a
      // 200 "store not found".
      { source: '/offers/retailer', destination: '/offers', statusCode: 301 },

      // ---------------------------------------------------------------------
      // Retired coupon surface (Saudi only).
      //
      // /coupons was a second business bolted onto a Saudi supermarket domain:
      // fashion, electronics and travel brands priced in $ and €, with 65 of 81
      // brands holding exactly one code, and every one of the 106 rows carrying
      // `url = '#'` — so the click-through half of the conversion goal never
      // functioned at all. Rebuilding it properly meant weeks of affiliate-network
      // signups plus a permanent monthly code-verification burden, because coupon
      // codes expire silently and 106 dead codes are worse for trust than no page.
      //
      // The Coupon and Store TABLES and all their rows are intentionally kept, as
      // are the admin CRUD routes, /api/public/coupons* and the UAE surface at
      // /ae/coupons (a different market on a different origin). Only the Saudi
      // routes and navigation are gone. A future rebuild would be scoped to Saudi
      // grocery-adjacent brands — Noon, Nana, Jahez, HungerStation, retailer
      // e-commerce — not the list that was here.
      //
      // 301 rather than 410: these URLs are indexed and carry whatever equity the
      // section earned, and the homepage is the closest surviving equivalent.
      { source: '/coupons', destination: '/', statusCode: 301 },
      { source: '/coupons/category/:slug', destination: '/', statusCode: 301 },
      { source: '/coupon/:id', destination: '/', statusCode: 301 },
      // Coupon-store pages (prisma.store, not Supermarket). Retailer pages live at
      // /offers/{slug} and are unaffected. On the apex, /store/* is proxied to
      // WordPress and untouched by this.
      { source: '/store/:slug', destination: '/', statusCode: 301 },
      { source: '/sitemap-coupons.xml', destination: '/sitemap.xml', statusCode: 301 },
    ]
  },

  async rewrites() {
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
