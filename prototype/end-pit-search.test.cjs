"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('./end-pit-engine.js'),S=require('./end-pit-rules.js');
const Q=require('./end-pit-search-transition.js').createForEngine(E);
const F=require('./end-pit-search-ai.js'),A=F.createAI(Q,{now:()=>0});
const O=require('../tools/end-pit-search-oracle.cjs');
const {e30,mirror,examples}=require('../tools/end-pit-search/fixtures.cjs');
const freeze=b=>{if(b&&typeof b==='object'){Object.values(b).forEach(freeze);Object.freeze(b);}return b;};
test('adapter rejects old rules and key distinguishes the takasia history',()=>{
  assert.throws(()=>require('./end-pit-search-transition.js').createForEngine(require('./next-turn-engine.js')),/v0.10.0/);
  const b=e30(),none=e30(false);assert.notEqual(Q.stateKey(b),Q.stateKey(none));
  for(const change of [{takasia:{player:1,index:4}},{pending:[1,0]},{reason:'relay-limit'},{turn:3},{player:0}])
    assert.notEqual(Q.stateKey(b),Q.stateKey({...b,...change}));
});
test('NYAKUA boundary and E30 variants and final states equal normal application',()=>{
  for(const b of [E.initialState(),e30(),...examples.map(x=>x.state)]) {
    const before=JSON.stringify(b);assert.deepEqual(Q.moveVariants(b),S.moveVariants({board:b,history:[]}));
    for(const m of Q.moveVariants(b)) {
      const actual=Q.applyMove(freeze(E.clone(b)),m),normal=S.applyWithEvents({board:b,history:[]},m);
      assert.deepEqual(actual.state,normal.game.board);
      assert.deepEqual(actual.events,normal.events.map(({state,...event})=>event));
      assert.equal(actual.summary.stolen,normal.game.history[0].stolen);
      assert.ok(actual.events.every(e=>!Object.hasOwn(e,'state')));
    }
    assert.equal(JSON.stringify(b),before);
  }
});
test('takasia legality, relay stop, expiry and replacement are visible to search',()=>{
  const b=e30();assert.ok(Q.moveVariants(b).every(m=>!(m.row===0&&m.index===3)));
  const all=Q.moveVariants(b).map(m=>Q.applyMove(b,m));
  assert.ok(all.some(r=>r.events.some(e=>e.kind==='takasia'&&e.action==='stop')));
  for(const r of all)if(r.state.takasia)assert.equal(r.state.takasia.player,r.state.player);
});
test('current evaluator is integer, antisymmetric and preserves side exchange',()=>{
  for(const b of [E.initialState(),e30(),...examples.map(x=>x.state)]) {
    assert.equal(A.evaluate(b,0)+A.evaluate(b,1),0);
    assert.equal(A.evaluate(b,0),A.evaluate(mirror(b),1));
    assert.ok(Number.isSafeInteger(A.evaluate(b,0)));
    const f=A.evaluationBreakdown(b,0).features;
    assert.ok(!('protectedHand' in f)&&!('nextPlacementExtra' in f));
  }
});
test('depths 1/2/3, PVS and tiny caches match exhaustive normal-rule minimax',()=>{
  for(const b of [E.initialState(),e30(),mirror(e30())])for(const depth of [1,2,3])for(const quiescenceDepth of [0,1]) {
    const ref=O.solve(b,depth,quiescenceDepth);
    for(const opt of [{},{pvs:false,transpositionTable:false,evaluationCache:false},
      {maxTableEntries:2,maxEvaluationCacheEntries:2,ttMoveFirst:true,historyHeuristic:true,aspirationWindow:1,orderQuiescenceCaptures:true}]) {
      const r=A.analyzeMove(freeze(E.clone(b)),{...opt,maxDepth:depth,quiescenceDepth});
      assert.equal(r.stats.rootScore,ref.score);assert.equal(r.stats.completedDepth,depth);
      assert.ok(ref.bestMoves.some(m=>F.moveKey(m)===F.moveKey(r.move)));
    }
  }
});
test('forced wins, losses and pending seeds preserve terminal distance',()=>{
  const win=E.initialState();win.pits[1][0]=[0,0,0,1,0,0,0,0];
  const r=A.analyzeMove(win,{maxDepth:3});assert.equal(r.stats.rootScore,999999);
  const after=Q.applyMove(win,r.move).state;assert.ok(after.pending[0]>0);
  assert.equal(A.analyzeMove(after).stats.rootScore,1000000);
  const b=E.initialState();Object.assign(b,{phase:'mtaji',reserve:[0,0],houseOwned:[false,false],
    pits:[[[2,0,0,0,0,0,0,0],Array(8).fill(0)],[[5,0,0,0,0,0,0,0],Array(8).fill(0)]]});
  assert.equal(A.analyzeMove(b,{maxDepth:3,quiescenceDepth:0}).stats.rootScore,-999998);
});
test('deadline returns a legal unscored fallback or the last completed depth',()=>{
  let finished=0;
  for(const limit of [0,20,100,300,800,1600,4000]) {
    let ticks=0;const ai=F.createAI(Q,{now:()=>ticks++});
    const r=ai.analyzeMove(e30(),{maxDepth:4,timeLimitMs:limit,quiescenceDepth:0,aspirationWindow:1});
    assert.ok(Q.moveVariants(e30()).some(m=>F.moveKey(m)===F.moveKey(r.move)));
    if(r.stats.completedDepth){finished++;assert.equal(r.stats.rootScore,O.solve(e30(),r.stats.completedDepth,0).score);}
    else {assert.equal(r.stats.rootScore,null);assert.equal(r.scoreMeaning,'unscored-fallback');}
  }
  assert.ok(finished);
});
test('relay safety stop never becomes a normal loss or an exact draw',()=>{
  const b={...E.initialState(),winner:1,reason:'relay-limit'};
  const r=A.analyzeMove(b);assert.equal(r.move,null);assert.equal(r.stats.rootScore,0);
  assert.equal(r.outcome,'safety-stop');assert.match(r.scoreMeaning,/unresolved/);
});
test('invalid options and engine exceptions are not hidden',()=>{
  assert.throws(()=>A.analyzeMove(e30(),{maxDepth:0}),/option/);
  assert.throws(()=>F.createAI({...Q,applyMove:()=>{throw Error('broken-engine');}},{now:()=>0}).analyzeMove(E.initialState()),/broken-engine/);
});
