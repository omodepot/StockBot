/* StockBot product enrichment — safe, non-destructive editor integration */
(()=>{'use strict';
const $=id=>document.getElementById(id);
function enhance(){
 const notes=$('notes');if(!notes)return;
 if(!$('brand')){const box=document.createElement('div');box.innerHTML='<label>Brand</label><input id="brand" placeholder="Brand / manufacturer"><label>Category</label><input id="category" placeholder="Category">';notes.parentNode.insertBefore(box,notes);$('brand').value=window.stockbotCurrent?.brand||'';$('category').value=window.stockbotCurrent?.category||'';}
 if(!$('description')){const box=document.createElement('div');box.innerHTML='<label>Product description (not ingredients)</label><textarea id="description" placeholder="Description for resale listing"></textarea>';notes.parentNode.insertBefore(box,notes.nextSibling);const m=String(window.stockbotCurrent?.condition_notes||'').match(/Description:\s*([^\n]+)/i);if(m)$('description').value=m[1];}
 if(!$('msrp')){const row=$('price')?.closest('.row');if(row){const box=document.createElement('div');box.innerHTML='<label>Online retail / MSRP (verify before publishing)</label><input id="msrp" type="number" step=".01" min="0"><label>Last known retail</label><input id="lastRetail" type="number" step=".01" min="0" readonly><div class="muted" id="priceSource"></div>';row.insertBefore(box,row.firstChild);const x=window.stockbotCurrent;if(x?.unit_retail!=null)$('msrp').value=x.unit_retail;if(x?.last_known_retail!=null)$('lastRetail').value=x.last_known_retail;const p=$('priceSource');p.dataset.checkedAt=x?.price_checked_at||'';p.dataset.source=x?.price_source||'';p.dataset.status=x?.price_status||'unverified';p.textContent=x?.price_checked_at?'Checked '+new Date(x.price_checked_at).toLocaleDateString()+' · '+(x.price_source||'unknown')+' · '+(x.price_status||'unverified'):'Price not yet verified';$('msrp').oninput=()=>{p.dataset.status='manual_review';p.dataset.source='manual';p.dataset.checkedAt=new Date().toISOString();};}}
}
window.stockbotEnhanceEditor=function(){enhance();const upc=$('pupc')?.value||window.stockbotCurrent?.upc;if(upc)setTimeout(()=>window.autofillProduct(upc),80);};
window.autofillProduct=async function(upc){
 upc=String(upc||'').replace(/\D/g,'');if(!upc)return false;
 try{
  const session=(await sb.auth.getSession()).data.session;if(!session?.access_token)throw Error('Please sign in');
  const response=await fetch('https://aiwdfltusdzhrrbblvfi.supabase.co/functions/v1/stockbot-product?upc='+encodeURIComponent(upc),{cache:'no-store',headers:{Authorization:'Bearer '+session.access_token,apikey:'sb_publishable_0EdIThYXzFSZq98Njg_-dg_w8G_DAtf'}});
  const f=await response.json();if(!response.ok)throw Error(f.error||'Lookup failed');
  if(!f.name)return false;
  if($('pname')&&!$('pname').value)$('pname').value=f.name;
  if($('brand')&&!$('brand').value&&f.brand)$('brand').value=f.brand;
  if($('category')&&!$('category').value&&f.category)$('category').value=f.category;
  const raw=String(f.description||'').trim();
  const ingredients=/^(ingredients?|nutrition|allergens?|contains)\s*[:\-]/i.test(raw)||(/ingredients?/i.test(raw)&&raw.length>120);
  if($('description')&&!$('description').value)$('description').value=ingredients||!raw?[f.brand,f.name,f.category].filter(Boolean).join(' — '):raw;
  const retail=Number(f.retail)||0,last=Number(f.last_known_retail)||0;
  const grocery=/food|grocery|snack|candy|chocolate|beverage|quinoa|gems/i.test((f.name||'')+' '+(f.category||''));
  const suspect=grocery&&retail>25;
  const p=$('priceSource');
  if(p){p.dataset.checkedAt=f.price_checked_at||new Date().toISOString();p.dataset.source=f.source||'catalog';p.dataset.status=suspect?'rejected':'unverified';p.textContent=suspect?'Catalog price appears implausible; review manually.':'Catalog estimate from '+(f.source||'unknown')+'; verify retail before publishing.';}
  if($('lastRetail')&&last>0&&!suspect)$('lastRetail').value=last.toFixed(2);
  if($('msrp')&&!$('msrp').value&&retail>0&&!suspect)$('msrp').value=retail.toFixed(2);
  if($('price')&&!$('price').value&&retail>0&&!suspect)$('price').value=(retail*.7).toFixed(2);
  return true;
 }catch(e){console.error('StockBot lookup',e);if($('priceSource'))$('priceSource').textContent='Lookup unavailable: '+e.message;return false;}
};
window.handleScannedUPC=async function(code,target){code=String(code||'').replace(/\D/g,'');if(target==='editor'&&$('pupc')){$('pupc').value=code;await window.autofillProduct(code);return;}if($('lookup'))$('lookup').value=code;const norm=v=>String(v||'').replace(/\D/g,'').replace(/^0(?=\d{12}$)/,'');const found=(window.items||items||[]).find(x=>norm(x.upc)===norm(code));if(found){openItem(found.id);return;}newItem(code,'');setTimeout(()=>window.autofillProduct(code),150);};
})();