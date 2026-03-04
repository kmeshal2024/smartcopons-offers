import { CarrefourScraper } from './carrefour'
import { PandaScraper } from './panda'
import { DanubeScraper } from './danube'
import { OthaimScraper } from './othaim'
import { LuluScraper } from './lulu'
import type { ISupermarketScraper } from './types'

const scrapers: Record<string, () => ISupermarketScraper> = {
  carrefour: () => new CarrefourScraper(),
  panda: () => new PandaScraper(),
  danube: () => new DanubeScraper(),
  alothaim: () => new OthaimScraper(),
  lulu: () => new LuluScraper(),
}

export function getScraper(slug: string): ISupermarketScraper | null {
  const factory = scrapers[slug]
  return factory ? factory() : null
}

export function getAllScraperSlugs(): string[] {
  return Object.keys(scrapers)
}
