import { CarrefourScraper } from './carrefour'
import { PandaScraper } from './panda'
import { DanubeScraper } from './danube'
import { OthaimScraper } from './othaim'
import { LuluScraper } from './lulu'
import { TamimiScraper } from './tamimi'
import { BinDawoodScraper } from './bindawood'
import { ExtraScraper } from './extra'
import { FarmScraper } from './farm'
import type { ISupermarketScraper } from './types'

const scrapers: Record<string, () => ISupermarketScraper> = {
  carrefour: () => new CarrefourScraper(),
  panda: () => new PandaScraper(),
  danube: () => new DanubeScraper(),
  alothaim: () => new OthaimScraper(),
  lulu: () => new LuluScraper(),
  tamimi: () => new TamimiScraper(),
  bindawood: () => new BinDawoodScraper(),
  extra: () => new ExtraScraper(),
  // Flyer-only: captures Farm's own weekly PDF, no product rows. See farm.ts.
  farm: () => new FarmScraper(),
}

export function getScraper(slug: string): ISupermarketScraper | null {
  const factory = scrapers[slug]
  return factory ? factory() : null
}

export function getAllScraperSlugs(): string[] {
  return Object.keys(scrapers)
}
