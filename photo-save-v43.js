/* StockBot v45 — photo persistence fix. Scanner/product lookup untouched. */
(()=>{'use strict';
let pending=[];let busy=false;const el=id=>document.getElementById(id);
function toastMsg(s){if(typeof window.toast==='function')window.toast(s);else console.log(s)}
function capture(e){if(e.target?.id!=='itemPhotos')return;const files=Array.from(e.target.files||[]);if(files.length){pending.push(...files);window.pendingPhotos=pending.slice();}}
document.addEventListener('change',capture,true);
async function getSession(){const {data,error}=await sb.auth.getSession();if(error)throw error;if(!data.session)throw new Error('Please sign in again');return data.session}
async function resolveItemId(){
 if(window.current?.id)return window.current.id;
 const s=await getSession();const upc=(window.current?.upc||el('pupc')?.value||'').trim();const name=(window.current?.product_name||el('pname')?.value||'').trim();
 let q=sb.from('inventory_items').select('id,upc,product_name,created_at').eq('owner_id',s.user.id).order('created_at',{ascending:false}).limit(10);
 if(upc)q=q.eq('upc',upc);else if(name)q=q.eq('product_name',name);else return null;
 const {data,error}=await q;if(error)throw error;return data?.[0]?.id||null;
}
async function upload(itemId,files){if(busy||!itemId||!files.length)return 0;busy=true;try{
 const s=await getSession();const {data:rows,error:rerr}=await sb.from('inventory_photos').select('id').eq('inventory_item_id',itemId);if(rerr)throw rerr;let sort=(rows||[]).length,count=0;
 for(const file of files){const ext=((file.name||'photo.jpg').split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase()||'jpg';const path=`${s.user.id}/${itemId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const {error:upErr}=await sb.storage.from('inventory-photos').upload(path,file,{contentType:file.type||'image/jpeg',upsert:false});if(upErr)throw upErr;
  const {error:dbErr}=await sb.from('inventory_photos').insert({owner_id:s.user.id,inventory_item_id:itemId,storage_path:path,sort_order:sort++});if(dbErr){await sb.storage.from('inventory-photos').remove([path]);throw dbErr}count++;
 }return count;
}finally{busy=false}}
async function savePending(files){let id=null;for(let i=0;i<25&&!id;i++){if(i)await new Promise(r=>setTimeout(r,160));id=await resolveItemId()}if(!id)throw new Error('Saved item could not be identified');const count=await upload(id,files);pending=pending.filter(f=>!files.includes(f));window.pendingPhotos=pending.slice();if(count)toastMsg(`${count} photo${count===1?'':'s'} saved to cloud`);return count}
function hook(){const save=el('save');if(!save||save.dataset.photoV45)return;save.dataset.photoV45='1';save.addEventListener('click',()=>{const input=el('itemPhotos');const files=pending.length?pending.slice():Array.from(input?.files||[]);if(!files.length)return;setTimeout(()=>savePending(files).catch(e=>{console.error('StockBot photo save',e);toastMsg('Photo save failed: '+(e.message||e))}),250)},false)}
new MutationObserver(hook).observe(document.documentElement,{childList:true,subtree:true});hook();window.StockBotPhotosV45={resolveItemId,savePending};
})();