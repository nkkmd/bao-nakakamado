"use strict";
const assert = require("node:assert/strict"), test = require("node:test"), fs = require("node:fs"), vm = require("node:vm");
const E = require("./next-turn-engine.js"), S = require("./steal.js").createForEngine(E);
const Q = require("./search-transition.js").createForEngine(E);
const Factory = require("./search-ai.js"), A = Factory.createAI(Q, {now: () => 0});
const Oracle = require("../tools/ai-integration/search-oracle.cjs");
const frozen = x => { if (x && typeof x === "object") { Object.values(x).forEach(frozen); Object.freeze(x); } return x; };
const mirror = b => { const c = E.clone(b);
  for (const k of ["pits", "reserve", "nyakuaReserve", "pending", "houseOwned"]) c[k].reverse();
  c.player = 1 - c.player; if (c.winner !== null) c.winner = 1 - c.winner; return c; };
function position() {
  return [{type:"takata",phase:"namua",row:0,index:6,direction:"left"},
    {type:"capture",phase:"namua",row:0,index:4,direction:"left",side:"right"},
    {type:"takata",phase:"namua",row:0,index:5,direction:"left"}]
    .reduce((g,m)=>S.apply(g,m), S.initialGame()).board;
}
test("handcrafted evaluator separates protected reserve, detects NYAKUA opportunities, and is antisymmetric", () => {
  const b = position(), reserved = E.clone(b), p = b.player;
  reserved.reserve[p]--; reserved.nyakuaReserve[p]++;
  const before = A.evaluationBreakdown(b, p), after = A.evaluationBreakdown(reserved, p);
  assert.equal(after.features.ordinaryHand, before.features.ordinaryHand - 1);
  assert.equal(after.features.protectedHand, before.features.protectedHand + 1);
  assert.ok(before.features.nyakuaMoves !== undefined); assert.notEqual(before.total, after.total);
  for (const x of [E.initialState(), b, reserved]) {
    assert.equal(A.evaluate(x, 0), -A.evaluate(x, 1));
    assert.equal(A.evaluate(x, 0), A.evaluate(mirror(x), 1));
    assert.ok(Number.isSafeInteger(A.evaluate(x, 0)));
  }
});
test("depth 1/2/3 and compulsory-capture quiescence agree with exhaustive minimax", () => {
  for (const b of [E.initialState(), position()]) for (const q of [0, 1, 2]) for (const depth of [1, 2, 3]) {
    const expected = Oracle.solve(b, depth, q);
    for (const options of [{}, {transpositionTable:false,evaluationCache:false,pvs:false},
      {maxTableEntries:2,maxEvaluationCacheEntries:2,ttMoveFirst:true,orderQuiescenceCaptures:true,historyHeuristic:true,aspirationWindow:1}]) {
      const r = A.analyzeMove(frozen(E.clone(b)), {...options,maxDepth:depth,quiescenceDepth:q});
      assert.equal(r.stats.completedDepth, depth); assert.equal(r.stats.rootScore, expected.score);
      assert.ok(expected.bestMoves.some(m=>A.moveKey(m)===A.moveKey(r.move)));
    }
  }
});
test("immediate forced win, terminal pending and mate distance agree with exhaustive search", () => {
  const b = E.initialState(); b.pits[1][0] = [0,0,0,1,0,0,0,0];
  const r = A.analyzeMove(b, {maxDepth:3});
  assert.equal(r.stats.rootScore, 999999);
  const after = Q.applyMove(b,r.move).state;
  assert.equal(after.winner,0); assert.ok(after.pending[0]>0);
  const terminal = A.analyzeMove(after); assert.equal(terminal.move,null); assert.equal(terminal.stats.rootScore,1000000);
});
test("known relay stop has unresolved neutral score instead of inherited winner", () => {
  const record=JSON.parse(fs.readFileSync(require.resolve("../tools/nyakua-three/results/anomalies/self-random-three-3435580265-game.json")));
  const history=record.path.map(s=>s.entry), b=S.replay(history.slice(0,-1)).board;
  const r=A.analyzeMove(b,{maxDepth:1,quiescenceDepth:0});
  assert.equal(r.stats.rootScore,Oracle.solve(b,1,0).score); assert.ok(r.stats.safetyStops>0);
  assert.match(r.scoreMeaning,/unresolved/);
  const stopped=Q.applyMove(b,history.at(-1).move).state, result=A.analyzeMove(stopped);
  assert.equal(result.move,null); assert.equal(result.stats.rootScore,0); assert.equal(A.evaluate(stopped,0),0);
  assert.equal(result.outcome,"safety-stop");
});
test("sparse artificial forced loss is recognized without treating it as a standard opening", () => {
  const b=E.initialState();b.phase="mtaji";b.reserve=[0,0];b.houseOwned=[false,false];
  b.pits=[[[2,0,0,0,0,0,0,0],Array(8).fill(0)],[[5,0,0,0,0,0,0,0],Array(8).fill(0)]];
  const r=A.analyzeMove(b,{maxDepth:3,quiescenceDepth:0});
  assert.equal(r.stats.rootScore,-999998);assert.equal(r.stats.rootScore,Oracle.solve(b,3,0).score);
  assert.equal(r.move.direction,"right");
});
test("deadline includes setup and returns the last fully completed depth, even during aspiration re-search", () => {
  const b=frozen(position()); let completed=0, interrupted=0;
  for(const limit of [0,20,100,300,800,1600,4000,10000]) {
    let ticks=0; const timed=Factory.createAI(Q,{now:()=>ticks++});
    const r=timed.analyzeMove(b,{maxDepth:4,timeLimitMs:limit,quiescenceDepth:0,aspirationWindow:1});
    assert.ok(Q.moveVariants(b).some(m=>A.moveKey(m)===A.moveKey(r.move)));
    if(r.stats.completedDepth){const ref=Oracle.solve(b,r.stats.completedDepth,0);
      assert.equal(r.stats.rootScore,ref.score); assert.ok(ref.bestMoves.some(m=>A.moveKey(m)===A.moveKey(r.move)));completed++;
    }else{assert.equal(r.stats.rootScore,null);assert.equal(r.scoreMeaning,"unscored-fallback");}
    interrupted+=r.stats.timedOut;
  }
  assert.ok(completed>0&&interrupted>0);
});
test("all transition and metric previews use the NYAKUA adapter; calls do not retain tables", () => {
  let calls=0,variants=0;
  const instrumented={...Q,applyMove:(...args)=>{calls++;return Q.applyMove(...args);},moveVariants:(...args)=>{variants++;return Q.moveVariants(...args);}};
  const ai=Factory.createAI(instrumented,{now:()=>0}),b=frozen(position());
  const r=ai.analyzeMove(b,{maxDepth:3}),again=ai.analyzeMove(b,{maxDepth:3});
  assert.deepEqual(r,again); assert.ok(calls>0&&variants>0); assert.ok(r.stats.evaluationCacheHits>0);
  assert.ok(r.stats.cachePeak<=Factory.DEFAULTS.maxTableEntries);
});
test("depth four and a NORTH root preserve the same value and local move under side exchange", () => {
  const b=position();
  const expected=Oracle.solve(b,4,1),r=A.analyzeMove(b,{maxDepth:4,quiescenceDepth:1});
  assert.equal(r.stats.rootScore,expected.score);
  const other=A.analyzeMove(mirror(b),{maxDepth:4,quiescenceDepth:1});
  assert.equal(other.stats.rootScore,r.stats.rootScore);assert.deepEqual(other.move,r.move);
});
test("invalid options and engine errors are not hidden as timeouts", () => {
  for(const o of [{maxDepth:0},{maxDepth:1.5},{timeLimitMs:NaN},{timeLimitMs:-1},{maxTableEntries:0},{pvs:1},{unknown:true}]) {
    assert.throws(()=>A.analyzeMove(E.initialState(),o),/option/);
  }
  const bad=Factory.createAI({...Q,applyMove:()=>{throw new Error("engine-failure");}},{now:()=>0});
  assert.throws(()=>bad.analyzeMove(E.initialState()),/engine-failure/);
});
test("browser script export produces the same legal move and score as Node", () => {
  const context={window:{},performance:{now:()=>0}};
  for(const file of ["next-turn-engine.js","steal.js","search-transition.js","search-evaluator.js","search-ai.js"]) {
    vm.runInNewContext(fs.readFileSync(require.resolve("./"+file),"utf8"),context);
  }
  const w=context.window,b=w.BaoEngine.initialState(),q=w.NakakamadoSearchTransition.createForEngine(w.BaoEngine);
  const browser=w.NakakamadoSearchAI.createAI(q,{now:()=>0}).analyzeMove(b,{maxDepth:2});
  assert.deepEqual(JSON.parse(JSON.stringify(browser)),A.analyzeMove(E.initialState(),{maxDepth:2}));
});
