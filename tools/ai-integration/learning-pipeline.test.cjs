"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const E=require("../../prototype/next-turn-engine.js"),Q=require("../../prototype/search-transition.js").createForEngine(E);
const I=require("./learning-input.cjs"),P=require("./learning-pipeline.cjs"),F=require("../../prototype/search-ai.js");
const A=F.createAI(Q,{now:()=>0}),clone=x=>JSON.parse(JSON.stringify(x));
function mirror(b){const c=clone(b);for(const k of ["pits","reserve","nyakuaReserve","pending","houseOwned"])c[k].reverse();c.player=1-c.player;return c;}
function moveHand(b,p,n){b.pits[p][1][0]+=b.reserve[p]-n;b.reserve[p]=n;return b;}
test("368-bit input distinguishes protected KETE and one/two/three placement without absolute side",()=>{
  const b=E.initialState(),n=clone(b);n.reserve[0]--;n.nyakuaReserve[0]=1;
  assert.notDeepEqual(I.encode(b),I.encode(n));assert.notEqual(I.positionKey(b),I.positionKey(n));
  assert.deepEqual(I.encode(n).slice(334,336),[1,0]);assert.equal(I.encode(n)[357],1);
  assert.deepEqual(I.encode(b).slice(320,327),[0,1,1,0,1,0,0]);
  for(const hand of [0,1,2]){const c=moveHand(clone(n),0,hand);assert.equal(I.placement(c,0),hand+1);
    assert.equal(I.encode(c).length,368);assert.ok(I.encode(c).every(x=>x===0||x===1));}
  for(const s of [b,n]){assert.deepEqual(I.encode(s,s.player),I.encode(mirror(s),1-s.player));
    assert.equal(I.positionKey(s),I.positionKey(mirror(s)));const later={...s,turn:s.turn+10};
    assert.equal(I.positionKey(s),I.positionKey(later));assert.notEqual(Q.stateKey(s),Q.stateKey(later));}
});
test("reserved-only and MTAJI boundary encodings agree in independently implemented Python",()=>{
  const n=E.initialState();n.reserve[0]--;n.nyakuaReserve[0]=1;
  const only=moveHand(clone(n),0,0),mtaji=clone(only);
  for(const p of [0,1]){mtaji.pits[p][1][0]+=mtaji.reserve[p]+mtaji.nyakuaReserve[p];mtaji.reserve[p]=0;mtaji.nyakuaReserve[p]=0;}
  mtaji.phase="mtaji";
  const states=[E.initialState(),n,only,mtaji,...[0,1,2].map(n=>moveHand(E.initialState(),0,n))];
  const rows=states.flatMap(state=>[0,1].map(perspective=>({state,perspective})));
  const py=require("node:child_process").spawnSync("python3",[path.join(__dirname,"learning_input.py")],{input:JSON.stringify(rows),encoding:"utf8"});
  assert.equal(py.status,0,py.stderr);assert.deepEqual(JSON.parse(py.stdout),rows.map(r=>I.encode(r.state,r.perspective)));
  assert.equal(I.encode(mtaji)[353],1);assert.equal(I.encode(only)[355],1);
});
test("input rejects malformed, terminal, missing-reserve, overflow and nonstandard total states",()=>{
  for(const mutate of [s=>delete s.nyakuaReserve,s=>s.pits[0][0].pop(),s=>s.reserve[0]=NaN,
    s=>s.nyakuaReserve[0]=2,s=>s.pending[0]=1,s=>s.reserve[0]++,s=>s.turn=-1,s=>s.winner=0,
    s=>s.phase="mtaji",s=>s.reason="relay-limit",s=>s.houseOwned[0]=1]){
    const s=E.initialState();mutate(s);assert.throws(()=>I.encode(s));}
  assert.throws(()=>I.encode(E.initialState(),2),/Perspective/);
});
test("teacher refuses incomplete and safety-stop labels and preserves finite-depth meaning",()=>{
  const s=E.initialState(),r=A.analyzeMove(s,P.spec.pilot.teacher),before=JSON.stringify(s);
  const good=P.labelFor(s,r);assert.equal(good.accepted,true);assert.equal(good.kind,"finite-depth-heuristic");
  for(const mutate of [x=>x.stats.timedOut=true,x=>x.stats.completedDepth=1,x=>x.stats.rootScore=null,
    x=>x.stats.safetyStops=1,x=>x.scoreMeaning="heuristic-with-unresolved-safety-stop"]){const bad=clone(r);mutate(bad);assert.equal(P.labelFor(s,bad).accepted,false);}
  const none=F.createAI(Q).analyzeMove(s,{maxDepth:2,timeLimitMs:0});assert.equal(P.labelFor(s,none).accepted,false);
  const terminal={...s,winner:0,reason:"front-empty"};assert.equal(P.labelFor(terminal,r).reason,"non-ongoing");
  const mate=clone(r);mate.stats.rootScore=999999;assert.equal(P.labelFor(s,mate).kind,"finite-depth-terminal-line");
  assert.equal(P.labelFor(s,mate).target,1);assert.equal(JSON.stringify(s),before);
});
test("shared normalized positions across split groups are quarantined, same-split duplicates removed",()=>{
  const u=P.makeUnit("random",P.spec.pilot.seedStartIndex),r=u.rows[0];assert.ok(r);
  const group1=u.group;let group2="g",group3="h";
  while(P.splitFor(group2)===P.splitFor(group1))group2+="g";
  while(P.splitFor(group3)!==P.splitFor(group1))group3+="h";
  const other=(g,index)=>{const v=clone(u);v.seedIndex=index;v.seed=require("../nyakua-three/core.cjs").seedAt(index);
    v.unitId=v.policy+"-"+index;v.group=g;v.rows=[{...clone(r),unitId:v.unitId,group:g}];return v;};
  const a={...u,rows:[r]},b=other(group2,u.seedIndex+1);b.rows[0].state=mirror(r.state);
  b.rows[0].exactStateKey=Q.stateKey(b.rows[0].state);b.rows[0].label.perspective=b.rows[0].state.player;
  const leaked=P.audit([a,b]);assert.equal(leaked.summary.quarantinedCopies,2);assert.equal(leaked.rows.length,0);
  const same=P.audit([a,other(group3,u.seedIndex+2)]);assert.equal(same.rows.length,1);assert.equal(same.summary.withinSplitDuplicates,1);
  assert.throws(()=>P.audit([a,a]),/Duplicate/);
});
test("resume validates checksum and source fingerprint and rejects stale or corrupted checkpoints",()=>{
  // Fail on the first checkpoint before spending time generating other units.
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"bao-learning-checkpoint-"));
  try{
    const u=P.makeUnit("random",P.spec.pilot.seedStartIndex),fingerprint=P.hash({spec:P.spec,sourceHashes:P.sources()});
    const file=path.join(dir,u.unitId+".json"),saved={fingerprint,sha256:P.hash(u),unit:u};
    fs.writeFileSync(file,JSON.stringify(saved));
    const bad=clone(saved);bad.unit.rows[0].input[0]^=1;fs.writeFileSync(file,JSON.stringify(bad));
    assert.throws(()=>P.runPilot(dir),/checksum mismatch/);
    bad.sha256=P.hash(bad.unit);fs.writeFileSync(file,JSON.stringify(bad));assert.throws(()=>P.runPilot(dir),/encoding or identity/);
    const stale={...saved,fingerprint:"outdated"};fs.writeFileSync(file,JSON.stringify(stale));assert.throws(()=>P.runPilot(dir),/fingerprint/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test("deterministic trajectory samples all have standard total and matching inputs after side exchange",()=>{
  for(const policy of P.spec.pilot.policies){const u=P.makeUnit(policy,P.spec.pilot.seedStartIndex);
    P.validateUnit(u);for(const r of u.rows){assert.equal(r.input.length,368);assert.deepEqual(I.encode(mirror(r.state)),r.input);}}
});
