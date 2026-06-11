// ============================================================================
// Retailer registry — 30+ Saudi supermarkets / hypermarkets / retailers.
//
// `id` matches the Supermarket.slug in the DB so you can join config ⇄ data.
// `logo` convention: place files at  public/logos/<id>.png
// `cities`        : CitySlug[] the retailer operates in (drives the city filter)
// `active`        : show/hide without deleting the entry
// ============================================================================

import type { CitySlug } from '@/lib/cities'

export interface Retailer {
  id: string
  nameAr: string
  nameEn: string
  logo: string
  active: boolean
  cities: CitySlug[]
  /** Optional brand color for chips/cards. */
  color?: string
}

const ALL: CitySlug[] = ['riyadh', 'jeddah', 'dammam', 'makkah', 'medina', 'khobar', 'qassim', 'taif']

export const RETAILERS: Retailer[] = [
  // --- Hyper / supermarket majors ---
  { id: 'panda', nameAr: 'بنده', nameEn: 'Panda', logo: '/logos/panda.png', active: true, cities: ALL, color: '#00833E' },
  { id: 'hyperpanda', nameAr: 'هايبر بنده', nameEn: 'HyperPanda', logo: '/logos/hyperpanda.png', active: true, cities: ['riyadh', 'jeddah', 'dammam', 'makkah', 'khobar'], color: '#00833E' },
  { id: 'danube', nameAr: 'الدانوب', nameEn: 'Danube', logo: '/logos/danube.png', active: true, cities: ['riyadh', 'jeddah', 'dammam', 'makkah', 'khobar'], color: '#0096D6' },
  { id: 'bindawood', nameAr: 'بن داود', nameEn: 'BinDawood', logo: '/logos/bindawood.png', active: true, cities: ['jeddah', 'makkah', 'medina', 'riyadh'], color: '#E2001A' },
  { id: 'carrefour', nameAr: 'كارفور', nameEn: 'Carrefour', logo: '/logos/carrefour.png', active: true, cities: ALL, color: '#004E9F' },
  { id: 'lulu', nameAr: 'لولو هايبر ماركت', nameEn: 'LuLu Hypermarket', logo: '/logos/lulu.png', active: true, cities: ALL, color: '#ED1C24' },
  { id: 'alothaim', nameAr: 'أسواق العثيم', nameEn: 'Al Othaim', logo: '/logos/alothaim.png', active: true, cities: ['riyadh', 'dammam', 'qassim', 'khobar', 'makkah'], color: '#E30613' },
  { id: 'tamimi', nameAr: 'أسواق التميمي', nameEn: 'Tamimi Markets', logo: '/logos/tamimi.png', active: true, cities: ['riyadh', 'dammam', 'khobar'], color: '#0066B3' },
  { id: 'nesto', nameAr: 'نستو', nameEn: 'Nesto', logo: '/logos/nesto.png', active: true, cities: ['riyadh', 'jeddah', 'dammam', 'khobar'], color: '#F58220' },
  { id: 'farm', nameAr: 'أسواق المزرعة', nameEn: 'Farm Superstores', logo: '/logos/farm.png', active: true, cities: ['jeddah', 'makkah', 'medina', 'taif', 'riyadh'], color: '#7AB800' },
  { id: 'rawabi', nameAr: 'أسواق الروابي', nameEn: 'Rawabi Markets', logo: '/logos/rawabi.png', active: true, cities: ['riyadh', 'qassim'], color: '#1B7A3D' },
  { id: 'safeer', nameAr: 'أسواق سفير', nameEn: 'Safeer Market', logo: '/logos/safeer.png', active: true, cities: ['dammam', 'khobar'], color: '#0A4A9F' },
  { id: 'spinneys', nameAr: 'سبينس', nameEn: 'Spinneys', logo: '/logos/spinneys.png', active: true, cities: ['riyadh', 'jeddah'], color: '#6E2C6B' },
  { id: 'geant', nameAr: 'جيان', nameEn: 'Géant', logo: '/logos/geant.png', active: true, cities: ['riyadh', 'jeddah'], color: '#E2001A' },
  { id: 'manuel', nameAr: 'مانويل ماركت', nameEn: 'Manuel Market', logo: '/logos/manuel.png', active: true, cities: ['riyadh', 'jeddah', 'makkah'], color: '#C8102E' },

  // --- Regional supermarket chains ---
  { id: 'alsadhan', nameAr: 'أسواق السدحان', nameEn: 'Al Sadhan', logo: '/logos/alsadhan.png', active: true, cities: ['riyadh', 'qassim'], color: '#0E6E3A' },
  { id: 'alraya', nameAr: 'أسواق الراية', nameEn: 'Al Raya', logo: '/logos/alraya.png', active: true, cities: ['jeddah', 'makkah', 'medina', 'taif'], color: '#005BAB' },
  { id: 'almadina', nameAr: 'أسواق المدينة', nameEn: 'Al Madina Markets', logo: '/logos/almadina.png', active: true, cities: ['medina', 'jeddah'], color: '#1C7C54' },
  { id: 'aljazera', nameAr: 'أسواق الجزيرة', nameEn: 'Al Jazera Markets', logo: '/logos/aljazera.png', active: true, cities: ['riyadh'], color: '#0072BC' },
  { id: 'thabat', nameAr: 'أسواق ثبات', nameEn: 'Thabat', logo: '/logos/thabat.png', active: true, cities: ['riyadh', 'qassim'], color: '#E4002B' },
  { id: 'prime', nameAr: 'برايم سوبرماركت', nameEn: 'Prime Supermarket', logo: '/logos/prime.png', active: true, cities: ['riyadh', 'jeddah'], color: '#003DA5' },
  { id: 'wadi', nameAr: 'أسواق الوادي', nameEn: 'Al Wadi Markets', logo: '/logos/wadi.png', active: false, cities: ['dammam', 'khobar'], color: '#2E7D32' },
  { id: 'onaizah', nameAr: 'تعاونية عنيزة', nameEn: 'Onaizah Co-op', logo: '/logos/onaizah.png', active: true, cities: ['qassim'], color: '#00693E' },

  // --- Electronics / specialty (still run weekly leaflets) ---
  { id: 'extra', nameAr: 'إكسترا', nameEn: 'eXtra', logo: '/logos/extra.png', active: true, cities: ALL, color: '#E4002B' },
  { id: 'jarir', nameAr: 'مكتبة جرير', nameEn: 'Jarir Bookstore', logo: '/logos/jarir.png', active: true, cities: ALL, color: '#00A1E0' },
  { id: 'saco', nameAr: 'ساكو', nameEn: 'SACO', logo: '/logos/saco.png', active: true, cities: ['riyadh', 'jeddah', 'dammam', 'makkah'], color: '#F36F21' },
  { id: 'ikea', nameAr: 'ايكيا', nameEn: 'IKEA', logo: '/logos/ikea.png', active: true, cities: ['riyadh', 'jeddah', 'dammam'], color: '#0058A3' },
  { id: 'nahdi', nameAr: 'صيدليات النهدي', nameEn: 'Nahdi Pharmacy', logo: '/logos/nahdi.png', active: true, cities: ALL, color: '#00A859' },
  { id: 'aldawaa', nameAr: 'صيدليات الدواء', nameEn: 'Al Dawaa Pharmacy', logo: '/logos/aldawaa.png', active: true, cities: ALL, color: '#E2001A' },
  { id: 'whites', nameAr: 'وايتس', nameEn: 'Whites', logo: '/logos/whites.png', active: true, cities: ['riyadh', 'jeddah', 'dammam'], color: '#111827' },
  { id: 'abyat', nameAr: 'أبيات', nameEn: 'Abyat', logo: '/logos/abyat.png', active: true, cities: ['riyadh', 'jeddah', 'dammam'], color: '#00558C' },
  { id: 'gazzaz', nameAr: 'غزاز', nameEn: 'Gazzaz', logo: '/logos/gazzaz.png', active: false, cities: ['jeddah', 'makkah'], color: '#6D28D9' },
]

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------
export function getActiveRetailers(): Retailer[] {
  return RETAILERS.filter((r) => r.active)
}

export function getRetailerById(id?: string | null): Retailer | undefined {
  return RETAILERS.find((r) => r.id === id)
}

/** Active retailers operating in a given city (or all active when no city). */
export function getRetailersByCity(citySlug?: string | null): Retailer[] {
  const active = getActiveRetailers()
  if (!citySlug || citySlug === 'all') return active
  return active.filter((r) => r.cities.includes(citySlug as CitySlug))
}

export function retailerCount(): number {
  return RETAILERS.length
}
