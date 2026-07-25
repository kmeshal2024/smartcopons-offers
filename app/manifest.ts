import type { MetadataRoute } from 'next'

/**
 * PWA manifest. This is what makes the site installable ("add to home screen")
 * and, crucially, what Bubblewrap reads to generate the Google Play / Huawei
 * AppGallery app — the store apps are a thin TWA wrapper around this same PWA,
 * so the manifest is the single source of truth for app name, icons and theme.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'سمارت كوبونز — عروض وكوبونات السعودية',
    short_name: 'سمارت كوبونز',
    description:
      'أحدث عروض ونشرات السوبرماركت والصيدليات وكوبونات الخصم في السعودية — بنده، كارفور، التميمي، النهدي، الدواء وغيرها.',
    lang: 'ar',
    dir: 'rtl',
    start_url: '/?utm_source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#E91E8C',
    categories: ['shopping', 'lifestyle', 'food'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'العروض', url: '/offers', description: 'أحدث عروض السوبرماركت' },
      { name: 'الكوبونات', url: '/coupons', description: 'كوبونات وأكواد الخصم' },
      { name: 'ينتهي قريباً', url: '/offers?sort=ending', description: 'عروض على وشك الانتهاء' },
    ],
  }
}
