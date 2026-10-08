/* StockBot listing approval queue. No automatic Facebook publishing. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const csv=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
let queue=[];
async function refresh(){
 const wrap=$('listingQueue');if(!wrap)return;
 wrap.textContent='Loading listings…';
 const {data,error}=await sb.from('inventory_items').select('id,product_name,brand,category,upc,available_qty,condition_grade,condition_notes,suggested_price,unit_retail,price_status,listing_approval,listing_title,listing_description,listing_price,status').order('created_at',{ascending:false});
 if(error){wrap.textContent='Could not load listings: '+error.message;return;}
 queue=data||[];
 if(!queue.length){wrap.textContent='No inventory items yet.';return;}
 wrap.innerHTML='<div class="muted">'+queue.length+' items · '+queue.filter(x=>x.listing_approval==='approved').length+' approved</div>'+queue.map(x=>{
 const valid=Number(x.available_qty)>0&&Number(x.suggested_price)>0&&x.status!=='sold';
 return '<div class="card" style="margin:10px 0;padding:12px"><b>'+esc(x.product_name)+'</b><div class="muted">'+esc(x.brand||'Brand missing')+' · UPC '+esc(x.upc||'—')+' · Available '+Number(x.available_qty||0)+' · Price $'+Number(x.listing_price||x.suggested_price||0).toFixed(2)+'</div><div class="muted">Retail: '+esc(x.price_status||'unverified')+' · Approval: '+esc(x.listing_approval||'draft')+'</div><div class="row" style="margin-top:8px"><button class="btn" data-action="review" data-id="'+esc(x.id)+'">Needs changes</button><button class="btn primary" data-action="approve" data-id="'+esc(x.id)+'" '+(!valid?'disabled title="Requires stock and suggested price"':'')+'>Approve listing</button><button class="btn" data-action="draft" data-id="'+esc(x.id)+'">Reset to draft</button></div></div>';
 }).join('');
 wrap.querySelectorAll('button[data-action]').forEach(b=>b.onclick=async()=>{
  const state={approve:'approved',review:'needs_changes',draft:'draft'}[b.dataset.action];if(!state)return;
  b.disabled=true;
  const {error}=await sb.from('inventory_items').update({listing_approval:state,listing_approved_at:state==='approved'?new Date().toISOString():null}).eq('id',b.dataset.id);
  if(error){alert('Approval could not be saved: '+error.message);b.disabled=false;return;}
  await refresh();
 });
}
function download(){
 const rows=queue.filter(x=>x.listing_approval==='approved'&&Number(x.available_qty)>0&&x.status!=='sold');
 if(!rows.length){alert('No approved, available listings to export.');return;}
 const head=['UPC','Title','Brand','Category','Condition','Description','Price','Available Quantity','Retail Price Status'];
 const data=[head.map(csv).join(','),...rows.map(x=>[x.upc,x.listing_title||x.product_name,x.brand,x.category,x.condition_grade,x.listing_description||x.condition_notes,x.listing_price||x.suggested_price,x.available_qty,x.price_status].map(csv).join(','))].join('\r\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'}));a.download='StockBot-Approved-Facebook-Listings.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
}
document.addEventListener('click',e=>{if(e.target?.id==='listingRefresh')refresh();if(e.target?.id==='listingDownloadApproved')download();if(e.target?.dataset?.view==='exports')setTimeout(refresh,0);});
})();