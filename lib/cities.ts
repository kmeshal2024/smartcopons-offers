// ============================================================================
// Saudi cities — shared by the retailers config (Feature 3) and the location
// filter bar (Feature 7). `slug` is the stable key used everywhere.
// ============================================================================

export interface City {
  slug: CitySlug
  nameAr: string
  nameEn: string
  region: string
}

export type CitySlug =
  | 'riyadh'
  | 'jeddah'
  | 'dammam'
  | 'makkah'
  | 'medina'
  | 'khobar'
  | 'qassim'
  | 'taif'

export const CITIES: City[] = [
  { slug: 'riyadh', nameAr: 'الرياض', nameEn: 'Riyadh', region: 'منطقة الرياض' },
  { slug: 'jeddah', nameAr: 'جدة', nameEn: 'Jeddah', region: 'منطقة مكة المكرمة' },
  { slug: 'dammam', nameAr: 'الدمام', nameEn: 'Dammam', region: 'المنطقة الشرقية' },
  { slug: 'makkah', nameAr: 'مكة', nameEn: 'Makkah', region: 'منطقة مكة المكرمة' },
  { slug: 'medina', nameAr: 'المدينة', nameEn: 'Medina', region: 'منطقة المدينة المنورة' },
  { slug: 'khobar', nameAr: 'الخبر', nameEn: 'Khobar', region: 'المنطقة الشرقية' },
  { slug: 'qassim', nameAr: 'القصيم', nameEn: 'Qassim', region: 'منطقة القصيم' },
  { slug: 'taif', nameAr: 'الطائف', nameEn: 'Taif', region: 'منطقة مكة المكرمة' },
]

/** The "all cities" pill value used by the location filter. */
export const ALL_CITIES = 'all' as const

export function getCityBySlug(slug?: string | null): City | undefined {
  return CITIES.find((c) => c.slug === slug)
}

export function cityNameAr(slug?: string | null): string {
  return getCityBySlug(slug)?.nameAr ?? 'كل المدن'
}
