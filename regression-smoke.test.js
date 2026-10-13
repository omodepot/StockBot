'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=name=>fs.readFileSync(new URL(name,'file://'+__dirname+'/'),'utf8');
const html=read('index.html');
const scanner=read('scanner-v12.js');
const dashboard=read('inventory-dashboard-v26.js');
const listings=read('listing-queue-v1.js');
const repair=read('stockbot-repair-v48.js');

// Receive, editing, UPC, and photo persistence contracts.
assert.match(html,/function saveItem\(/);
assert.match(html,/inventory_items'\)\.update\(payload\)\.eq\('id',current\.id\)/);
assert.match(scanner+html,/handleScannedUPC/);
assert.match(html,/stockbot-photo/);
assert.match(html,/saveSelectedPhotos/);
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
assert.match(listings,/Send to Omni Social/);
assert.match(listings,/targetClientName:'Deal Drop MI'/);
assert.match(listings,/facebook\.com\/marketplace\/create\/item/);
console.log('StockBot regression smoke tests passed');
