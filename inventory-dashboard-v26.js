/* StockBot inventory dashboard v27 — full product cards and per-item sales */
(()=>{'use strict';
const $=id=>document.getElementById(id);
let photoMap={};
const escHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeEsc=value=>typeof window.esc==='function'?window.esc(value):escHtml(value);
const cash=value=>typeof window.money==='function'?window.money(value):((value==null||value==='')?'—':'$'+Number(value).toFixed(2));
const inventory=()=>window.items||items||[];
const available=x=>Number(x.available_qty??x.received_qty??0);
const statusOf=x=>{const exp=Number(x.expected_qty||0),rec=Number(x.received_qty||0);if(available(x)<=0&&rec>0)return'Sold';if(rec<=0&&exp>0)return'Expected / Not Received';if(exp>0&&rec<exp)return'Partially Received';if(rec>0)return'Received';return x.status||'Inventory'};
const csvCell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';

async function loadPhotos(){
 photoMap={};
 try{const {data,error}=await sb.from('inventory_photos').select('*').order('sort_order');if(error)throw error;for(const p of data||[])(photoMap[p.inventory_item_id]??=[]).push(p)}catch(e){console.warn('Could not load inventory photos',e)}
}
async function signedPhoto(path){try{const {data,error}=await sb.storage.from('inventory-photos').createSignedUrl(path,3600,{transform:{width:360,height:360,resize:'cover',quality:65}});if(error)throw error;return data?.signedUrl||''}catch(e){console.warn('Could not sign photo URL',e);return''}}
function filterItems(filter,q){const needle=(q||'').trim().toLowerCase();return inventory().filter(x=>{const status=statusOf(x);if(filter==='received'&&!status.toLowerCase().includes('received'))return false;if(filter==='expected'&&!['Expected / Not Received','Partially Received'].includes(status))return false;if(filter==='sold'&&status!=='Sold')return false;if(!needle)return true;return [x.product_name,x.upc,x.sku,x.brand,x.category,x.condition_grade,x.condition_notes,x.description,status].some(v=>String(v||'').toLowerCase().includes(needle))})}
async function saleSummaries(){
 const map={};
 try{const {data,error}=await sb.from('sales_transactions').select('inventory_item_id,quantity,sale_amount,sold_at').order('sold_at',{ascending:false});if(error)throw error;for(const sale of data||[]){const s=map[sale.inventory_item_id]||(map[sale.inventory_item_id]={qty:0,total:0,last:''});s.qty+=Number(sale.quantity||0);s.total+=Number(sale.sale_amount||0);if(!s.last)s.last=sale.sold_at||''}}
 catch(e){console.warn('Could not load sales summary',e)}
 return map;
}
async function renderSheet(){
 const host=$('inventorySheet');if(!host)return;
 const rows=filterItems($('invFilter')?.value||'all',$('invSearch')?.value||'');
 const sales=await saleSummaries();
 const cards=await Promise.all(rows.map(async x=>{
  const photos=await Promise.all((photoMap[x.id]||[]).map(async p=>({url:await signedPhoto(p.storage_path),path:p.storage_path})));
  const usable=photos.filter(p=>p.url);
  const pics=usable.length?'<div class="sb27-photos">'+usable.map((p,i)=>'<a href="'+escHtml(p.url)+'" target="_blank" rel="noopener" aria-label="Open product photo '+(i+1)+'"><img loading="lazy" src="'+escHtml(p.url)+'" alt="'+safeEsc(x.product_name||'Product photo')+' photo '+(i+1)+'"></a>').join('')+'</div>':'<div class="sb27-no-photo">No photos saved</div>';
  const sold=sales[x.id]||{qty:0,total:0,last:''};
  const noteText=String(x.condition_notes||'');const descLine=noteText.split(/\r?\n/).find(line=>/^Description:\s*/i.test(line));const description=x.description||descLine?.replace(/^Description:\s*/i,'')||noteText;
  const descriptionText=String(description).trim()||'No description or notes entered.';
  const isSold=statusOf(x)==='Sold';
  return '<article class="sb27-card" data-id="'+escHtml(x.id)+'"><div class="sb27-main">'+pics+'<div class="sb27-info"><div class="sb27-name">'+safeEsc(x.product_name||'Unnamed product')+'</div><div class="sb27-upc">UPC: <strong>'+safeEsc(x.upc||'—')+'</strong>'+(x.sku?' <span>· SKU: '+safeEsc(x.sku)+'</span>':'')+'</div><p class="sb27-description">'+safeEsc(descriptionText)+'</p><div class="sb27-tags">'+(x.brand?'<span>'+safeEsc(x.brand)+'</span>':'')+(x.category?'<span>'+safeEsc(x.category)+'</span>':'')+(x.condition_grade?'<span>Condition: '+safeEsc(x.condition_grade)+'</span>':'')+'<span class="sb27-status '+(isSold?'sold':'')+'">'+safeEsc(statusOf(x))+'</span></div></div></div><div class="sb27-facts"><div><small>Unit cost</small><strong>'+cash(x.unit_cost)+'</strong></div><div><small>Last known retail price</small><strong>'+cash(x.last_known_retail)+'</strong></div><div><small>Suggested Facebook Marketplace</small><strong>'+cash(x.suggested_price)+'</strong></div><div><small>Retail / MSRP</small><strong>'+cash(x.unit_retail)+'</strong></div><div><small>Available</small><strong>'+available(x)+'</strong></div><div><small>Sold</small><strong>'+sold.qty+' item'+(sold.qty===1?'':'s')+' · '+cash(sold.total)+'</strong></div></div><div class="sb27-foot"><span class="sb27-sale-date">'+(sold.last?'Last sale: '+safeEsc(new Date(sold.last).toLocaleDateString()):'')+'</span><div class="sb27-actions"><button class="btn sb27-edit" type="button">Edit product</button>'+(available(x)>0?'<button class="btn green sb27-toggle-sale" type="button">Record sale / Mark sold</button>':'')+'</div></div><div class="sb27-sale-form hidden"><div class="row"><label>Quantity sold<input class="sb27-qty" type="number" min="1" max="'+Math.max(available(x),1)+'" value="1"></label><label>Sold for (total amount)<input class="sb27-amount" type="number" min="0" step="0.01" placeholder="0.00"></label></div><div class="row"><label>Payment method<select class="sb27-method"><option value="cash">Cash</option><option value="venmo">Venmo</option><option value="zelle">Zelle</option><option value="paypal">PayPal</option><option value="cash_app">Cash App</option><option value="card">Card</option><option value="other">Other</option></select></label><label>Sale notes (optional)<input class="sb27-notes" placeholder="Buyer, pickup, discount…"></label></div><div class="sb27-actions"><button class="btn sb27-cancel-sale" type="button">Cancel</button><button class="btn green sb27-save-sale" type="button">Save sale</button></div></div></article>';
 }));
 host.innerHTML='<div class="sb27-list">'+cards.join('')+'</div><p class="muted">Showing '+rows.length+' product'+(rows.length===1?'':'s')+'. Product details, pricing, photos, and sale tracking are shown on each card.</p>';
 host.querySelectorAll('.sb27-card').forEach(card=>{
  const x=inventory().find(item=>String(item.id)===card.dataset.id);if(!x)return;
  card.querySelector('.sb27-edit')?.addEventListener('click',()=>{if(typeof window.openItem==='function')window.openItem(x.id);else if(typeof openItem==='function')openItem(x.id)});
  card.querySelector('.sb27-toggle-sale')?.addEventListener('click',()=>card.querySelector('.sb27-sale-form')?.classList.toggle('hidden'));
  card.querySelector('.sb27-cancel-sale')?.addEventListener('click',()=>card.querySelector('.sb27-sale-form')?.classList.add('hidden'));
  card.querySelector('.sb27-save-sale')?.addEventListener('click',()=>saveSale(card,x));
 });
}
async function saveSale(card,x){
 const qty=Number(card.querySelector('.sb27-qty')?.value||0),amount=Number(card.querySelector('.sb27-amount')?.value),have=available(x);
 if(!Number.isInteger(qty)||qty<1)return toast('Enter a quantity sold');
 if(qty>have)return toast('Only '+have+' item(s) are available');
 if(!Number.isFinite(amount)||amount<0)return toast('Enter the total sold amount');
 const session=(await sb.auth.getSession()).data.session;if(!session)return toast('Please sign in again');
 const sale={owner_id:session.user.id,inventory_item_id:x.id,quantity:qty,sale_amount:amount,payment_method:card.querySelector('.sb27-method')?.value||'cash',notes:card.querySelector('.sb27-notes')?.value.trim()||null};
 const inserted=await sb.from('sales_transactions').insert(sale);if(inserted.error)return toast('Sale not saved: '+inserted.error.message);
 const remaining=have-qty;const updated=await sb.from('inventory_items').update({available_qty:remaining,status:remaining<=0?'sold':(x.status||'received')}).eq('id',x.id);
 if(updated.error)return toast('Sale saved, but inventory quantity update failed: '+updated.error.message);
 toast('Sale saved · '+qty+' sold · '+cash(amount));
 if(typeof window.load==='function')await window.load();else{await loadPhotos();await renderSheet()}
}
function exportCsv(){
 const rows=filterItems($('invFilter')?.value||'all',$('invSearch')?.value||'');
 const headers=['UPC','Product','Description / Notes','Brand','Category','SKU','Condition','Status','Expected Qty','Received Qty','Available Qty','Unit Cost','Lowest Known Price','Suggested Facebook Marketplace Price','Retail / MSRP','Sold Qty','Sold For Total','Last Known Retail Price Checked','Price Source','Price Status','Photo Count','Photo Paths'];
 const csv=[headers.map(csvCell).join(','),...rows.map(x=>[x.upc,x.product_name,x.description||x.condition_notes,x.brand,x.category,x.sku,x.condition_grade,statusOf(x),x.expected_qty,x.received_qty,available(x),x.unit_cost,x.last_known_retail,x.suggested_price,x.unit_retail,'','','',x.price_source,x.price_status,(photoMap[x.id]||[]).length,(photoMap[x.id]||[]).map(p=>p.storage_path).join(' | ')].map(csvCell).join(','))].join('\r\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='StockBot-Inventory-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function installDashboard(){
 const sec=$('inventory');if(!sec)return;sec.closest('main.wrap')?.classList.add('sb27-wide-wrap');if($('inventoryDashboard'))return;
 sec.innerHTML='<div id="inventoryDashboard" class="card"><div class="row"><input id="invSearch" placeholder="Search UPC, product, brand, condition…"><select id="invFilter"><option value="all">All Inventory</option><option value="received">Received / Checked In</option><option value="expected">Expected / Not Fully Received</option><option value="sold">Sold Out</option></select></div><div class="row" style="margin-top:9px"><button class="btn primary" id="csvExport">⬇ Download Spreadsheet (CSV)</button><button class="btn" id="printInventory">🖨 Print Inventory</button><button class="btn" id="photoInventoryExport">Export With Photos</button></div><div id="inventorySheet" style="margin-top:12px"></div></div>';
 $('invSearch').oninput=renderSheet;$('invFilter').onchange=renderSheet;$('csvExport').onclick=exportCsv;$('photoInventoryExport').onclick=()=>window.downloadPhotoInventory?.();$('printInventory').onclick=()=>window.print();renderSheet();
}
function installStyles(){if($('sb27style'))return;const s=document.createElement('style');s.id='sb27style';s.textContent='.sb27-wide-wrap{max-width:1540px!important;width:100%}.sb27-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,500px),1fr));gap:10px;align-items:start}.sb27-card{border:1px solid #dbe1e8;border-radius:12px;padding:11px;background:#fff;box-shadow:0 2px 8px #0f172a0b}.sb27-main{display:grid;grid-template-columns:108px minmax(0,1fr);gap:11px;align-items:start}.sb27-photos{display:flex;gap:5px;overflow-x:auto;max-width:108px;padding-bottom:3px;scrollbar-width:thin}.sb27-photos a{display:block;flex:0 0 52px;width:52px;height:52px;border-radius:8px;overflow:hidden;background:#f1f5f9}.sb27-photos img{width:100%;height:100%;object-fit:cover;display:block}.sb27-no-photo{min-height:52px;display:grid;place-items:center;text-align:center;padding:6px;background:#f1f5f9;color:#64748b;border-radius:8px;font-size:11px}.sb27-name{font-size:16px;font-weight:800;line-height:1.2}.sb27-upc{margin-top:4px;color:#475569;font-size:12px}.sb27-description{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.35;margin:5px 0;color:#334155;font-size:13px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.sb27-tags{display:flex;gap:5px;flex-wrap:wrap}.sb27-tags span{background:#f1f5f9;border-radius:999px;padding:3px 7px;font-size:11px;color:#334155}.sb27-tags .sb27-status{background:#dcfce7;color:#166534;font-weight:700}.sb27-tags .sb27-status.sold{background:#fee2e2;color:#991b1b}.sb27-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:9px}.sb27-facts>div{background:#f8fafc;border-radius:8px;padding:7px;min-width:0}.sb27-facts small{display:block;color:#64748b;font-size:10px;line-height:1.2}.sb27-facts strong{display:block;margin-top:3px;font-size:13px;overflow-wrap:anywhere}.sb27-foot{display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:8px}.sb27-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.sb27-sale-form{margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0}.sb27-sale-form label{display:block;flex:1;font-size:12px;font-weight:700;color:#475569}.sb27-sale-form input,.sb27-sale-form select{margin-top:4px}.sb27-sale-form .row{margin:8px 0}.sb27-sale-form .btn{font-size:14px}@media(max-width:600px){.sb27-wide-wrap{padding:7px}.sb27-card{padding:9px}.sb27-main{grid-template-columns:82px minmax(0,1fr);gap:8px}.sb27-photos{max-width:82px}.sb27-photos a{flex-basis:40px;width:40px;height:40px}.sb27-name{font-size:16px}.sb27-facts{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.sb27-facts>div{padding:8px}.sb27-foot{align-items:flex-start;flex-direction:column}.sb27-actions{width:100%;justify-content:stretch}.sb27-actions button{flex:1}.sb27-sale-form .row{flex-direction:column}}@media print{header,.tabs,.fab,.sb27-actions,#invSearch,#invFilter,#csvExport,#printInventory,#photoInventoryExport{display:none!important}.sb27-card{break-inside:avoid;box-shadow:none}.sb27-list{display:block}.sb27-card{margin:8px 0}}';document.head.appendChild(s)}
const originalLoad=window.load;
if(typeof originalLoad==='function')window.load=async function(...args){await originalLoad.apply(this,args);await loadPhotos();installDashboard();await renderSheet()};
const originalSave=window.saveItem;
if(typeof originalSave==='function')window.saveItem=async function(...args){const result=await originalSave.apply(this,args);setTimeout(async()=>{await loadPhotos();await renderSheet()},400);return result};
document.addEventListener('change',e=>{if(e.target?.id==='photos')window.pendingPhotos=Array.from(e.target.files||[])});
const observer=new MutationObserver(()=>{installStyles();installDashboard()});observer.observe(document.documentElement,{childList:true,subtree:true});
installStyles();loadPhotos().then(()=>{installDashboard();renderSheet()});
window.StockBotInventoryV27={renderSheet,exportCsv,loadPhotos};
})();
