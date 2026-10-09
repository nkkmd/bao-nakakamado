"use strict";
// MIT. Deterministic development verification; never a strength comparison.
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const E=require('../prototype/end-pit-engine.js'),S=require('../prototype/end-pit-rules.js');
const Q=require('../prototype/end-pit-search-transition.js').createForEngine(E);
const F=require('../prototype/end-pit-search-ai.js'),A=F.createAI(Q,{now:()=>0});
const Simple=require('../prototype/end-pit-simple-ai.js').createAI(Q),O=require('./end-pit-search-oracle.cjs');
const {e30,mirror,examples}=require('./end-pit-search/fixtures.cjs');
const report={status:'PASS',rulesVersion:E.RULES_VERSION,developmentSeed:2026100910,games:0,transitions:0,
  additions:0,takasiaActivations:0,takasiaStops:0,constrainedTransitions:0,symmetry:0,replays:0,oracleComparisons:0,roots:0,
  normalTerminal:0,safetyStop:0,unfinished:0,sourceSha256:{}};
const roots=new Map(),reachableNamua=[],reachableMtaji=[];
const total=b=>[...b.pits.flat(2),...b.reserve,...b.nyakuaReserve,...b.pending].reduce((a,n)=>a+n,0);
const same=(a,b)=>assert.deepEqual(a,b);
function check(b) {
  const before=JSON.stringify(b),legal=Q.moveVariants(b);
  same(legal,S.moveVariants({board:b,history:[]}));
  for(const m of legal) {
    const r=Q.applyMove(b,m),normal=S.applyWithEvents({board:b,history:[]},m);
    same(r.state,normal.game.board);same(r.events,normal.events.map(({state,...event})=>event));
    same(r.summary.stolen,normal.game.history[0].stolen);assert.equal(total(r.state),total(b));
    const mirrored=Q.applyMove(mirror(b),m);same(mirrored.state,mirror(r.state));report.symmetry++;
    report.additions+=r.summary.stolen;report.takasiaActivations+=r.events.filter(e=>e.kind==='takasia'&&e.action==='activate').length;
    report.takasiaStops+=r.events.filter(e=>e.kind==='takasia'&&e.action==='stop').length;
    report.constrainedTransitions+=Number(Boolean(b.takasia));report.transitions++;
  }
  assert.equal(JSON.stringify(b),before);
}
for(const b of [E.initialState(),e30(),e30(false),mirror(e30()),...examples.map(x=>x.state)]) {check(b);roots.set(Q.stateKey(b),b);}
// A recorded proposal-A cycle provides a concrete safety-stop transition. This
// is a boundary fixture, not a claim that its whole pre-takasia route survives.
const historical=require('./nyakua-continue/results/search4/anomaly-A-2-1.json');
const beforeCycle={...E.clone(historical.history.at(-2).after),takasia:null};
const cycle=Q.applyMove(beforeCycle,historical.history.at(-1).move);
assert.equal(cycle.state.reason,'relay-limit');assert.equal(Q.outcome(cycle.state),'safety-stop');
check(beforeCycle);roots.set(Q.stateKey(beforeCycle),beforeCycle);
let seed=report.developmentSeed;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(let i=0;i<32;i++) {
  let game=S.initialGame();
  for(let ply=0;ply<160&&Q.outcome(game.board)==='ongoing';ply++) {
    const b=game.board;check(b);
    if(ply%5===0)(b.phase==='namua'?reachableNamua:reachableMtaji).push(E.clone(b));
    const moves=Q.moveVariants(b),m=i%2?Simple.chooseMove(b):moves[Math.floor(random()*moves.length)];
    assert.ok(m);game=S.apply(game,m);
  }
  same(S.replay(S.record(game)),game);report.replays++;report.games++;
  const o=Q.outcome(game.board);report[o==='ongoing'?'unfinished':o==='safety-stop'?'safetyStop':'normalTerminal']++;
}
for(const list of [reachableNamua,reachableMtaji]) {
  for(let i=0;i<list.length;i+=Math.max(1,Math.floor(list.length/20))) {
    const b=list[i];roots.set(Q.stateKey(b),b);if(roots.size>=52)break;
  }
}
for(const b of roots.values()) {
  assert.equal(A.evaluate(b,0)+A.evaluate(b,1),0);assert.equal(A.evaluate(b,0),A.evaluate(mirror(b),1));
  for(const depth of [1,2,3])for(const quiescenceDepth of [0,1]) {
    const ref=O.solve(b,depth,quiescenceDepth);
    for(const opt of [{},{transpositionTable:false,evaluationCache:false,pvs:false},
      {maxTableEntries:3,maxEvaluationCacheEntries:3,ttMoveFirst:true,orderQuiescenceCaptures:true,historyHeuristic:true,aspirationWindow:1}]) {
      const r=A.analyzeMove(b,{...opt,maxDepth:depth,quiescenceDepth});
      assert.equal(r.stats.rootScore,ref.score);assert.equal(r.stats.completedDepth,depth);
      assert.ok(ref.bestMoves.some(m=>F.moveKey(m)===F.moveKey(r.move)));report.oracleComparisons++;
    }
  }
}
report.roots=roots.size;report.namuaRoots=[...roots.values()].filter(b=>b.phase==='namua').length;
report.mtajiRoots=report.roots-report.namuaRoots;assert.ok(report.additions&&report.takasiaStops&&report.constrainedTransitions&&report.mtajiRoots);
report.rootDigest=crypto.createHash('sha256').update(JSON.stringify([...roots.values()])).digest('hex');
for(const p of ['prototype/end-pit-engine.js','prototype/end-pit-rules.js','prototype/end-pit-search-transition.js','prototype/end-pit-search-ai.js','prototype/end-pit-search-evaluator.js','tools/end-pit-search-oracle.cjs','tools/end-pit-search-check.cjs'])
  report.sourceSha256[p]=crypto.createHash('sha256').update(fs.readFileSync(require('node:path').join(__dirname,'..',p))).digest('hex');
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
