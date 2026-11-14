/* StockBot v49 — saved-photo management: primary photo, reorder, remove, replace.
   Photo order is inventory_photos.sort_order (0 = primary). Uploads still go through the
   stockbot-photo edge function, which appends new photos at the end. */
(()=>{'use strict';

// Pure helpers (also exported for node tests).
function orderRows(rows){
 return [...(rows||[])].sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0)||String(a.created_at||'').localeCompare(String(b.created_at||''))||String(a.id).localeCompare(String(b.id)));
}
// Returns [{id,sort_order}] for rows whose position must change so order is 0..n-1.
function renumber(rows){return orderRows(rows).map((r,i)=>({id:r.id,sort_order:i,changed:Number(r.sort_order)!==i})).filter(r=>r.changed).map(({id,sort_order})=>({id,sort_order}))}
function move(rows,id,delta){
 const list=orderRows(rows),i=list.findIndex(r=>String(r.id)===String(id)),j=i+delta;
 if(i<0||j<0||j>=list.length)return list;
 const out=list.slice();[out[i],out[j]]=[out[j],out[i]];return out;
}
function makePrimary(rows,id){
 const list=orderRows(rows),i=list.findIndex(r=>String(r.id)===String(id));
 if(i<=0)return list;
 return [list[i],...list.slice(0,i),...list.slice(i+1)];
}
function positions(list){return list.map((r,i)=>({id:r.id,sort_order:i,changed:Number(r.sort_order)!==i})).filter(r=>r.changed).map(({id,sort_order})=>({id,sort_order}))}

const api={orderRows,renumber,move,makePrimary,positions};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(typeof window==='undefined'||typeof document==='undefined')return;

const $=id=>document.getElementById(id);
const say=m=>typeof window.toast==='function'?window.toast(m):console.log(m);
const BUCKET='inventory-photos';
const FN='https://aiwdfltusdzhrrbblvfi.supabase.co/functions/v1/stockbot-photo';

async function fetchRows(itemId){
 const {data,error}=await sb.from('inventory_photos').select('id,storage_path,sort_order,created_at').eq('inventory_item_id',itemId);
 if(error)throw error;return orderRows(data);
}
async function savePositions(updates){
 for(const u of updates){const {error}=await sb.from('inventory_photos').update({sort_order:u.sort_order}).eq('id',u.id);if(error)throw error}
}
async function removePhoto(row){
 const {error}=await sb.from('inventory_photos').delete().eq('id',row.id);if(error)throw error;
 const removed=await sb.storage.from(BUCKET).remove([row.storage_path]);if(removed.error)console.warn('Photo row removed; storage cleanup failed',removed.error);
}
async function uploadOne(itemId,file){
 const dataUrl=await window.optimizePhoto(file);
 const session=(await sb.auth.getSession()).data.session;if(!session)throw new Error('Please sign in again');
 const res=await fetch(FN,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({item_id:itemId,data_url:dataUrl})});
 const out=await res.json().catch(()=>({}));if(!res.ok||!out.ok)throw new Error(out.error||'Photo upload failed ('+res.status+')');
 return out.path;
}
async function replacePhoto(itemId,row,file){
 const newPath=await uploadOne(itemId,file);
 const rows=await fetchRows(itemId);const fresh=rows.find(r=>r.storage_path===newPath);
 if(!fresh)throw new Error('Uploaded photo could not be found');
 // New photo takes the old one's position, then the old photo is removed.
 const without=rows.filter(r=>r.id!==fresh.id);const at=without.findIndex(r=>r.id===row.id);
 const list=without.slice();list.splice(Math.max(0,at),0,fresh);
 await savePositions(positions(list.filter(r=>r.id!==row.id)));
 await removePhoto(row);
}

let busy=false;
async function run(itemId,label,fn){
 if(busy)return;busy=true;const wrap=$('savedPhotosWrap');wrap?.classList.add('pm49-busy');
 try{await fn();say(label)}catch(e){console.error('Photo manager',e);say('Photo update failed: '+(e.message||e))}
 finally{busy=false;wrap?.classList.remove('pm49-busy');await loadSavedPhotos(itemId)}
}

