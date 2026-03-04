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

// The bookmarklet: extracts products, then opens a popup on our domain to submit
function getBookmarkletCode(apiUrl: string): string {
  // This is a comprehensive bookmarklet with:
  // 1. Site-specific extractors for each supermarket
  // 2. A universal fallback that finds products by price patterns
  // 3. Auto-scroll for infinite scroll pages
  // 4. Debug info
  const script = `
(function(){
  var products=[];
  var host=location.hostname;
  var url=location.href;
  var debug=[];

  /* ===== HELPER FUNCTIONS ===== */
  function findPrice(el){
    var txt=el.textContent||'';
    var m=txt.match(/(\\d+\\.\\d{2})/);
    if(m)return parseFloat(m[1]);
    m=txt.match(/(\\d+)/);
    if(m&&parseFloat(m[1])>0&&parseFloat(m[1])<10000)return parseFloat(m[1]);
    return 0;
  }
  function findImg(el){
    var imgs=el.querySelectorAll('img');
    for(var i=0;i<imgs.length;i++){
      var s=imgs[i].src||imgs[i].getAttribute('data-src')||'';
      if(s&&s.startsWith('http')&&!s.includes('logo')&&!s.includes('icon')&&!s.includes('svg')&&!s.includes('flag'))return s;
    }
    return null;
  }
  function cleanName(n){
    if(!n)return'';
    return n.replace(/\\s+/g,' ').trim().substring(0,200);
  }

  /* ===== 1. CARREFOUR KSA ===== */
  if(host.includes('carrefourksa')){
    debug.push('Carrefour mode');
    /* Strategy A: Product links with /p/ */
    document.querySelectorAll('[data-testid*="product"], a[href*="/p/"]').forEach(function(el){
      var card=el.closest('[class*="product"]')||el.closest('[data-testid]')||el.parentElement.parentElement;
      if(!card)card=el;
      var name=card.querySelector('[class*="line-clamp"], [class*="name"], [class*="title"], h3, h4, span[class*="ellipsis"]');
      if(!name)return;
      var n=cleanName(name.textContent);
      if(n.length<3)return;
      var txt=card.textContent||'';
      var pm=txt.match(/SAR\\s*([\\d.]+)/);
      if(!pm)pm=txt.match(/(\\d+\\.\\d{2})/);
      var dm=txt.match(/(\\d+)%/);
      var img=findImg(card);
      var href=el.getAttribute?el.getAttribute('href'):'';
      if(n&&pm){
        products.push({nameEn:n,price:parseFloat(pm[1]),discountPercent:dm?parseInt(dm[1]):null,imageUrl:img,sourceUrl:'https://www.carrefourksa.com'+(href||'')});
      }
    });
    /* Strategy B: Look for price elements with SAR */
    if(products.length===0){
      debug.push('Trying SAR pattern');
      var allEls=document.querySelectorAll('*');
      for(var i=0;i<allEls.length;i++){
        var el=allEls[i];
        if(el.children.length>3)continue;
        var t=el.textContent||'';
        if(t.length>5&&t.length<20&&/SAR\\s*\\d/.test(t)){
          var card=el.closest('li,article,[role="listitem"]')||el.parentElement.parentElement.parentElement;
          if(!card)continue;
          var name=card.querySelector('h2,h3,h4,span[class*="line"],span[class*="name"],a[class*="name"]');
          if(!name)continue;
          var n=cleanName(name.textContent);
          var pm=t.match(/SAR\\s*([\\d.]+)/);
          if(n&&n.length>3&&pm){
            products.push({nameEn:n,price:parseFloat(pm[1]),imageUrl:findImg(card),sourceUrl:url});
          }
        }
      }
    }
    debug.push('Found: '+products.length);
  }

  /* ===== 2. LULU HYPERMARKET ===== */
  else if(host.includes('luluhypermarket')){
    debug.push('LuLu mode');
    /* Strategy A: Common product card selectors */
    var selectors=['[class*="product-card"]','[class*="ProductCard"]','[data-testid*="product"]','[class*="product-item"]','[class*="productCard"]','[class*="product_card"]','[class*="item-card"]','[class*="plp-card"]','[class*="offer-card"]'];
    for(var si=0;si<selectors.length;si++){
      if(products.length>0)break;
      document.querySelectorAll(selectors[si]).forEach(function(card){
        var name=card.querySelector('[class*="name"],[class*="title"],h3,h4,h2,[class*="line-clamp"],a[class*="product"]');
        if(!name)return;
        var n=cleanName(name.textContent);
        if(n.length<3||n.length>300)return;
        var priceEl=card.querySelector('[class*="price"]:not([class*="old"]):not([class*="was"]):not(.line-through)');
        var p=priceEl?findPrice(priceEl):0;
        if(p<=0){p=findPrice(card);}
        if(p<=0)return;
        var oldEl=card.querySelector('[class*="old"],[class*="was"],.line-through,del,s,[class*="strike"],[class*="before"]');
        var op=oldEl?findPrice(oldEl):null;
        products.push({nameEn:n,price:p,oldPrice:op,imageUrl:findImg(card),sourceUrl:url});
      });
      if(products.length>0)debug.push('LuLu found via: '+selectors[si]);
    }
    /* Strategy B: Grid items with images and prices */
    if(products.length===0){
      debug.push('LuLu: trying grid items');
      document.querySelectorAll('li,article,[role="listitem"]').forEach(function(el){
        if(!el.querySelector('img'))return;
        var txt=el.textContent||'';
        if(!/\\d+\\.\\d{2}/.test(txt)&&!/SAR|ر\\.س/.test(txt))return;
        var name=el.querySelector('h2,h3,h4,a[class*="name"],a[class*="title"],span[class*="name"],span[class*="title"],p[class*="name"]');
        if(!name)return;
        var n=cleanName(name.textContent);
        if(n.length<3||n.length>300)return;
        var p=findPrice(el);
        if(p>0){
          products.push({nameEn:n,price:p,imageUrl:findImg(el),sourceUrl:url});
        }
      });
      if(products.length>0)debug.push('LuLu grid items: '+products.length);
    }
    /* Strategy C: Find all price-pattern elements and walk up */
    if(products.length===0){
      debug.push('LuLu: trying price walk-up');
      var priceEls=document.querySelectorAll('[class*="price"],[class*="Price"]');
      priceEls.forEach(function(pel){
        var p=findPrice(pel);
        if(p<=0)return;
        var card=pel.closest('li,article,div[class*="card"],div[class*="item"],div[class*="product"],[role="listitem"]');
        if(!card)card=pel.parentElement.parentElement.parentElement;
        if(!card)return;
        var name=card.querySelector('h2,h3,h4,a[class*="name"],a[class*="title"],span[class*="name"]');
        if(!name){
          var links=card.querySelectorAll('a');
          for(var li=0;li<links.length;li++){
            var lt=links[li].textContent.trim();
            if(lt.length>3&&lt.length<200&&!/SAR|\\d+\\.\\d{2}/.test(lt)){name=links[li];break;}
          }
        }
        if(!name)return;
        var n=cleanName(name.textContent);
        if(n.length<3)return;
        products.push({nameEn:n,price:p,imageUrl:findImg(card),sourceUrl:url});
      });
      if(products.length>0)debug.push('LuLu price walk-up: '+products.length);
    }
    debug.push('LuLu total: '+products.length);
  }

  /* ===== 3. PANDA (panda.sa / panda.com.sa) ===== */
  else if(host.includes('panda')){
    debug.push('Panda mode');
    /* Strategy A: Product cards - Panda uses Next.js/Tailwind */
    var pandaSel=['[class*="product"]','[class*="card"]','[class*="item"]','article','[data-testid]'];
    for(var pi=0;pi<pandaSel.length;pi++){
      if(products.length>0)break;
      document.querySelectorAll(pandaSel[pi]).forEach(function(card){
        if(card.querySelectorAll('img').length===0)return;
        var txt=card.textContent||'';
        /* Must have a price pattern */
        if(!/\\d+\\.\\d{2}/.test(txt)&&!/SAR|ر\\.?س/.test(txt))return;
        /* Skip if too much text (probably a container, not a card) */
        if(txt.length>1000)return;
        var name=card.querySelector('h2,h3,h4,p[class*="name"],p[class*="title"],span[class*="name"],span[class*="title"],a[class*="name"],a[class*="title"],[class*="line-clamp"]');
        if(!name){
          /* Try first meaningful text element */
          var spans=card.querySelectorAll('p,span,a');
          for(var j=0;j<spans.length;j++){
            var st=spans[j].textContent.trim();
            if(st.length>3&&st.length<200&&!/^[\\d.,\\s]+$/.test(st)&&!/SAR|ر\\.?س/.test(st)){
              name=spans[j];break;
            }
          }
        }
        if(!name)return;
        var n=cleanName(name.textContent);
        if(n.length<3)return;
        /* Extract price */
        var pm=txt.match(/([\\d.]+)\\s*(?:SAR|ر\\.?س)/);
        if(!pm)pm=txt.match(/(?:SAR|ر\\.?س)\\s*([\\d.]+)/);
        if(!pm)pm=txt.match(/(\\d+\\.\\d{2})/);
        if(!pm)return;
        var price=parseFloat(pm[1]);
        if(price<=0)return;
        /* Old price */
        var oldEl=card.querySelector('del,s,.line-through,[class*="old"],[class*="was"],[class*="strike"],[class*="before"]');
        var op=oldEl?findPrice(oldEl):null;
        /* Discount */
        var discM=txt.match(/(\\d+)\\s*%/);
        products.push({nameEn:n,price:price,oldPrice:op,discountPercent:discM?parseInt(discM[1]):null,imageUrl:findImg(card),sourceUrl:url});
      });
      if(products.length>0)debug.push('Panda found via: '+pandaSel[pi]);
    }
    /* Strategy B: Try __NEXT_DATA__ */
    if(products.length===0){
      debug.push('Panda: trying __NEXT_DATA__');
      var nd=document.getElementById('__NEXT_DATA__');
      if(nd){
        try{
          var jd=JSON.parse(nd.textContent);
          var findP=function(obj,d){
            if(d>8||!obj)return;
            if(Array.isArray(obj)){for(var k=0;k<obj.length;k++)findP(obj[k],d+1);return;}
            if(typeof obj!=='object')return;
            if(obj.name&&(obj.price||obj.salePrice||obj.sale_price)){
              var pr=parseFloat(obj.salePrice||obj.sale_price||obj.price);
              var op2=obj.salePrice?parseFloat(obj.price):null;
              if(pr>0)products.push({nameEn:obj.name||obj.name_en||obj.title,nameAr:obj.name_ar||obj.nameAr||'',price:pr,oldPrice:op2,imageUrl:obj.image||obj.imageUrl||obj.image_url||obj.thumbnail,sourceUrl:url});
            }
            for(var kk in obj)findP(obj[kk],d+1);
          };
          findP(jd,0);
          debug.push('__NEXT_DATA__ products: '+products.length);
        }catch(e){debug.push('__NEXT_DATA__ parse error');}
      }
    }
    /* Strategy C: Scan inline scripts for product JSON */
    if(products.length===0){
      debug.push('Panda: scanning scripts');
      document.querySelectorAll('script:not([src])').forEach(function(sc){
        var t=sc.textContent||'';
        if(t.includes('"price"')&&(t.includes('"name"')||t.includes('"title"'))){
          var ms=t.match(/\\{[^{}]*"(?:name|title)"[^{}]*"price"[^{}]*\\}/g);
          if(!ms)ms=t.match(/\\{[^{}]*"price"[^{}]*"(?:name|title)"[^{}]*\\}/g);
          if(ms){
            for(var mi=0;mi<Math.min(ms.length,200);mi++){
              try{
                var o=JSON.parse(ms[mi]);
                var nn=o.name||o.title||o.name_en;
                var pp=parseFloat(o.price||o.salePrice||o.sale_price);
                if(nn&&pp>0)products.push({nameEn:nn,price:pp,imageUrl:o.image||o.imageUrl,sourceUrl:url});
              }catch(e){}
            }
          }
        }
      });
      debug.push('Script scan products: '+products.length);
    }
    debug.push('Panda total: '+products.length);
  }

  /* ===== 4. OTHAIM MARKETS ===== */
  else if(host.includes('othaim')){
    debug.push('Othaim mode');
    document.querySelectorAll('[class*="product"],[class*="offer"],[class*="card"],[class*="item"],article').forEach(function(card){
      var name=card.querySelector('[class*="name"],[class*="title"],h3,h4,h2');
      if(!name)return;
      var n=cleanName(name.textContent);
      if(n.length<3||n.length>300)return;
      var p=findPrice(card);
      if(p<=0)return;
      products.push({nameEn:n,price:p,imageUrl:findImg(card),sourceUrl:url});
    });
    debug.push('Othaim: '+products.length);
  }

  /* ===== 5. DANUBE / BINDAWOOD ===== */
  else if(host.includes('danube')||host.includes('bindawood')){
    debug.push('Danube mode');
    document.querySelectorAll('[class*="product"],[class*="card"],[class*="item"],article').forEach(function(card){
      var name=card.querySelector('[class*="name"],[class*="title"],h3,h4,h2');
      if(!name)return;
      var n=cleanName(name.textContent);
      if(n.length<3||n.length>300)return;
      var p=findPrice(card);
      if(p<=0)return;
      products.push({nameEn:n,price:p,imageUrl:findImg(card),sourceUrl:url});
    });
    debug.push('Danube: '+products.length);
  }

  /* ===== 6. UNIVERSAL FALLBACK ===== */
  if(products.length===0){
    debug.push('Universal fallback');
    /* Find all elements that look like product cards (have an image + a price) */
    var candidates=document.querySelectorAll('li,article,[role="listitem"],div[class*="card"],div[class*="product"],div[class*="item"],div[class*="offer"]');
    candidates.forEach(function(el){
      if(!el.querySelector('img'))return;
      var txt=el.textContent||'';
      if(txt.length>2000)return;
      if(!/\\d+\\.\\d{2}/.test(txt))return;
      var name=el.querySelector('h2,h3,h4,[class*="name"],[class*="title"],a:not([class*="price"])');
      if(!name){
        var firstA=el.querySelector('a');
        if(firstA&&firstA.textContent.trim().length>3)name=firstA;
      }
      if(!name)return;
      var n=cleanName(name.textContent);
      if(n.length<3)return;
      var p=findPrice(el);
      if(p>0){
        products.push({nameEn:n,price:p,imageUrl:findImg(el),sourceUrl:url});
      }
    });
    debug.push('Universal: '+products.length);
  }

  /* ===== DEDUPLICATE ===== */
  var seen={};
  products=products.filter(function(p){
    var key=(p.nameEn||'').toLowerCase().replace(/\\s+/g,'')+'-'+p.price;
    if(seen[key])return false;
    seen[key]=1;
    return true;
  });

  if(products.length===0){
    var msg='SmartCopons: No products found on this page.\\n\\nDebug info:\\n'+debug.join('\\n')+'\\n\\nTips:\\n- Make sure you scrolled down to load ALL products\\n- Make sure you are on a product listing page (not a PDF/catalog page)\\n- Try the Manual JSON method on the admin panel';
    alert(msg);
    return;
  }

  /* Map hostname to supermarket slug */
  var slugMap={'carrefourksa':'carrefour','luluhypermarket':'lulu','othaimmarkets':'alothaim','danube':'danube','bindawood':'danube','panda':'panda'};
  var slug='';
  for(var k in slugMap){if(host.includes(k)){slug=slugMap[k];break;}}

  if(!slug){
    slug=prompt('SmartCopons: Found '+products.length+' products.\\nCould not detect supermarket.\\nEnter slug (carrefour/lulu/alothaim/danube/panda):');
    if(!slug)return;
  }

  alert('SmartCopons: Found '+products.length+' products from '+slug+'!\\nSubmitting now...');

  /* Open popup on our domain to submit (avoids CORS issues) */
  var payload={supermarketSlug:slug,offers:products,sourceUrl:url};
  var data=encodeURIComponent(JSON.stringify(payload));
  var submitUrl='${apiUrl}/admin/scrape/submit?data='+data;
  if(submitUrl.length>8000){
    try{
      var w=window.open('${apiUrl}/admin/scrape/submit','_blank','width=500,height=400');
      if(w){
        setTimeout(function(){
          w.postMessage({type:'smartcopons-scrape',supermarketSlug:slug,offers:products,sourceUrl:url},'${apiUrl}');
        },2000);
      }else{
        alert('SmartCopons: Popup blocked! Allow popups for this site, then try again.');
      }
    }catch(e){alert('SmartCopons: Error - '+e.message);}
  }else{
    window.open(submitUrl,'_blank','width=500,height=400');
  }
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
    { slug: 'carrefour', name: 'Carrefour', urls: [
      { label: 'All Offers', url: 'https://www.carrefourksa.com/mafsau/en/n/c/clp_carrefouroffers' },
    ]},
    { slug: 'panda', name: 'Panda', urls: [
      { label: 'Deals', url: 'https://panda.sa/en/plp?category_id=468&deals=1' },
      { label: 'Huge Discounts', url: 'https://panda.sa/en/collections?parent_id=1003&type=huge_discounts&title_en=Huge+Discount' },
      { label: 'All Categories', url: 'https://panda.sa/en' },
    ]},
    { slug: 'lulu', name: 'LuLu', urls: [
      { label: 'Offers', url: 'https://gcc.luluhypermarket.com/en-sa/offers' },
      { label: 'Deals', url: 'https://gcc.luluhypermarket.com/en-sa/deals/' },
      { label: 'In-Store Promos', url: 'https://gcc.luluhypermarket.com/en-sa/pages/instore-promotions' },
    ]},
    { slug: 'alothaim', name: 'Othaim', urls: [
      { label: 'Offers', url: 'https://www.othaimmarkets.com/en/offers' },
    ]},
    { slug: 'danube', name: 'Danube', urls: [
      { label: 'Offers', url: 'https://www.danube.sa/en/offers' },
    ]},
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
            The bookmarklet opens a popup window on SmartCopons to submit the data.
          </div>

          <h3 className="font-medium mb-2">How to use:</h3>
          <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1 mb-4">
            <li>Make sure you are logged into this admin panel</li>
            <li>Open a supermarket offers page (links below)</li>
            <li><strong>Scroll ALL the way down</strong> to load all products (important for infinite scroll pages!)</li>
            <li>Click the &quot;SmartCopons Scraper&quot; bookmark</li>
            <li>An alert will show how many products were found</li>
            <li>A popup will open and submit the products automatically</li>
          </ol>

          <h3 className="font-medium mb-2">Supermarket offer pages:</h3>
          <div className="space-y-3">
            {supermarketLinks.map(sm => (
              <div key={sm.slug} className="border rounded p-3">
                <div className="font-semibold text-sm mb-1">{sm.name}</div>
                <div className="flex flex-wrap gap-2">
                  {sm.urls.map((link, i) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-2 py-1 bg-gray-100 rounded border hover:bg-gray-200 text-blue-600"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 bg-blue-50 border border-blue-200 rounded p-3 text-sm">
            <strong>Tips per supermarket:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1 text-gray-700">
              <li><strong>Carrefour:</strong> Scroll down slowly to load all products. Works best on the &quot;All Offers&quot; page.</li>
              <li><strong>Panda:</strong> Use the new panda.sa website (not the old pfrmt.com). Open &quot;Deals&quot; or &quot;Huge Discounts&quot; and scroll down.</li>
              <li><strong>LuLu:</strong> Try &quot;Offers&quot; or &quot;Deals&quot; page. Scroll all the way down to load everything.</li>
              <li><strong>Othaim:</strong> For PDFs/catalogs, use the Flyers tab to upload the PDF instead.</li>
              <li><strong>Danube:</strong> Open the offers page and scroll down before running the bookmarklet.</li>
            </ul>
          </div>
        </div>

        {/* Manual JSON Submit */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">2. Manual JSON Submit</h2>
          <p className="text-gray-600 mb-3 text-sm">
            Paste a JSON array of offers. Each offer needs: nameEn (or nameAr), price. Optional: oldPrice, discountPercent, imageUrl, sourceUrl, brand.
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

        {/* Console Scraper Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">3. Console Scraper (Advanced)</h2>
          <p className="text-gray-600 mb-3 text-sm">
            If the bookmarklet doesn&apos;t find products, open DevTools (F12) on the supermarket page and paste this code in the Console tab.
            It will print the products JSON which you can copy and paste into the Manual JSON Submit above.
          </p>
          <div className="bg-gray-900 text-green-400 rounded p-3 font-mono text-xs overflow-x-auto max-h-48 overflow-y-auto">
            <pre>{`// Run in browser console on a supermarket page
(function(){
  var products=[];
  document.querySelectorAll('li,article,[role="listitem"],div[class*="card"],div[class*="product"]').forEach(function(el){
    if(!el.querySelector('img'))return;
    var txt=el.textContent||'';
    if(txt.length>2000)return;
    if(!/\\d+\\.\\d{2}/.test(txt))return;
    var name=el.querySelector('h2,h3,h4,[class*="name"],[class*="title"]');
    if(!name)return;
    var n=name.textContent.trim();
    if(n.length<3)return;
    var m=txt.match(/(\\d+\\.\\d{2})/);
    var img=el.querySelector('img');
    if(m){
      products.push({nameEn:n,price:parseFloat(m[1]),imageUrl:img?img.src:null});
    }
  });
  // Deduplicate
  var seen={};
  products=products.filter(function(p){
    var k=p.nameEn+p.price;
    if(seen[k])return false;seen[k]=1;return true;
  });
  console.log('Found '+products.length+' products');
  copy(JSON.stringify(products,null,2));
  console.log('JSON copied to clipboard! Paste it in the admin panel.');
})();`}</pre>
          </div>
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
