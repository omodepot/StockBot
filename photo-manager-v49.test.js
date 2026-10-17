'use strict';
const assert=require('node:assert/strict');
const {orderRows,renumber,move,makePrimary,positions}=require('./photo-manager-v49.js');
const rows=[{id:'a',sort_order:0,created_at:'2026-10-01'},{id:'b',sort_order:0,created_at:'2026-10-02'},{id:'c',sort_order:3,created_at:'2026-10-03'}];
assert.deepEqual(orderRows(rows).map(r=>r.id),['a','b','c']);
// duplicates and gaps are healed to 0..n-1, keeping creation order for ties
assert.deepEqual(renumber(rows),[{id:'b',sort_order:1},{id:'c',sort_order:2}]);
assert.deepEqual(renumber([{id:'x',sort_order:0},{id:'y',sort_order:1}]),[]);
const clean=[{id:'a',sort_order:0},{id:'b',sort_order:1},{id:'c',sort_order:2}];
assert.deepEqual(move(clean,'b',-1).map(r=>r.id),['b','a','c']);
assert.deepEqual(move(clean,'a',-1).map(r=>r.id),['a','b','c']);
assert.deepEqual(move(clean,'c',1).map(r=>r.id),['a','b','c']);
assert.deepEqual(makePrimary(clean,'c').map(r=>r.id),['c','a','b']);
assert.deepEqual(positions(makePrimary(clean,'c')),[{id:'c',sort_order:0},{id:'a',sort_order:1},{id:'b',sort_order:2}]);
assert.deepEqual(positions(makePrimary(clean,'a')),[]);
console.log('photo-manager-v49 tests passed');
