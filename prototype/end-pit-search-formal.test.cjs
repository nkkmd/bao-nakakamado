"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const F=require('../tools/end-pit-search-formal.cjs'),E=require('./end-pit-engine.js');
test('formal openings are frozen, unique, current-rule roots with preserved total',()=>{
  const rows=F.manifest();assert.equal(rows.length,256);assert.equal(new Set(rows.map(x=>x.rootKey)).size,256);
  for(const row of rows) {
    const b=row.game.board;assert.equal(b.winner,null);assert.equal(b.nyakuaReserve[0]+b.nyakuaReserve[1],0);
    assert.equal([...b.pits.flat(2),...b.reserve,...b.pending].reduce((a,n)=>a+n,0),64);
  }
  assert.equal(rows.filter(x=>x.policy==='random').length,128);assert.equal(rows.filter(x=>x.policy==='noisy-simple').length,128);
  assert.equal(F.contract.budgetMs,150);assert.equal(F.contract.minimumConfidenceLower,.5);
});
test('incomplete aggregate and interrupted measured pair hold before new measurements',()=>{
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'v010-formal-test-'));
  try {
    assert.throws(()=>F.aggregate(out),/all pairs/);
    fs.writeFileSync(path.join(out,'pair-0.json.started'),'{}');
    assert.throws(()=>F.runShard(out,0),/Interrupted pair 0: HOLD/);
    assert.equal(fs.existsSync(path.join(out,'pair-0.json')),false);
  } finally {fs.rmSync(out,{recursive:true,force:true});}
});