// Header with add buttons. For a saved item, picked photos upload right away (no need to tap Save).
function header(count){
 return '<div class="pm49-head"><div><div class="savedPhotoTitle">Photos'+(count?' ('+count+')':'')+'</div>'+(count?'<div class="muted pm49-sub">The first photo is the main listing photo. Use the buttons under a photo to change it.</div>':'')+'</div>'+
  '<div class="pm49-add"><button type="button" class="btn blue pm49-addlib">🖼 Add photos</button><button type="button" class="btn pm49-addcam">📷 Take photo</button></div></div>';
}
async function uploadPicked(itemId){
 if(typeof window.saveSelectedPhotos!=='function')return;
 const wrap=$('savedPhotosWrap');wrap?.classList.add('pm49-busy');
 try{await window.saveSelectedPhotos(itemId)}catch(e){say('Photo upload failed: '+(e.message||e))}
 finally{wrap?.classList.remove('pm49-busy');await loadSavedPhotos(itemId)}
}
function wireAdd(itemId){
 const wrap=$('savedPhotosWrap');if(!wrap)return;
 const pick=(inputId)=>{const input=$(inputId);if(!input)return;
  // Upload once the existing intake handler has queued the picked files.
  const once=()=>{input.removeEventListener('change',once);setTimeout(()=>uploadPicked(itemId),0)};
  input.addEventListener('change',once);input.click()};
 wrap.querySelector('.pm49-addlib')?.addEventListener('click',()=>pick('itemPhotos'));
 wrap.querySelector('.pm49-addcam')?.addEventListener('click',()=>pick('cameraPhotoInput'));
}
async function loadSavedPhotos(itemId){
 const wrap=$('savedPhotosWrap');if(!wrap||!itemId)return;
 wrap.innerHTML=header(0)+'<div class="muted">Loading…</div>';wireAdd(itemId);
 let rows;
 try{rows=await fetchRows(itemId)}catch(e){wrap.innerHTML=header(0)+'<div class="muted">Could not load saved photos.</div>';wireAdd(itemId);return}
 // Heal gaps/duplicates left by older deletes so "primary" and ordering are unambiguous.
 const fix=renumber(rows);if(fix.length){try{await savePositions(fix);rows=await fetchRows(itemId)}catch(e){console.warn('Could not renumber photos',e)}}
 if(!rows.length){wrap.innerHTML=header(0)+'<div class="pm49-empty">No photos yet. Add 2–3: the whole item, the box or label, and any damage.</div>';wireAdd(itemId);return}
 const signed=await Promise.all(rows.map(async row=>{
  try{const [small,large]=await Promise.all([sb.storage.from(BUCKET).createSignedUrl(row.storage_path,3600,{transform:{width:320,height:320,resize:'cover',quality:64}}),sb.storage.from(BUCKET).createSignedUrl(row.storage_path,3600)]);
   return {thumb:small.data?.signedUrl||large.data?.signedUrl||'',full:large.data?.signedUrl||small.data?.signedUrl||'',row}}catch(_){return {thumb:'',full:'',row}}
 }));
 const viewable=signed.filter(p=>p.full);
 wrap.innerHTML=header(rows.length)+'<div class="pm49-grid">'+signed.map((p,i)=>
  '<div class="pm49-tile'+(i===0?' pm49-primary':'')+'" data-id="'+p.row.id+'">'+
  '<button type="button" class="pm49-img" data-i="'+i+'" aria-label="View photo '+(i+1)+' larger">'+(p.thumb?'<img loading="lazy" decoding="async" src="'+p.thumb+'" alt="Photo '+(i+1)+'">':'<span class="muted">Unavailable</span>')+'</button>'+
  (i===0?'<span class="pm49-badge">Main photo</span>':'<span class="pm49-badge pm49-num">'+(i+1)+'</span>')+
  '<div class="pm49-tools">'+
   (i>0?'<button type="button" data-act="primary" class="pm49-wide">★ Make main photo</button>':'')+
   '<button type="button" data-act="left"'+(i===0?' disabled':'')+'>◀ Move</button>'+
   '<button type="button" data-act="right"'+(i===signed.length-1?' disabled':'')+'>Move ▶</button>'+
   '<button type="button" data-act="replace">Replace</button>'+
   '<button type="button" data-act="remove" class="pm49-del">Delete</button>'+
  '</div></div>').join('')+'</div><input type="file" accept="image/*" id="pm49Replace" class="hidden">';
 wireAdd(itemId);
 wrap.querySelectorAll('.pm49-img').forEach(b=>b.onclick=()=>{const i=+b.dataset.i,target=signed[i];if(!target.full)return;const k=viewable.indexOf(target);if(typeof window.openSavedPhoto==='function')window.openSavedPhoto(viewable,Math.max(0,k),itemId)});
 wrap.querySelectorAll('.pm49-tools button').forEach(b=>b.onclick=e=>{
  e.stopPropagation();const id=b.closest('.pm49-tile').dataset.id,row=rows.find(r=>String(r.id)===id);if(!row)return;
  const act=b.dataset.act;
  if(act==='primary')return run(itemId,'Primary photo updated',()=>savePositions(positions(makePrimary(rows,id))));
  if(act==='left'||act==='right')return run(itemId,'Photo order saved',()=>savePositions(positions(move(rows,id,act==='left'?-1:1))));
  if(act==='remove'){
   // Two-tap confirm instead of a blocking browser dialog.
   if(b.dataset.armed!=='1'){b.dataset.armed='1';b.textContent='Tap to delete';b.classList.add('pm49-armed');setTimeout(()=>{if(b.isConnected){b.dataset.armed='';b.textContent='Delete';b.classList.remove('pm49-armed')}},4000);return}
   return run(itemId,'Photo deleted',async()=>{await removePhoto(row);await savePositions(renumber((await fetchRows(itemId))))});
  }
  if(act==='replace'){const input=$('pm49Replace');input.onchange=()=>{const f=input.files?.[0];input.value='';if(f)run(itemId,'Photo replaced',()=>replacePhoto(itemId,row,f))};input.click()}
 });
}

