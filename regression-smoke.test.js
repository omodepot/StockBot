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
