'use client'

import { useEffect, useState } from 'react'
import AdminNav from '@/components/AdminNav'

interface Supermarket {
  id: string
  name: string
  nameAr: string
  slug: string
  website?: string
}

interface ScrapeResult {
  success: boolean
  supermarket: string
  received: number
  valid: number
  newOffers: number
  duplicatesSkipped: number
  error?: string
}

// The bookmarklet extraction script (minified version injected into browser)
function getBookmarkletCode(apiUrl: string): string {
  // This script runs on the supermarket page, extracts products, and POSTs to our API
  const script = `
(function(){
  var products=[];
  var host=location.hostname;
  var url=location.href;

  /* Carrefour KSA */
  if(host.includes('carrefourksa')){
    document.querySelectorAll('a[href*="/p/"]').forEach(function(link){
      var c=link.parentElement.parentElement;
      var name=c.querySelector('[class*="line-clamp"]');
      if(!name)return;
      var n=name.textContent.trim();
      var txt=c.textContent;
      var pm=txt.match(/SAR\\s*([\\d.]+)/);
      var dm=txt.match(/(\\d+)%\\s*off/i);
      var img=c.querySelector('img[src*="cdn"]');
      var href=link.getAttribute('href');
      if(n&&pm){
        products.push({nameEn:n,price:parseFloat(pm[1]),discountPercent:dm?parseInt(dm[1]):null,imageUrl:img?img.src:null,sourceUrl:'https://www.carrefourksa.com'+(href||'')});
      }
    });
  }

  /* LuLu Hypermarket */
  else if(host.includes('luluhypermarket')){
    document.querySelectorAll('[class*="product-card"], [class*="ProductCard"], [data-testid*="product"]').forEach(function(card){
      var name=card.querySelector('[class*="name"], [class*="title"], h3, h4');
      if(!name)return;
      var n=name.textContent.trim();
      var priceEl=card.querySelector('[class*="price"]:not([class*="old"]):not(.line-through)');
      var oldEl=card.querySelector('[class*="old"], .line-through, [class*="was"]');
      var img=card.querySelector('img');
      var p=priceEl?parseFloat(priceEl.textContent.replace(/[^0-9.]/g,'')):0;
      var op=oldEl?parseFloat(oldEl.textContent.replace(/[^0-9.]/g,'')):null;
      if(n&&p>0){
        products.push({nameEn:n,price:p,oldPrice:op,imageUrl:img?img.src:null,sourceUrl:url});
      }
    });
  }

  /* Othaim Markets */
  else if(host.includes('othaim')){
    document.querySelectorAll('[class*="product"], [class*="offer"], [class*="card"]').forEach(function(card){
      var name=card.querySelector('[class*="name"], [class*="title"], h3, h4');
      if(!name)return;
      var n=name.textContent.trim();
      var priceEl=card.querySelector('[class*="price"]');
      var img=card.querySelector('img');
      var p=priceEl?parseFloat(priceEl.textContent.replace(/[^0-9.]/g,'')):0;
      if(n&&p>0){
        products.push({nameEn:n,price:p,imageUrl:img?img.src:null,sourceUrl:url});
      }
    });
  }

  /* Danube / BinDawood */
  else if(host.includes('danube')||host.includes('bindawood')){
    document.querySelectorAll('[class*="product"], [class*="card"]').forEach(function(card){
      var name=card.querySelector('[class*="name"], [class*="title"], h3');
      if(!name)return;
      var n=name.textContent.trim();
      var priceEl=card.querySelector('[class*="price"]');
      var img=card.querySelector('img');
      var p=priceEl?parseFloat(priceEl.textContent.replace(/[^0-9.]/g,'')):0;
      if(n&&p>0){
        products.push({nameEn:n,price:p,imageUrl:img?img.src:null,sourceUrl:url});
      }
    });
  }

  /* Panda */
  else if(host.includes('panda')||host.includes('pfrmt')){
    document.querySelectorAll('[class*="product"], [class*="card"]').forEach(function(card){
      var name=card.querySelector('[class*="name"], [class*="title"], h3');
      if(!name)return;
      var n=name.textContent.trim();
      var priceEl=card.querySelector('[class*="price"]');
      var img=card.querySelector('img');
      var p=priceEl?parseFloat(priceEl.textContent.replace(/[^0-9.]/g,'')):0;
      if(n&&p>0){
        products.push({nameEn:n,price:p,imageUrl:img?img.src:null,sourceUrl:url});
      }
    });
  }

  /* Generic fallback */
  else{
    document.querySelectorAll('[class*="product"], [class*="offer"]').forEach(function(card){
      var name=card.querySelector('[class*="name"], [class*="title"], h3, h4');
      var priceEl=card.querySelector('[class*="price"]');
      if(name&&priceEl){
        var n=name.textContent.trim();
        var p=parseFloat(priceEl.textContent.replace(/[^0-9.]/g,''));
        var img=card.querySelector('img');
        if(n&&p>0)products.push({nameEn:n,price:p,imageUrl:img?img.src:null,sourceUrl:url});
      }
    });
  }

  /* Deduplicate by name */
  var seen={};
  products=products.filter(function(p){
    var key=p.nameEn+p.price;
    if(seen[key])return false;
    seen[key]=1;
    return true;
  });

  if(products.length===0){
    alert('SmartCopons: No products found on this page. Make sure you are on a supermarket offers/promotions page.');
    return;
  }

  /* Map hostname to supermarket slug */
  var slugMap={'carrefourksa':'carrefour','luluhypermarket':'lulu','othaimmarkets':'alothaim','danube':'danube','bindawood':'danube','panda':'panda','pfrmt':'panda'};
  var slug='';
  for(var k in slugMap){if(host.includes(k)){slug=slugMap[k];break;}}

  if(!slug){
    slug=prompt('SmartCopons: Could not detect supermarket. Enter slug (carrefour/lulu/alothaim/danube/panda):');
    if(!slug)return;
  }

  var confirmed=confirm('SmartCopons: Found '+products.length+' products from '+slug+'.\\n\\nSend to SmartCopons?');
  if(!confirmed)return;

  /* Send to API */
  fetch('${apiUrl}/api/admin/scrape-submit',{
    method:'POST',
    credentials:'include',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({supermarketSlug:slug,offers:products,sourceUrl:url})
  }).then(function(r){return r.json()}).then(function(d){
    if(d.success){
      alert('SmartCopons: Success!\\n'+d.newOffers+' new offers added, '+d.duplicatesSkipped+' duplicates skipped.');
    }else{
      alert('SmartCopons: Error - '+d.error);
    }
  }).catch(function(e){
    alert('SmartCopons: Network error - '+e.message+'\\n\\nMake sure you are logged into the admin panel first.');
  });
})();`

  return 'javascript:' + encodeURIComponent(script.replace(/\n\s*/g, ''))
}