const style=document.createElement('style');style.textContent='#savedPhotosWrap{scroll-margin-top:90px}.pm49-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:10px;margin:4px 0 10px}.pm49-sub{font-size:13px;margin-top:2px}.pm49-add{display:flex;gap:8px;flex-wrap:wrap}.pm49-add .btn{min-height:42px;padding:8px 14px}.pm49-empty{padding:14px;border:2px dashed #cbd5e1;border-radius:12px;color:#475569;text-align:center}.pm49-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;max-width:920px}.pm49-tile{position:relative;background:#f1f5f9;border-radius:12px;padding:6px;border:2px solid transparent}.pm49-primary{border-color:#10b981}.pm49-img{display:block;width:100%;aspect-ratio:1/1;padding:0;border:0;border-radius:9px;overflow:hidden;background:#e5e7eb;cursor:zoom-in}.pm49-img img{display:block;width:100%;height:100%;object-fit:cover}.pm49-badge{position:absolute;top:10px;left:10px;background:#10b981;color:#fff;font-size:12px;font-weight:800;padding:3px 8px;border-radius:999px}.pm49-num{background:#334155}.pm49-tools{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:6px}.pm49-tools button{min-height:38px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;font-weight:700;font-size:13px;padding:4px 6px;cursor:pointer;color:#0f172a}.pm49-tools button:hover{background:#f8fafc}.pm49-tools .pm49-wide{grid-column:1/-1;background:#ecfdf5;border-color:#a7f3d0;color:#065f46}.pm49-tools button:disabled{opacity:.35;cursor:default}.pm49-tools .pm49-del{color:#b91c1c;border-color:#fecaca}.pm49-tools .pm49-armed{background:#b91c1c;color:#fff;border-color:#b91c1c}.pm49-busy{opacity:.6;pointer-events:none}@media(max-width:600px){.pm49-grid{grid-template-columns:repeat(2,1fr);gap:8px}.pm49-tools button{min-height:42px;font-size:12px}.pm49-add{width:100%}.pm49-add .btn{flex:1}}';document.head.appendChild(style);

window.loadSavedPhotos=loadSavedPhotos;
window.StockBotPhotoManagerV49={...api,loadSavedPhotos,removePhoto,replacePhoto};
})();
