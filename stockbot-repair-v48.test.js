'use strict';
const assert=require('node:assert/strict');
const {normalizeLookup,suggestedPrice}=require('./stockbot-repair-v48.js');

const rituals=normalizeLookup({product:{title:'The Ritual of Sakura Gift Set',manufacturer:'Rituals',summary:'A scented body-care gift set.',msrp:'42.50',images:[{url:'https://example.test/rituals.jpg'}]},source:'retailer'});
assert.deepEqual(rituals.name,'The Ritual of Sakura Gift Set');
assert.deepEqual(rituals.brand,'Rituals');
assert.deepEqual(rituals.description,'A scented body-care gift set.');
assert.equal(rituals.retail,42.5);
assert.equal(rituals.imageUrl,'https://example.test/rituals.jpg');
assert.equal(suggestedPrice(42.5),29.75);

const partial=normalizeLookup({brand:'Rituals'});
assert.equal(partial.brand,'Rituals');
assert.equal(partial.name,'');
assert.equal(partial.retail,0);

const alternate=normalizeLookup({product_name:'Crispy Quinoa',brand_name:'Undercover',retail_price:6,image:'https://example.test/quinoa.png'});
assert.equal(alternate.name,'Crispy Quinoa');
assert.equal(alternate.brand,'Undercover');
assert.equal(alternate.retail,6);
assert.equal(alternate.imageUrl,'https://example.test/quinoa.png');
console.log('stockbot-repair-v48 tests passed');
