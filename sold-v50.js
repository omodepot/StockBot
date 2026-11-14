/* StockBot v50 — Sold screen: every recorded sale, clickable and editable.
   Click a sale to see it; change quantity, price, fees, payment, date or notes; open the item to edit its
   details; or undo the sale (the units go back into stock). Reads the canonical `sales` table and the
   legacy `sales_transactions` table that older dashboard builds wrote to. */
(()=>{'use strict';

const METHODS=[['cash','Cash'],['venmo','Venmo'],['zelle','Zelle'],['paypal','PayPal'],['cash_app','Cash App'],['card','Card'],['other','Other']];
const money=n=>'$'+(Number(n)||0).toFixed(2);

// Pure helpers (exported for node tests).
// New stock level after a sale's quantity changes from oldQty to newQty. null = not enough stock.
function stockAfterEdit(available,oldQty,newQty){const next=Number(available||0)+Number(oldQty||0)-Number(newQty||0);return next<0?null:next}
function statusFor(available,current){return available<=0?'sold':(current==='sold'?'received':(current||'received'))}
function profit(sale,item){const cost=Number(item?.unit_cost);if(!Number.isFinite(cost)||item?.unit_cost==null)return null;return Number(sale.total||0)-Number(sale.fees||0)-cost*Number(sale.quantity||0)}
function normalize(row,table){return table==='sales'
 ?{table,id:row.id,itemId:row.inventory_item_id,quantity:Number(row.quantity||0),total:Number(row.sold_price_total||0),fees:Number(row.fees||0),method:row.payment_method||'',soldAt:row.sold_at||row.created_at||'',notes:row.notes||''}
 :{table,id:row.id,itemId:row.inventory_item_id,quantity:Number(row.quantity||0),total:Number(row.sale_amount||0),fees:0,method:row.payment_method||'',soldAt:row.sold_at||row.created_at||'',notes:row.notes||''}}
function toRow(s){return s.table==='sales'
 ?{quantity:s.quantity,sold_price_total:s.total,fees:s.fees||0,payment_method:s.method||null,sold_at:s.soldAt,notes:s.notes||null}
 :{quantity:s.quantity,sale_amount:s.total,payment_method:s.method||null,sold_at:s.soldAt,notes:s.notes||null}}

const api={stockAfterEdit,statusFor,profit,normalize,toRow};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(typeof window==='undefined'||typeof document==='undefined')return;

const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say=m=>{try{typeof toast==='function'?toast(m):console.log(m)}catch(_){console.log(m)}};
function pageItems(){try{if(typeof items!=='undefined'&&Array.isArray(items))return items}catch(_){}return window.items||[]}
const localDate=iso=>{if(!iso)return '';const d=new Date(iso);if(isNaN(d))return '';const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())};
const niceDate=iso=>{const d=new Date(iso);return isNaN(d)?'':d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})};

let state={sales:[],itemMap:{},open:new Set()};

async function loadSales(){
 const out=[];
 const a=await sb.from('sales').select('*').order('sold_at',{ascending:false});
 if(a.error)throw a.error; for(const r of a.data||[])out.push(normalize(r,'sales'));
 const b=await sb.from('sales_transactions').select('*').order('sold_at',{ascending:false});
 if(!b.error)for(const r of b.data||[])out.push(normalize(r,'sales_transactions'));
 out.sort((x,y)=>String(y.soldAt).localeCompare(String(x.soldAt)));
 const map={};for(const x of pageItems())map[x.id]=x;
 const missing=[...new Set(out.map(s=>s.itemId).filter(id=>id&&!map[id]))];
 if(missing.length){const {data}=await sb.from('inventory_items').select('*').in('id',missing);for(const x of data||[])map[x.id]=x}
 state.sales=out;state.itemMap=map;
}

