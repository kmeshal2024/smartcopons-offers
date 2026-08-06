/**
 * UAE product page.
 *
 * The product page is already country-aware — it reads currency, comparison
 * scope and canonical from the offer's own country — so this route just needs
 * to exist. Without it the canonical that page emits for a UAE offer
 * (smartcopons.com/ae/product/<id>) pointed at a 404, which is worse than no
 * canonical: it asks Google to drop the page.
 *
 * Re-exported rather than copied so the two markets can never drift.
 */
export { default, generateMetadata } from '@/app/product/[id]/page'

export const dynamic = 'force-dynamic'
