/*
 * Amazon.sa discount refresh: runs INSIDE a Chrome tab on https://www.amazon.sa
 * (Claude in Chrome's javascript tool, or the DevTools console). Not run by Node.
 *
 * Why in the browser: there is no Creators API access yet (needs 10 shipped
 * sales in 30 days), and same-origin fetches from a real Chrome session read the
 * pages a shopper sees. Every two days, per Khalid (2026-10-03).
 *
 * Procedure (the scheduled task follows this):
 *   1. GET https://sa.smartcopons.com/api/admin/amazon-products/discounts with
 *      Authorization: Bearer $APP_SECRET  → { asins: [...] }
 *   2. In the amazon.sa tab: `window.__ASINS = [...]`, then run this file.
 *      It returns immediately and works in the background (a single CDP call
 *      times out after 45s; 100 product pages take ~3 minutes).
 *   3. Poll `window.__amz.status` until 'done', then read `window.__amz.out`
 *      ("ASIN:percent,..." — percent 0 = no discount now) in slices of ~900
 *      characters, because tool output is truncated around 1,000.
 *   4. POST { discounts: [{ asin, percent }] } to the same endpoint.
 *      ASINs with no readable price are left out on purpose: their old
 *      discount ages out after 48h instead of being guessed.
 */
;(() => {
  const asins = (window.__ASINS || []).filter(a => /^[A-Z0-9]{10}$/.test(a))
  const state = (window.__amz = { status: 'running', done: 0, total: asins.length, out: '', skipped: [] })
  const num = s => (s ? parseFloat(s.replace(/[^\d.]/g, '')) : null)

  ;(async () => {
    const pairs = []
    for (const asin of asins) {
      try {
        const html = await fetch(`/dp/${asin}?language=ar_AE&th=1&psc=1`, { credentials: 'include' }).then(r => r.text())
        const doc = new DOMParser().parseFromString(html, 'text/html')
        const box =
          doc.querySelector('#corePriceDisplay_desktop_feature_div') ||
          doc.querySelector('#corePrice_feature_div') ||
          doc
        const price = num(box.querySelector('.priceToPay .a-offscreen, .a-price .a-offscreen')?.textContent)
        if (!price) {
          state.skipped.push(asin) // unavailable or no buy box — let the old discount age out
        } else {
          const badge = box.querySelector('.savingsPercentage')?.textContent || ''
          let pct = Math.abs(parseInt(badge.replace(/[^\d-]/g, ''), 10)) || 0
          if (!pct) {
            const list = num(box.querySelector('.basisPrice .a-offscreen, .a-text-price .a-offscreen')?.textContent)
            if (list && list > price) pct = Math.round(((list - price) / list) * 100)
          }
          pairs.push(`${asin}:${pct}`)
        }
      } catch {
        state.skipped.push(asin)
      }
      state.done++
      await new Promise(r => setTimeout(r, 900))
    }
    state.out = pairs.join(',')
    state.status = 'done'
  })()

  return `started ${asins.length}`
})()