export default function AdminScrapePage() {
  const [supermarkets, setSupermarkets] = useState<Supermarket[]>([])
  const [loading, setLoading] = useState(true)
  const [lastResult, setLastResult] = useState<ScrapeResult | null>(null)
  const [manualSlug, setManualSlug] = useState('')
  const [manualJson, setManualJson] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [scrapeLogs, setScrapeLogs] = useState<any[]>([])

  const apiUrl = typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [smRes, logRes] = await Promise.all([
        fetch('/api/admin/supermarkets'),
        fetch('/api/admin/scrape-logs'),
      ])
      if (smRes.status === 401) { window.location.href = '/admin/login'; return }
      const smData = await smRes.json()
      setSupermarkets(smData.supermarkets || [])

      if (logRes.ok) {
        const logData = await logRes.json()
        setScrapeLogs(logData.logs || [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const handleManualSubmit = async () => {
    if (!manualSlug || !manualJson) return
    setSubmitting(true)
    try {
      const offers = JSON.parse(manualJson)
      const res = await fetch('/api/admin/scrape-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supermarketSlug: manualSlug,
          offers: Array.isArray(offers) ? offers : [offers],
          sourceUrl: 'manual-entry',
        }),
      })
      const data = await res.json()
      setLastResult(data)
      if (data.success) {
        setManualJson('')
        loadData()
      }
    } catch (e: any) {
      setLastResult({ success: false, error: e.message } as any)
    } finally {
      setSubmitting(false)
    }
  }

  const bookmarkletCode = getBookmarkletCode(apiUrl)

  const supermarketLinks = [
    { slug: 'carrefour', name: 'Carrefour', url: 'https://www.carrefourksa.com/mafsau/en/n/c/clp_carrefouroffers' },
    { slug: 'lulu', name: 'LuLu', url: 'https://gcc.luluhypermarket.com/en-sa/offers' },
    { slug: 'alothaim', name: 'Othaim', url: 'https://www.othaimmarkets.com/en/offers' },
    { slug: 'danube', name: 'Danube', url: 'https://www.danube.sa/en/offers' },
    { slug: 'panda', name: 'Panda', url: 'https://www.pfrmt.com/en/offers' },
  ]

  if (loading) return <div className="min-h-screen bg-gray-50"><AdminNav /><div className="p-8 text-center">Loading...</div></div>

  return (
    <div className="min-h-screen bg-gray-50" dir="ltr">
      <AdminNav />
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Scrape Offers</h1>

        {/* Bookmarklet Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">1. Browser Bookmarklet (Recommended)</h2>
          <p className="text-gray-600 mb-4">
            Drag this button to your bookmarks bar. Then open any supermarket offers page and click it to extract products.
          </p>

          <div className="flex items-center gap-4 mb-4">
            <a
              href={bookmarkletCode}
              className="inline-block px-6 py-3 bg-pink-600 text-white rounded-lg font-bold hover:bg-pink-700 cursor-grab"
              onClick={(e) => e.preventDefault()}
            >
              SmartCopons Scraper
            </a>
            <span className="text-sm text-gray-500">Drag this to your bookmarks bar</span>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm mb-4">
            <strong>Important:</strong> You must be logged into the admin panel first (in the same browser).
            The bookmarklet sends data with your admin session cookie.
          </div>

          <h3 className="font-medium mb-2">How to use:</h3>
          <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1 mb-4">
            <li>Make sure you are logged into this admin panel</li>
            <li>Open a supermarket offers page (links below)</li>
            <li>Scroll down to load all products</li>
            <li>Click the &quot;SmartCopons Scraper&quot; bookmark</li>
            <li>Confirm the number of products found</li>
            <li>Products are automatically saved to the database</li>
          </ol>

          <h3 className="font-medium mb-2">Supermarket offer pages:</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {supermarketLinks.map(sm => (
              <a
                key={sm.slug}
                href={sm.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded border hover:bg-gray-100"
              >
                <span className="font-medium">{sm.name}</span>
                <span className="text-xs text-gray-400 truncate">{sm.url}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Manual JSON Submit */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">2. Manual JSON Submit</h2>
          <p className="text-gray-600 mb-3 text-sm">
            Paste a JSON array of offers. Each offer needs: nameEn (or nameAr), price. Optional: oldPrice, discountPercent, imageUrl, sourceUrl.
          </p>

          <div className="flex gap-3 mb-3">
            <select
              value={manualSlug}
              onChange={e => setManualSlug(e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="">Select supermarket...</option>
              {supermarkets.map(sm => (
                <option key={sm.slug} value={sm.slug}>{sm.name}</option>
              ))}
            </select>
            <button
              onClick={handleManualSubmit}
              disabled={submitting || !manualSlug || !manualJson}
              className="px-4 py-2 bg-pink-600 text-white rounded disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Offers'}
            </button>
          </div>

          <textarea
            value={manualJson}
            onChange={e => setManualJson(e.target.value)}
            placeholder='[{"nameEn": "Product Name", "price": 29.99, "oldPrice": 39.99, "discountPercent": 25}]'
            className="w-full h-32 border rounded p-3 font-mono text-sm"
          />

          <p className="text-xs text-gray-400 mt-1">
            Example: [{'{'}&#34;nameEn&#34;:&#34;Milk 1L&#34;, &#34;price&#34;:5.99, &#34;oldPrice&#34;:7.99{'}'}]
          </p>
        </div>

        {/* Last Result */}
        {lastResult && (
          <div className={`rounded-lg shadow p-4 mb-6 ${lastResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border`}>
            <h3 className="font-semibold mb-1">
              {lastResult.success ? 'Success!' : 'Error'}
            </h3>
            {lastResult.success ? (
              <p className="text-sm">
                {lastResult.newOffers} new offers added, {lastResult.duplicatesSkipped} duplicates skipped
                (received {lastResult.received}, valid {lastResult.valid})
              </p>
            ) : (
              <p className="text-sm text-red-600">{lastResult.error}</p>
            )}
          </div>
        )}

        {/* Recent Scrape Logs */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-3">Recent Scrape Logs</h2>
          {scrapeLogs.length === 0 ? (
            <p className="text-gray-400 text-sm">No scrape logs yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Supermarket</th>
                    <th className="text-left p-2">Found</th>
                    <th className="text-left p-2">New</th>
                    <th className="text-left p-2">Skipped</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {scrapeLogs.map((log: any) => (
                    <tr key={log.id} className="border-b">
                      <td className="p-2 whitespace-nowrap">{new Date(log.scrapedAt).toLocaleString()}</td>
                      <td className="p-2">{log.supermarketSlug}</td>
                      <td className="p-2">{log.offersFound}</td>
                      <td className="p-2 text-green-600">{log.offersCreated}</td>
                      <td className="p-2 text-gray-400">{log.offersSkipped}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${log.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {log.success ? 'OK' : 'FAIL'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
