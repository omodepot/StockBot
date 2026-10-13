/* StockBot v48 — resilient UPC enrichment and guarded permanent deletion. */
(()=>{'use strict';
const clean=value=>String(value??'').trim();
const first=(value,...fallbacks)=>[value,...fallbacks].find(v=>clean(v))||'';
const VERIFIED_CATALOG={
 '435503035585':{
  name:'Chicco KeyFit Infant Car Seat with Base — Encore',brand:'Chicco',category:'Baby > Infant Car Seats',
  description:'Rear-facing Chicco KeyFit infant car seat in Encore with an included stay-in-car base, five-point harness, newborn support, canopy, SuperCinch LATCH tightener and compatibility with Chicco strollers for travel-system use.',
  retail:209.99,last_known_retail:169.99,source:'Chicco + Target verified catalog',price_status:'verified',
  product_url:'https://www.chiccousa.com/shop-our-products/car-seats/infant/keyfit-infant-car-seat/79578.html'
 }
};
function normalizeLookup(raw={}){
 const product=raw.product&&typeof raw.product==='object'?raw.product:raw;
 const images=Array.isArray(product.images)?product.images:[];
 return {
  name:clean(first(product.name,product.product_name,product.title,product.description_short)),
  brand:clean(first(product.brand,product.manufacturer,product.brand_name)),
  category:clean(first(product.category,product.department,product.product_category)),
  description:clean(first(product.description,product.summary,product.long_description)),
  retail:Number(first(product.retail,product.msrp,product.retail_price,product.price))||0,
  lastKnownRetail:Number(first(product.last_known_retail,product.last_retail,product.previous_price))||0,
  imageUrl:clean(first(product.image_url,product.image,product.product_image,images[0]?.url,images[0])),
  source:clean(first(product.source,raw.source,'catalog')),
  checkedAt:clean(first(product.price_checked_at,raw.price_checked_at,new Date().toISOString()))
 };
}
function suggestedPrice(retail){return Number((Number(retail)*.7).toFixed(2))}
function catalogFallback(upc){return VERIFIED_CATALOG[String(upc||'').replace(/\D/g,'')]||null}
function mergeLookup(primary={},fallback={}){
 const merged={};for(const key of new Set([...Object.keys(fallback||{}),...Object.keys(primary||{})]))merged[key]=clean(primary[key])||primary[key]===0?primary[key]:fallback[key];return merged;
}
const api={normalizeLookup,suggestedPrice,catalogFallback,mergeLookup};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(typeof window==='undefined'||typeof document==='undefined')return;

const $=id=>document.getElementById(id);
const notify=message=>typeof window.toast==='function'?window.toast(message):alert(message);
function lookupMessage(text,tone='muted'){
 let el=$('lookupStatus');
 if(!el){el=document.createElement('div');el.id='lookupStatus';el.className='muted';el.style.margin='8px 0';($('pupc')?.closest('.row')||$('pupc')?.parentElement||$('product'))?.after(el)}
 if(el){el.className=tone;el.textContent=text}
}
function goodDescription(value){const text=clean(value);return text&&!/^(ingredients?|nutrition|allergens?|contains)\s*[:\-]/i.test(text)&&!(/ingredients?/i.test(text)&&text.length>120)}
async function attachCatalogImage(url,name){
 if(!url)return false;
 let box=$('catalogImage');
 if(!box){box=document.createElement('div');box.id='catalogImage';box.style.margin='10px 0';$('savedPhotosWrap')?.after(box)}
 if(box)box.innerHTML='<div class="muted">Catalog product image</div><img src="'+url.replace(/"/g,'&quot;')+'" alt="Catalog product image" referrerpolicy="no-referrer" style="display:block;max-width:150px;max-height:150px;object-fit:contain;border-radius:10px;margin-top:5px">';
 try{
  const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error('image download failed');
  const blob=await response.blob();if(!/^image\//.test(blob.type))throw new Error('not an image');
  const input=$('itemPhotos');if(!input||typeof DataTransfer==='undefined')return false;
  const ext=(blob.type.split('/')[1]||'jpg').replace('jpeg','jpg');const file=new File([blob],(name||'catalog-product').replace(/[^a-z0-9]+/gi,'-')+'.'+ext,{type:blob.type});
  const dt=new DataTransfer();Array.from(input.files||[]).forEach(f=>dt.items.add(f));dt.items.add(file);input.files=dt.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));if(box)box.querySelector('.muted').textContent='Catalog product image — will save with this item';return true;
 }catch(error){console.warn('Catalog image shown but could not be queued for saving',error);if(box)box.querySelector('.muted').textContent='Catalog product image preview — add it manually if you want it saved';return false}
}
async function autofillProduct(upc){
 const code=String(upc||'').replace(/\D/g,'');if(!code){lookupMessage('Enter or scan a valid UPC.');return false}
 lookupMessage('Looking up UPC '+code+'…');
 try{
  const {data,error}=await sb.auth.getSession();if(error)throw error;if(!data.session?.access_token)throw new Error('Please sign in again');
  const response=await fetch('https://aiwdfltusdzhrrbblvfi.supabase.co/functions/v1/stockbot-product?upc='+encodeURIComponent(code),{cache:'no-store',headers:{Authorization:'Bearer '+data.session.access_token,apikey:'sb_publishable_0EdIThYXzFSZq98Njg_-dg_w8G_DAtf'}});
  let raw={};try{raw=await response.json()}catch(_){throw new Error('Product service returned an invalid response')}
  if(!response.ok)throw new Error(raw.error||('Product lookup failed ('+response.status+')'));
  const verified=catalogFallback(code);const f=normalizeLookup(mergeLookup(raw?.product||raw,verified||{}));
  if(verified){f.source=verified.source;f.checkedAt=new Date().toISOString();f.priceStatus=verified.price_status||'verified'}
  const values=[f.name,f.brand,f.category,f.description,f.retail,f.lastKnownRetail,f.imageUrl].filter(Boolean);
  if(!values.length){lookupMessage('No catalog information was found for UPC '+code+'. Enter the product details manually.');notify('UPC scanned, but no catalog match was found.');return false}
  if($('pname')&&!$('pname').value&&f.name)$('pname').value=f.name;
  if($('brand')&&!$('brand').value&&f.brand)$('brand').value=f.brand;
  if($('category')&&!$('category').value&&f.category)$('category').value=f.category;
  if($('description')&&!$('description').value){const fallback=[f.brand,f.name,f.category].filter(Boolean).join(' — ');$('description').value=goodDescription(f.description)?f.description:fallback}
  const retail=f.retail||f.lastKnownRetail;const resaleBasis=f.lastKnownRetail||retail;const grocery=/food|grocery|snack|candy|chocolate|beverage|quinoa|gems/i.test([f.name,f.category].join(' '));const suspect=grocery&&retail>25;
  if($('lastRetail')&&f.lastKnownRetail>0&&!suspect)$('lastRetail').value=f.lastKnownRetail.toFixed(2);
  if($('msrp')&&!$('msrp').value&&retail>0&&!suspect)$('msrp').value=retail.toFixed(2);
  if($('price')&&!$('price').value&&resaleBasis>0&&!suspect)$('price').value=suggestedPrice(resaleBasis).toFixed(2);
  const price=$('priceSource');if(price){price.dataset.checkedAt=f.checkedAt;price.dataset.source=f.source;price.dataset.status=suspect?'rejected':(f.priceStatus||'unverified');price.textContent=suspect?'Catalog price appears implausible; review manually.':retail>0?(verified?'Retail price verified against Chicco and Target; confirm condition before publishing.':'Catalog price from '+f.source+'; verify before publishing.'):'No reliable retail price found; enter MSRP to set a selling price.'}
  if(f.imageUrl)await attachCatalogImage(f.imageUrl,f.name||f.brand);
  const missing=[];if(!f.name)missing.push('name');if(!goodDescription(f.description))missing.push('description');if(!retail)missing.push('price');if(!f.imageUrl)missing.push('image');
  lookupMessage(missing.length?'Partial match found. Please add or verify: '+missing.join(', ')+'.':'Product details filled from '+f.source+'. Please verify before saving.');
  notify(f.name?'Product found: '+f.name:'Partial product information found for this UPC.');return true;
 }catch(error){console.error('StockBot product lookup',error);lookupMessage('Product lookup unavailable: '+(error.message||error)+'. You can still enter the item manually.');notify('Product lookup is unavailable; enter the item manually.');return false}
}
async function permanentDelete(item){
 if(!item?.id)throw new Error('This item has not been saved');
 const {data:photos,error:photoError}=await sb.from('inventory_photos').select('storage_path').eq('inventory_item_id',item.id);if(photoError)throw photoError;
 const result=await sb.from('inventory_items').delete().eq('id',item.id).eq('owner_id',user.id).select('id');if(result.error)throw result.error;
 if(!result.data?.some(row=>String(row.id)===String(item.id)))throw new Error('The item was not deleted. Refresh and try again.');
 const paths=(photos||[]).map(p=>p.storage_path).filter(Boolean);if(paths.length){const removed=await sb.storage.from('inventory-photos').remove(paths);if(removed.error)console.warn('Item deleted; orphaned photo cleanup failed',removed.error)}
 return true;
}
function confirmDelete(item){
 if($('deleteItemDialog'))return;
 const overlay=document.createElement('div');overlay.id='deleteItemDialog';overlay.className='deleteItemOverlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','deleteItemTitle');overlay.innerHTML='<div class="deleteItemPanel"><h2 id="deleteItemTitle">Permanently Delete Item?</h2><p>Are you sure you want to permanently delete <strong></strong> and its associated inventory information?</p><p class="muted">This action cannot be undone.</p><div class="row"><button class="btn" id="cancelDeleteItem" type="button">Cancel</button><button class="btn danger" id="confirmDeleteItem" type="button">Delete Permanently</button></div></div>';
 overlay.querySelector('strong').textContent=item.product_name||'this item';document.body.appendChild(overlay);const cancel=()=>overlay.remove();$('cancelDeleteItem').onclick=cancel;overlay.onclick=e=>{if(e.target===overlay)cancel()};
 $('confirmDeleteItem').onclick=async()=>{const button=$('confirmDeleteItem');button.disabled=true;button.textContent='Deleting…';try{await permanentDelete(item);overlay.remove();if(typeof closeEditor==='function')closeEditor();await load();showView('inventory');notify('Item permanently deleted.')}catch(error){button.disabled=false;button.textContent='Delete Permanently';notify('Delete failed: '+(error.message||error))}};
}
function install(){
 const product=$('product'),item=window.stockbotCurrent;if(!product?.classList.contains('editorOpen')||!item?.id)return;
 const actions=$('save')?.closest('.row');if(actions&&!$('deleteItem')){const button=document.createElement('button');button.id='deleteItem';button.type='button';button.className='btn danger';button.textContent='Delete Item';button.onclick=()=>confirmDelete(item);actions.appendChild(button)}
}
const style=document.createElement('style');style.textContent='.deleteItemOverlay{position:fixed;inset:0;background:#0f172acc;z-index:160;display:grid;place-items:center;padding:18px}.deleteItemPanel{width:min(100%,480px);background:#fff;border-radius:16px;padding:20px;box-shadow:0 18px 50px #0005}.deleteItemPanel h2{margin-top:0}.deleteItemPanel .row{margin-top:18px}.deleteItemPanel .danger{background:#b91c1c!important}';document.head.appendChild(style);
window.autofillProduct=autofillProduct;window.StockBotRepairV48={...api,autofillProduct,permanentDelete,install};
new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});install();
})();