function saleCard(s){
 const item=state.itemMap[s.itemId]||{};const p=profit(s,item);const key=s.table+':'+s.id;
 const removed=!!item.archived_at||!pageItems().some(x=>x.id===s.itemId);
 const methodOpts=METHODS.map(([v,l])=>'<option value="'+v+'"'+(s.method===v?' selected':'')+'>'+l+'</option>').join('')+(s.method&&!METHODS.some(([v])=>v===s.method)?'<option value="'+esc(s.method)+'" selected>'+esc(s.method)+'</option>':'');
 return '<details class="sv50-sale" data-key="'+esc(key)+'"'+(state.open.has(key)?' open':'')+'>'+
  '<summary><span class="sv50-name">'+esc(item.product_name||'Item no longer in inventory')+'</span>'+
  '<span class="sv50-meta">'+s.quantity+' × · '+money(s.total)+(s.soldAt?' · '+esc(niceDate(s.soldAt)):'')+(s.method?' · '+esc((METHODS.find(([v])=>v===s.method)||[0,s.method])[1]):'')+'</span>'+
  (p!=null?'<span class="sv50-profit '+(p<0?'neg':'')+'">Profit '+money(p)+'</span>':'')+'</summary>'+
  '<div class="sv50-body">'+
   (item.upc?'<div class="muted">UPC '+esc(item.upc)+(item.unit_cost!=null?' · Cost '+money(item.unit_cost)+' each':' · No cost entered')+'</div>':'')+
   '<div class="sv50-grid">'+
    '<label>Quantity sold<input type="number" min="1" step="1" inputmode="numeric" class="sv50-qty" value="'+s.quantity+'"></label>'+
    '<label>Total sale price<input type="number" min="0" step="0.01" inputmode="decimal" class="sv50-total" value="'+s.total.toFixed(2)+'"></label>'+
    (s.table==='sales'?'<label>Fees<input type="number" min="0" step="0.01" inputmode="decimal" class="sv50-fees" value="'+(s.fees||0).toFixed(2)+'"></label>':'')+
    '<label>Payment<select class="sv50-method"><option value="">—</option>'+methodOpts+'</select></label>'+
    '<label>Date sold<input type="date" class="sv50-date" value="'+esc(localDate(s.soldAt))+'"></label>'+
    '<label class="sv50-wide">Notes<input type="text" class="sv50-notes" value="'+esc(s.notes)+'" placeholder="Buyer, pickup, discount…"></label>'+
   '</div>'+
   '<div class="sv50-actions">'+
    '<button type="button" class="btn green sv50-save">Save changes</button>'+
    (removed?'<span class="muted">This item was removed from inventory; its sale is kept for your totals.</span>':'<button type="button" class="btn sv50-open">Edit item details</button>')+
    '<button type="button" class="btn sv50-undo">Undo sale</button>'+
   '</div></div></details>';
}

function markedSoldWithoutSale(){
 const withSale=new Set(state.sales.map(s=>s.itemId));
 return pageItems().filter(x=>x.status==='sold'&&!withSale.has(x.id));
}

async function renderSold(){
 const host=$('soldlist');if(!host)return;
 host.innerHTML='<h3>Sold</h3><div class="muted">Loading sales…</div>';
 try{await loadSales()}catch(e){host.innerHTML='<h3>Sold</h3><div class="muted">Could not load sales: '+esc(e.message||e)+'</div>';return}
 const revenue=state.sales.reduce((n,s)=>n+s.total,0),units=state.sales.reduce((n,s)=>n+s.quantity,0);
 const profits=state.sales.map(s=>profit(s,state.itemMap[s.itemId])).filter(p=>p!=null);
 const extra=markedSoldWithoutSale();
 host.innerHTML='<h3>Sold</h3>'+
  '<div class="sv50-kpis"><div><b>'+state.sales.length+'</b><span>sales</span></div><div><b>'+units+'</b><span>units</span></div><div><b>'+money(revenue)+'</b><span>sold for</span></div>'+
  (profits.length?'<div><b>'+money(profits.reduce((a,b)=>a+b,0))+'</b><span>profit'+(profits.length<state.sales.length?' ('+profits.length+' with cost)':'')+'</span></div>':'')+'</div>'+
  (state.sales.length?'<p class="muted sv50-hint">Tap a sale to see or change it.</p>':'<p class="muted">No sales recorded yet. Use Scan to Sell or “Record sale” on an item.</p>')+
  state.sales.map(saleCard).join('')+
  (extra.length?'<h4 class="sv50-sub">Marked sold, no sale recorded</h4>'+extra.map(x=>'<div class="sv50-plain"><span>'+esc(x.product_name)+'</span><button type="button" class="btn sv50-openplain" data-id="'+esc(x.id)+'">Edit item details</button></div>').join(''):'');
 wire(host);
}

function readForm(card,s){
 const v=c=>card.querySelector(c);const qty=Number(v('.sv50-qty').value),total=Number(v('.sv50-total').value),fees=v('.sv50-fees')?Number(v('.sv50-fees').value):0;
 if(!Number.isInteger(qty)||qty<1)throw new Error('Enter a whole quantity of 1 or more');
 if(!Number.isFinite(total)||total<0)throw new Error('Enter a valid sale price');
 if(!Number.isFinite(fees)||fees<0)throw new Error('Enter valid fees');
 const day=v('.sv50-date').value;let soldAt=s.soldAt;
 if(day&&day!==localDate(s.soldAt)){const keep=s.soldAt?new Date(s.soldAt):new Date();const [y,m,d]=day.split('-').map(Number);keep.setFullYear(y,m-1,d);soldAt=keep.toISOString()}
 return {...s,quantity:qty,total,fees,method:v('.sv50-method').value,soldAt,notes:v('.sv50-notes').value.trim()};
}

