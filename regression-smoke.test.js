'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=name=>fs.readFileSync(new URL(name,'file://'+__dirname+'/'),'utf8');
const html=read('index.html');
const scanner=read('scanner-v12.js');
const dashboard=read('inventory-dashboard-v26.js');
const listings=read('listing-queue-v1.js');
const repair=read('stockbot-repair-v48.js');
const photoIntake=read('photo-intake-v49.js');
const upcMatch=read('upc-match-v34.js');

// Receive, editing, UPC, and photo persistence contracts.
assert.match(html,/function saveItem\(/);
assert.match(html,/inventory_items'\)\.update\(payload\)\.eq\('id',current\.id\)/);
assert.match(scanner+html,/handleScannedUPC/);
assert.match(html,/stockbot-photo/);
assert.match(html,/saveSelectedPhotos/);
assert.match(html,/photo-intake-v49\.js\?v=49/);
assert.match(html,/upc-match-v34\.js\?v=49/);
assert.match(photoIntake,/pending=mergeFiles\(pending,files\)/);
assert.match(photoIntake,/attempt<=3/);
assert.match(photoIntake,/Saving photo/);
assert.match(scanner,/BarcodeDetector/);
assert.match(scanner,/ZXingBrowser/);
assert.match(scanner,/decoderStarted/);
assert.match(upcMatch,/function variants/);
assert.match(repair,/product_name,product\.title/);
assert.match(repair,/image_url,product\.image/);

// Permanent deletion is exact-item, exact-owner, confirmed, and refreshes the list.
assert.match(repair,/Permanently Delete Item\?/);
assert.match(repair,/Cancel/);
assert.match(repair,/Delete Permanently/);
assert.match(repair,/delete\(\)\.eq\('id',item\.id\)\.eq\('owner_id',user\.id\)\.select\('id'\)/);
assert.match(repair,/await load\(\);showView\('inventory'\)/);

// Inventory list, CSV/photo exports, and controlled Facebook/Omni handoff remain wired.
assert.match(dashboard,/renderSheet/);
assert.match(dashboard,/Download Spreadsheet \(CSV\)/);
assert.match(html,/downloadPhotoInventory/);
assert.match(listings,/listing_approval!=='approved'/);
assert.match(listings,/Send to Facebook Page \(Omni Social\)/);assert.match(listings,/data-action="group"/);
assert.match(listings,/targetClientName:'Deal Drop MI'/);
assert.match(listings,/facebook\.com\/marketplace\/create\/item/);
console.log('StockBot regression smoke tests passed');

// v49 repairs
const photos=read('photo-manager-v49.js');const enh=read('enhancements-v13.js');const manifest=read('manifest-import-v27.js');
const loaded=[...html.matchAll(/<script src="\.\/([^"?]+)/g)].map(m=>m[1]);
for(const f of ['listing-queue-v1.js','scanner-v12.js','enhancements-v13.js','upc-match-v34.js','inventory-dashboard-v26.js','manifest-import-v27.js','stockbot-repair-v48.js','photo-manager-v49.js','photo-intake-v49.js'])assert.ok(loaded.includes(f),f+' must be loaded');
assert.ok(loaded.indexOf('photo-manager-v49.js')>loaded.indexOf('stockbot-repair-v48.js'));
assert.ok(loaded.indexOf('photo-intake-v49.js')>loaded.indexOf('photo-manager-v49.js'));
assert.match(photos,/window\.loadSavedPhotos=loadSavedPhotos/);
assert.match(enh,/if\(target==='sale'\)/,'camera scans in Scan to Sell must reach the sale dialog');
assert.match(html,/is\('archived_at',null\)/,'archived items must stay out of inventory');
assert.match(html,/<label>Product name<\/label><input id=pname/);
assert.doesNotMatch(html,/isNew\?\$\('pname'\)/,'saved items must keep edited product names');
assert.match(dashboard,/from\('sales'\)\.insert\(sale\)/,'dashboard sales must use the canonical sales table');
assert.match(repair,/archiveItem/);assert.match(repair,/recorded sales/);
assert.match(listings,/order\('sort_order'/);
// Regex literals in plain .js/.html must not be double-escaped (\\D matches a backslash, not non-digits).
for(const [name,src] of [['index.html',html],['dashboard',dashboard],['listings',listings],['manifest',manifest],['enhancements',enh]]){
 assert.doesNotMatch(src,/\/[^/\n]*\\\\[dDsSnr][^/\n]*\/[gimsuy]*[.,;)]/,name+' contains a double-escaped regex literal');
}
assert.doesNotMatch(listings,/join\('\\\\n/,'listing captions must use real newlines');
console.log('StockBot v49 regression checks passed');

// The dashboard replaces the legacy #search/#list markup; load() must not crash on it.
assert.match(html,/function renderList\(\)\{if\(!\$\('list'\)\)return;/);
assert.match(dashboard,/try\{await originalLoad\.apply\(this,args\)\}catch/);
console.log('StockBot sign-in render checks passed');
assert.match(dashboard,/const seq=\+\+renderSeq;/,'overlapping renders must not blank the inventory');
assert.match(dashboard,/if\(seq!==renderSeq\)return;host\.innerHTML/);
assert.match(dashboard,/photoMap=next/);
assert.match(upcMatch,/typeof items!=='undefined'/,'UPC matching must read the page inventory (a top-level let, not window.items)');
assert.match(upcMatch,/StockBotInventoryV27\?\.handleSaleScan/,'sale scans must reach the dashboard sale dialog');
{ // behaviour: a sale scan of a known UPC opens that item in the sale dialog
  const vm=require('node:vm');const calls=[];
  const ctx={window:{},document:{getElementById:()=>null},toast:()=>{},openItem:()=>{}};ctx.window=ctx;
  vm.createContext(ctx);vm.runInContext("let items=[{id:'a',upc:'0885911425308'}];",ctx);
  ctx.StockBotInventoryV27={handleSaleScan:c=>calls.push(c)};
  vm.runInContext(upcMatch,ctx);
  ctx.handleScannedUPC('885911425308','sale');
  assert.deepEqual(calls,['0885911425308']);
}
assert.match(listings,/is\('archived_at',null\)/,'archived items must not appear in the listing queue');
console.log('StockBot Nov 11 checks passed');
assert.match(repair,/window\.StockBotCatalogPending=\{url/,'blocked catalog images must be handed to the server');
assert.match(photoIntake,/stockbot-photo-from-url/);
assert.match(photoIntake,/if\(c\.upc&&upcNow&&c\.upc!==upcNow\)return false/,'a catalog photo must never be saved onto a different product');
{ // sold-out items are hidden from the main inventory list (they live on the Sold tab)
  const vm=require('node:vm');const s=dashboard;
  const pick=(name)=>{const i=s.indexOf(name);return s.slice(i,s.indexOf('\n',i))};
  const ctx={};vm.createContext(ctx);
  vm.runInContext("const available=x=>Number(x.available_qty??0);let rows=[];const inventory=()=>rows;"+pick('const statusOf=')+'\n'+pick('function filterItems(')+";this.f=filterItems;this.set=r=>rows=r;",ctx);
  ctx.set([{id:'a',available_qty:1,received_qty:1,expected_qty:1},{id:'b',available_qty:0,received_qty:1,expected_qty:1,status:'sold'},{id:'c',available_qty:0,received_qty:0,expected_qty:4}]);
  assert.deepEqual(ctx.f('all','').map(x=>x.id),['a','c']);
  assert.deepEqual(ctx.f('sold','').map(x=>x.id),['b']);
}
