/* StockBot v43 — persistent inventory photos only. Scanner/product lookup untouched. */
(()=>{'use strict';
const $=id=>document.getElementById(id);let pending=[];let busy=false;
function capture(e){if(e.target?.id!=='photos')return;pending=Array.from(e.target.files||[]);window.pendingPhotos=pending;}
document.addEventListener('change',capture,true);
async function upload(itemId){
 if(!itemId||!pending.length||busy)return {count:0}; busy=true;
 try{
  const {data:{session}}=await sb.auth.getSession(); if(!session)throw new Error('Please sign in again');
  let count=0;
  const {data:existing}=await sb.from('inventory_photos').select('id').eq('inventory_item_id',itemId);
  let order=(existing||[]).length;
  for(const file of pending){
   const ext=((file.name||'photo.jpg').split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase()||'jpg';
   const path=session.user.id+'/'+itemId+'/'+Date.now()+'-'+Math.random().toString(36).slice(2)+'.'+ext;
   const {error:upErr}=await sb.storage.from('inventory-photos').upload(path,file,{contentType:file.type||'image/jpeg',upsert:false});
   if(upErr)throw upErr;
   const {error:rowErr}=await sb.from('inventory_photos').insert({owner_id:session.user.id,inventory_item_id:itemId,storage_path:path,sort_order:order++});
   if(rowErr){try{await sb.storage.from('inventory-photos').remove([path])}catch(_){};throw rowErr}
   count++;
  }
  pending=[];window.pendingPhotos=[];const input=$('photos');if(input)input.value='';
  return {count};
 }finally{busy=false}
}
function hook(){
 const save=$('save');if(!save||save.dataset.photoV43)return;save.dataset.photoV43='1';
 save.addEventListener('click',()=>{
  if(!pending.length)return;
  const files=pending.slice();
  let tries=0;
  const wait=async()=>{tries++;const id=window.current?.id||window.currentItem?.id||window.current?.inventory_item_id;if(id){pending=files;try{const r=await upload(id);if(r.count)toast(r.count+' photo'+(r.count===1?'':'s')+' saved to cloud')}catch(e){console.error('photo save',e);toast('Photo save failed: '+(e.message||e))}return}if(tries<30)setTimeout(wait,200);else toast('Item saved, but photos could not be attached')};
  setTimeout(wait,100);
 },true);
}
new MutationObserver(hook).observe(document.documentElement,{childList:true,subtree:true});hook();
window.StockBotPhotosV43={upload,getPending:()=>pending.slice()};
})();