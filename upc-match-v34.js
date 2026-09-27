/* StockBot v34 — robust UPC matching without touching camera */
(()=>{'use strict';
const digits=v=>String(v??'').replace(/\D/g,'');
function variants(v){const d=digits(v),s=new Set();if(!d)return s;s.add(d);s.add(d.replace(/^0+/,''));if(d.length===13&&d[0]==='0')s.add(d.slice(1));if(d.length===12)s.add('0'+d);if(d.length===8&&d[0]==='0')s.add(d.slice(1));return s}
function same(a,b){const A=variants(a),B=variants(b);for(const x of A)if(x&&B.has(x))return true;return false}
function findInventory(upc){return (window.items||[]).find(x=>!x.archived_at&&same(x.upc,upc))||null}
const previous=window.handleScannedUPC;
window.handleScannedUPC=async function(code,target){const d=digits(code);const item=findInventory(d);
 if(target==='sale'||window.scanTarget==='sale'){
   if(item&&window.StockBotSalesV32?.choose){await window.StockBotSalesV32.choose(item.upc);window.scanTarget='lookup';return}
   try{toast('Scanned '+d+' — item not found in current inventory')}catch(_){}window.scanTarget='lookup';return;
 }
 if(item){const input=document.getElementById('lookup');if(input)input.value=item.upc;try{openItem(item.id)}catch(_){if(previous)return previous(item.upc,target)}return}
 if(previous)return previous(d,target);
};
// Make manual Find use the same UPC normalization as scanning.
const findBtn=document.getElementById('find');if(findBtn){const old=findBtn.onclick;findBtn.onclick=()=>{const q=digits(document.getElementById('lookup')?.value);const item=q?findInventory(q):null;if(item){openItem(item.id);return}if(old)old()}}
window.StockBotUPCMatchV34={same,findInventory,variants};
})();