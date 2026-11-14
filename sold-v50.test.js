'use strict';
const assert=require('node:assert/strict');
const {stockAfterEdit,statusFor,profit,normalize,toRow}=require('./sold-v50.js');
// quantity edits move stock the other way
assert.equal(stockAfterEdit(0,1,1),0);
assert.equal(stockAfterEdit(3,1,2),2);      // sold one more
assert.equal(stockAfterEdit(0,2,1),1);      // sold one fewer -> back in stock
assert.equal(stockAfterEdit(0,1,0),1);      // undo
assert.equal(stockAfterEdit(0,1,3),null);   // can't sell stock that doesn't exist
assert.equal(statusFor(0,'received'),'sold');
assert.equal(statusFor(1,'sold'),'received');
assert.equal(statusFor(2,'listed'),'listed');
// profit only when a cost is known
assert.equal(profit({total:65,fees:2,quantity:1},{unit_cost:20}),43);
assert.equal(profit({total:65,quantity:1},{unit_cost:null}),null);
assert.equal(profit({total:65,quantity:1},{}),null);
// both sales tables round-trip
const a=normalize({id:'1',inventory_item_id:'i',quantity:2,sold_price_total:'40.5',fees:'1',payment_method:'cash',sold_at:'2026-11-01T18:00:00Z',notes:'x'},'sales');
assert.deepEqual(toRow(a),{quantity:2,sold_price_total:40.5,fees:1,payment_method:'cash',sold_at:'2026-11-01T18:00:00Z',notes:'x'});
const b=normalize({id:'2',inventory_item_id:'i',quantity:1,sale_amount:'10',payment_method:'venmo',sold_at:'2026-10-01T00:00:00Z'},'sales_transactions');
assert.deepEqual(toRow(b),{quantity:1,sale_amount:10,payment_method:'venmo',sold_at:'2026-10-01T00:00:00Z',notes:null});
console.log('sold-v50 tests passed');
