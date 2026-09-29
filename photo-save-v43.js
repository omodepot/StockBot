/* StockBot v44 — persistent inventory photos. Scanner/product lookup untouched. */
(()=>{'use strict';
const $=id=>document.getElementById(id);let pending=[];let busy=false,lastEditorKey='';
function capture(e){if(e.target?.id!=='photos')return;const files=Array.from(e.target.files||[]);if(files.length){pending.push(...files);window.pendingPhotos=pending.slice();} }
document.addEventListener('change',capture,true);
async function session(){const {data}=await sb.auth.getSession();if(!data.session)throw new Error('Please sign in again');return data.session}
async function resolveItemId(){
 const s=await session();const upc=$('pupc')?.value?.trim()||'';const name=$('pname')?.value?.trim()||'';
 let q=sb.from('inventory_items').select('id,upc,product_name,created_at').eq('owner_id',s.user.id).order('created_at',{ascending:false}).limit(10);
 if(upc)q=q.eq('upc',upc);else if(name)q=q.eq('product_name',name);else return null;
 const {data,error}=await q;if(error)throw error;return data?.[0]?.id||null;
}
async function uploadFiles(itemId,files){
 if(!itemId||!files.length||busy)return 0;busy=true;
 try{const s=await session();const {data:existing,error:exErr}=await sb.from('inventory_photos').select('id').eq('inventory_item_id',itemId);if(exErr)throw exErr;let order=(existing||[]).length,count=0;
  for(const file of files){const ext=((file.name||'photo.jpg').split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase()||'jpg';const path=s.user.id+'/'+itemId+'/'+Date.now()+'-'+Math.random().toString(36).slice(2)+'.'+ext;
   const {error:upErr}=await sb.storage.from('inventory-photos').upload(path,file,{contentType:file.type||'image/jpeg',upsert:false});if(upErr)throw upErr;
   const {error:rowErr}=await sb.from('inventory_photos').insert({owner_id:s.user.id,inventory_item_id:itemId,storage_path:path,sort_order:order++});if(rowErr){await sb.storage.from('inventory-photos').remove([path]);throw rowErr}count++;}
  return count;
 }finally{busy=false}
}
async function signed(path){const {data,error}=await sb.storage.from('inventory-photos').createSignedUrl(path,3600);return error?'':data?.signedUrl||''}
async function showSaved(){
 if(!$('photos')||!$('product')?.classList.contains('editorOpen'))return;let id;try{id=await resolveItemId()}catch(_){return}if(!id)return;
 const key=id+':'+($('pupc')?.value||'');if(key===lastEditorKey&&$('savedPhotoCloud'))return;lastEditorKey=key;
 const {data,error}=await sb.from('inventory_photos').select('*').eq('inventory_item_id',id).order('sort_order');if(error)return;
 let box=$('savedPhotoCloud');if(!box){box=document.createElement('div');box.id='savedPhotoCloud';box.style.marginTop='8px';const input=$('photos');input.parentElement.appendChild(box)}
 if(!data?.length){box.innerHTML='';return}const urls=[];for(const p of data){const u=await signed(p.storage_path);if(u)urls.push(u)}box.innerHTML=urls.length?'<div class="muted" style="margin:6px 0">Saved photos</div><div class="photoPreview">'+urls.map(u=>'<img src="'+u+'" alt="Saved inventory photo">').join('')+'</div>':'';
}
async function savePhotosAfterCore(files){
 if(!files.length)return;let id=null;for(let i=0;i<20&&!id;i++){await new Promise(r=>setTimeout(r,i?200:350));try{id=await resolveItemId()}catch(e){if(i===19)throw e}}
 if(!id)throw new Error('Could not match photos to the saved inventory item');const count=await uploadFiles(id,files);pending=pending.filter(f=>!files.includes(f));window.pendingPhotos=pending.slice();if(count){toast(count+' photo'+(count===1?'':'s')+' saved to cloud');lastEditorKey='';await showSaved()}
}
function hook(){
 const save=$('save');if(save&&!save.dataset.photoV44){save.dataset.photoV44='1';save.addEventListener('click',()=>{const files=pending.slice();if(!files.length)return;setTimeout(()=>savePhotosAfterCore(files).catch(e=>{console.error('photo save',e);toast('Photo save failed: '+(e.message||e))}),0)},true)}
 showSaved();
}
new MutationObserver(()=>setTimeout(hook,0)).observe(document.documentElement,{childList:true,subtree:true});hook();window.StockBotPhotosV44={showSaved,resolveItemId};
})();