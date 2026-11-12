/* StockBot Facebook listing review and explicit publishing handoff */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const csv=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
let queue=[];
const GROUP_URL='https://www.facebook.com/groups/2514812275660856/';
const CONDITION={'New/Sealed':'New and sealed.','Like New/Open Box':'Open box, like new.','Good':'Used, good condition.','Fair/Damaged':'Used, shows wear or damage (see photos).','Missing Parts':'Missing parts (see description).'};
// Deal Drop MI post format: item + price (+ store price) / condition / one useful line / how to claim.
function writePost(x,{marketplace=false}={}){
 const price=Number(x.listing_price||x.suggested_price)||0, retail=Number(x.unit_retail)||0;
 const title=String(x.listing_title||x.product_name||'Deal Drop MI find').trim();
 const desc=String(x.listing_description||(String(x.condition_notes||'').match(/^Description:\s*(.+)$/im)||[])[1]||'').trim();
 const short=desc.length>220?desc.slice(0,desc.lastIndexOf(' ',217)>120?desc.lastIndexOf(' ',217):217).replace(/[,;:.\s]+$/,'')+'…':desc;
 const head='🔥 '+title+' — $'+price.toFixed(2)+(retail>price*1.1?' (about $'+Math.round(retail)+' new)':'');
 const cond=CONDITION[x.condition_grade]||(x.condition_grade?x.condition_grade+'.':'');
 const lines=[head,cond,short];
 if(/car seat/i.test(title))lines.push('Never in a crash. Expiration date is on the seat label; ask and we will send a photo.');
 lines.push(marketplace?'Pickup in Grand Blanc. Message to buy. New arrivals show up first in our free group, Deal Drop MI – First Look Deals.':'Comment MINE to claim • Pickup Grand Blanc');
 return lines.filter(Boolean).join('\n');
}
const eligible=x=>Number(x.available_qty)>0&&Number(x.listing_price||x.suggested_price)>0&&x.status!=='sold';
async function refresh(){
 const wrap=$('listingQueue');if(!wrap)return;
 wrap.textContent='Loading listings…';
 const {data,error}=await sb.from('inventory_items').select('id,product_name,brand,category,upc,available_qty,condition_grade,condition_notes,suggested_price,unit_retail,price_status,listing_approval,listing_title,listing_description,listing_price,listing_updated_at,status').is('archived_at',null).order('created_at',{ascending:false});
 if(error){wrap.textContent='Could not load listings: '+error.message;return;}
 queue=data||[];
 if(!queue.length){wrap.textContent='No inventory items yet.';return;}
 wrap.innerHTML='<div class="muted">'+queue.length+' items · '+queue.filter(x=>x.listing_approval==='approved').length+' approved</div>'+queue.map(x=>
 '<div class="card" style="margin:10px 0;padding:12px"><b>'+esc(x.listing_title||x.product_name)+'</b><div class="muted">'+esc(x.brand||'Brand missing')+' · UPC '+esc(x.upc||'—')+' · Available '+Number(x.available_qty||0)+' · Price $'+Number(x.listing_price||x.suggested_price||0).toFixed(2)+'</div><div class="muted">Retail: '+esc(x.price_status||'unverified')+' · Approval: '+esc(x.listing_approval||'draft')+'</div><div class="row" style="margin-top:8px"><button class="btn" data-action="edit" data-id="'+esc(x.id)+'">Edit listing</button><button class="btn" data-action="review" data-id="'+esc(x.id)+'">Needs changes</button><button class="btn primary" data-action="approve" data-id="'+esc(x.id)+'" '+(!eligible(x)?'disabled':'')+'>Approve</button><button class="btn" data-action="draft" data-id="'+esc(x.id)+'">Draft</button><button class="btn primary" data-action="publish" data-id="'+esc(x.id)+'" '+(x.listing_approval!=='approved'||!eligible(x)?'disabled':'')+'>Publish to Facebook ↗</button><button class="btn" data-action="omni" data-id="'+esc(x.id)+'" '+(x.listing_approval!=='approved'||!eligible(x)?'disabled':'')+'>Send to Facebook Page (Omni Social)</button><button class="btn" data-action="group" data-id="'+esc(x.id)+'" '+(x.listing_approval!=='approved'||!eligible(x)?'disabled':'')+'>Post to Group ↗</button></div></div>'
 ).join('');
 wrap.querySelectorAll('button[data-action]').forEach(b=>b.onclick=async()=>{
  const x=queue.find(v=>v.id===b.dataset.id);if(!x)return;
  if(b.dataset.action==='edit'){
   const title=prompt('Facebook listing title',x.listing_title||x.product_name);if(title===null)return;
   const description=prompt('Facebook listing description',x.listing_description||x.condition_notes||'');if(description===null)return;
   const price=prompt('Facebook asking price',String(x.listing_price||x.suggested_price||''));if(price===null)return;
   if(!title.trim()||!Number.isFinite(Number(price))||Number(price)<=0){alert('Enter a title and a positive price.');return;}
   const {error}=await sb.from('inventory_items').update({listing_title:title.trim(),listing_description:description.trim(),listing_price:Number(price),listing_approval:'draft',listing_approved_at:null,listing_updated_at:new Date().toISOString()}).eq('id',x.id);
   if(error)alert(error.message);else await refresh();return;
  }
  if(b.dataset.action==='omni'){
   if(x.listing_approval!=='approved'||!eligible(x))return;
   const popup=window.open('about:blank','_blank');
   if(!popup){alert('Allow pop-ups for StockBot to send a listing to Omni Social.');return;}
   popup.document.write('<title>Preparing Omni Social draft…</title><p style="font:16px system-ui;padding:24px">Preparing approved listing for Omni Social…</p>');
   try{
    const {data:photos,error:photoError}=await sb.from('inventory_photos').select('storage_path').eq('inventory_item_id',x.id).order('sort_order',{ascending:true}).order('created_at',{ascending:true}).limit(10);
    if(photoError)throw photoError;
    const mediaUrls=[];
    for(const photo of photos||[]){
     if(!photo.storage_path)continue;
     const {data,error}=await sb.storage.from('inventory-photos').createSignedUrl(photo.storage_path,31536000);
     if(error)continue;
     if(data?.signedUrl)mediaUrls.push(data.signedUrl);
    }
    const title=x.listing_title||x.product_name||'Marketplace listing';
    const noteDesc=(String(x.condition_notes||'').match(/^Description:\s*(.+)$/im)||[])[1]||'';
    const caption=writePost(x);
    const payload={version:1,source:'stockbot',sourceId:x.id,updatedAt:x.listing_updated_at||null,sentAt:new Date().toISOString(),targetClientName:'Deal Drop MI',title,caption,platforms:['facebook'],mediaUrls};
    const destination='https://omnisocial.pages.dev/#stockbot='+encodeURIComponent(JSON.stringify(payload));
    popup.opener=null;popup.location.replace(destination);
   }catch(error){
    popup.close();
    alert('Could not prepare the Omni Social draft: '+(error?.message||error));
   }
   return;
  }
  if(b.dataset.action==='group'){
   // Meta has no API for posting into Groups, so this is a guided manual post: copy text, open the group.
   if(x.listing_approval!=='approved'||!eligible(x))return;
   const KEY='stockbot-fb-group-url';let url=GROUP_URL;try{url=localStorage.getItem(KEY)||GROUP_URL}catch(_){}
   if(!url){url=(prompt('Paste the Deal Drop MI – First Look Deals group link (saved on this device):','https://www.facebook.com/groups/')||'').trim();if(!/^https:\/\/(www\.|m\.)?facebook\.com\/groups\/[^/?#]+/i.test(url)){if(url)alert('That is not a Facebook group link.');return;}try{localStorage.setItem(KEY,url)}catch(_){}}
   const noteDesc=(String(x.condition_notes||'').match(/^Description:\s*(.+)$/im)||[])[1]||'';
   const body=writePost(x);
   try{await navigator.clipboard.writeText(body);alert('Group post text copied. The group will open — paste the text, add the item photos from StockBot, and post.');}catch(e){prompt('Copy this group post:',body);}
   window.open(url,'_blank','noopener,noreferrer');return;
  }
  if(b.dataset.action==='publish'){
   if(x.listing_approval!=='approved'||!eligible(x))return;
   const body=writePost(x,{marketplace:true});
   try{await navigator.clipboard.writeText(body);alert('Listing copied. Facebook Marketplace will open. Paste the listing, attach photos and confirm publishing there.');}catch(e){prompt('Copy listing details:',body);}
   window.open('https://www.facebook.com/marketplace/create/item','_blank','noopener,noreferrer');return;
  }
  const state={approve:'approved',review:'needs_changes',draft:'draft'}[b.dataset.action];if(!state)return;
  b.disabled=true;
  const {error}=await sb.from('inventory_items').update({listing_approval:state,listing_approved_at:state==='approved'?new Date().toISOString():null}).eq('id',x.id);
  if(error){alert(error.message);b.disabled=false;return;}await refresh();
 });
}
function download(){
 const rows=queue.filter(x=>x.listing_approval==='approved'&&eligible(x));if(!rows.length){alert('No approved listings with available stock.');return;}
 const head=['UPC','Title','Brand','Category','Condition','Description','Price','Available Quantity','Retail Price Status'];
 const data=[head.map(csv).join(','),...rows.map(x=>[x.upc,x.listing_title||x.product_name,x.brand,x.category,x.condition_grade,x.listing_description||x.condition_notes,x.listing_price||x.suggested_price,x.available_qty,x.price_status].map(csv).join(','))].join('\r\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'}));a.download='StockBot-Approved-Facebook-Listings.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
}
document.addEventListener('click',e=>{if(e.target?.id==='listingRefresh')refresh();if(e.target?.id==='listingDownloadApproved')download();if(e.target?.dataset?.view==='exports')setTimeout(refresh,0);});
})();