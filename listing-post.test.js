'use strict';
// The Deal Drop MI post format used for Omni Social drafts, group posts and Marketplace.
const assert=require('node:assert/strict');const fs=require('node:fs');
const src=fs.readFileSync(__dirname+'/listing-queue-v1.js','utf8');
const start=src.indexOf('const CONDITION='),end=src.indexOf('\n}',src.indexOf('function writePost'))+2;
const writePost=new Function(src.slice(start,end)+'\nreturn writePost;')();
const chicco={product_name:'Chicco KeyFit Infant Car Seat with Base — Encore',suggested_price:118.99,unit_retail:209.99,condition_grade:'New/Sealed',condition_notes:'Brand: Chicco\nDescription: Rear-facing infant car seat with stay-in-car base.'};
const post=writePost(chicco);
assert.equal(post.split('\n')[0],'🔥 Chicco KeyFit Infant Car Seat with Base — Encore — $118.99 (about $210 new)');
assert.match(post,/^New and sealed\.$/m);
assert.match(post,/Rear-facing infant car seat/);
assert.match(post,/Never in a crash/);
assert.match(post,/Comment MINE to claim • Pickup Grand Blanc$/);
assert.doesNotMatch(post,/UPC|Brand:|Category:|\\n/);
// no store price shown when unknown or not meaningfully higher
assert.doesNotMatch(writePost({product_name:'Fan',suggested_price:10.5,condition_grade:'Good'}),/new\)/);
assert.doesNotMatch(writePost({product_name:'Fan',suggested_price:10,unit_retail:10.5}),/new\)/);
// long descriptions are cut at a word boundary
const long=writePost({product_name:'Mat',suggested_price:20,listing_description:'word '.repeat(80)});
assert.ok(long.split('\n')[1].length<=222&&long.split('\n')[1].endsWith('…'));
assert.match(writePost(chicco,{marketplace:true}),/Deal Drop MI – First Look Deals/);
console.log('listing post format tests passed');
