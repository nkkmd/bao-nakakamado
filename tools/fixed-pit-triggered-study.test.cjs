"use strict";
const assert=require('node:assert/strict');
const test=require('node:test');
const T=require('./fixed-pit-triggered-study.cjs');

test('reachable trigger positions mirror back to the same board',()=>{
  const positions=T.collect(200,5);
  assert.equal(positions.length,30);
  for(const p of positions){
    assert.equal(p.board.phase,'namua');
    assert.equal(p.board.reserve[p.empty],0);
    assert.ok(p.board.reserve[1-p.empty]>=2);
    assert.deepEqual(T.mirror(T.mirror(p.board)),JSON.parse(JSON.stringify(p.board)));
  }
});

test('reply continuation triggers bulk and mirrors outcomes',()=>{
  for(const p of T.collect(200,5)){
    const seed=(p.seed^0x5bf03635)>>>0;
    const a=T.continueFrom(p.board,'fixed',seed);
    const b=T.continueFrom(T.mirror(p.board),'fixed',seed);
    assert.ok(a.bulk>0);
    assert.notEqual(a.winner,null);
    assert.equal(b.winner,1-a.winner);
    assert.equal(b.reason,a.reason);
    assert.equal(b.plies,a.plies);
  }
});