async function adjustStock(itemId,oldQty,newQty){
 if(oldQty===newQty)return true;
 const {data:x,error}=await sb.from('inventory_items').select('available_qty,status').eq('id',itemId).single();if(error)throw error;
 const next=stockAfterEdit(x.available_qty,oldQty,newQty);
 if(next==null)throw new Error('Only '+(Number(x.available_qty||0)+oldQty)+' unit(s) of this item exist to sell');
 const up=await sb.from('inventory_items').update({available_qty:next,status:statusFor(next,x.status)}).eq('id',itemId);if(up.error)throw up.error;return true;
}

let busy=false;
async function run(label,fn){if(busy)return;busy=true;try{await fn();say(label);if(typeof load==='function')await load();else await renderSold()}catch(e){say(e.message||String(e))}finally{busy=false}}

function wire(host){
 host.querySelectorAll('.sv50-sale').forEach(card=>{
  const key=card.dataset.key,s=state.sales.find(x=>x.table+':'+x.id===key);if(!s)return;
  card.addEventListener('toggle',()=>{card.open?state.open.add(key):state.open.delete(key)});
  card.querySelector('.sv50-save').onclick=()=>run('Sale updated',async()=>{
   const next=readForm(card,s);
   await adjustStock(s.itemId,s.quantity,next.quantity);
   const {error}=await sb.from(s.table).update(toRow(next)).eq('id',s.id);
   if(error){await adjustStock(s.itemId,next.quantity,s.quantity).catch(()=>{});throw error}
  });
  const open=card.querySelector('.sv50-open');if(open)open.onclick=()=>{if(typeof openItem==='function')openItem(s.itemId)};
  const undo=card.querySelector('.sv50-undo');
  undo.onclick=()=>{
   // Two taps instead of a blocking browser dialog.
   if(undo.dataset.armed!=='1'){undo.dataset.armed='1';undo.textContent='Tap again: undo this sale and put '+s.quantity+' back in stock';undo.classList.add('sv50-armed');setTimeout(()=>{if(undo.isConnected){undo.dataset.armed='';undo.textContent='Undo sale';undo.classList.remove('sv50-armed')}},5000);return}
   run('Sale undone; '+s.quantity+' back in stock',async()=>{
    const {error}=await sb.from(s.table).delete().eq('id',s.id);if(error)throw error;
    const item=state.itemMap[s.itemId];if(item&&!item.archived_at)await adjustStock(s.itemId,s.quantity,0);
   });
  };
 });
 host.querySelectorAll('.sv50-openplain').forEach(b=>b.onclick=()=>{if(typeof openItem==='function')openItem(b.dataset.id)});
}

const style=document.createElement('style');
style.textContent='.sv50-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin:6px 0 10px}.sv50-kpis div{background:#f1f5f9;border-radius:10px;padding:8px 10px}.sv50-kpis b{display:block;font-size:18px}.sv50-kpis span{font-size:12px;color:#64748b}.sv50-hint{margin:0 0 8px}.sv50-sale{border:1px solid #dbe1e8;border-radius:12px;margin:0 0 8px;background:#fff}.sv50-sale summary{list-style:none;cursor:pointer;padding:12px 14px;display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px}.sv50-sale summary::-webkit-details-marker{display:none}.sv50-sale summary:after{content:"Edit ›";margin-left:auto;color:#2563eb;font-weight:700;font-size:13px}.sv50-sale[open] summary:after{content:"Close"}.sv50-sale summary:hover{background:#f8fafc}.sv50-name{font-weight:800;flex:1 1 280px}.sv50-meta{color:#475569;font-size:14px}.sv50-profit{font-size:13px;font-weight:700;color:#047857}.sv50-profit.neg{color:#b91c1c}.sv50-body{padding:0 14px 14px;border-top:1px solid #eef2f6}.sv50-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:10px 0}.sv50-grid label{display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600}.sv50-grid input,.sv50-grid select{min-height:40px;font-size:16px}.sv50-wide{grid-column:1/-1}.sv50-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.sv50-actions .btn{min-height:42px}.sv50-armed{background:#b91c1c!important;color:#fff!important}.sv50-sub{margin:16px 0 6px}.sv50-plain{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 14px;border:1px solid #dbe1e8;border-radius:12px;margin:0 0 8px}';
document.head.appendChild(style);

window.renderSold=renderSold;
window.StockBotSoldV50={...api,renderSold};
// Refresh when the Sold tab is opened (sales may have been recorded elsewhere).
document.querySelectorAll('.tabs button[data-view="sold"]').forEach(b=>b.addEventListener('click',()=>renderSold()));
})();
