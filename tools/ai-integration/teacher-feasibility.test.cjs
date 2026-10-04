"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os");
const E=require("../../prototype/next-turn-engine.js"),Q=require("../../prototype/search-transition.js").createForEngine(E);
const P=require("./learning-pipeline.cjs"),I=require("./learning-input.cjs"),T=require("./teacher-feasibility.cjs");
const A=require("../../prototype/search-ai.js").createAI(Q,{now:()=>0});
function smallRow(){const states=P.trajectory("random",800000).states,ply=12;
  return T.certificate({states,state:states[ply],origin:{policy:"random",seedIndex:800000,seed:require("../nyakua-three/core.cjs").seedAt(800000),first:0,ply}});}
test("certificate replays a real trajectory with normal rules and detects altered moves or board",()=>{
  const row=smallRow();T.replayCertificate(row);
  const changed=JSON.parse(JSON.stringify(row));changed.state.reserve[0]++;assert.throws(()=>T.replayCertificate(changed));
  const bad=JSON.parse(JSON.stringify(row));bad.moves[0]={type:"pass"};assert.throws(()=>T.replayCertificate(bad));
});
test("four standard reachable fixtures have zero ordinary and one protected KETE, survive the reply and spend only the protected KETE",()=>{
  const fixture=require("./reserved-only-reachable-fixtures.json");assert.equal(fixture.rows.length,4);
  for(const row of fixture.rows){const proof=T.reservedOnlyEvidence(row);assert.deepEqual(proof,row.reservedOnlyEvidence);
    assert.equal(proof.currentOrdinary,0);assert.equal(proof.currentProtected,1);assert.equal(proof.reservedPlaced,1);assert.ok(proof.checkedVariants>0);}
});
test("real-clock teacher settings require depth four and retain unfinished measurements as rejected",()=>{
  const row=smallRow();
  const complete=T.measure(row,(s,o)=>{assert.deepEqual(o,{maxDepth:4,quiescenceDepth:1,timeLimitMs:5000});return A.analyzeMove(s,o);});
  assert.equal(complete.label.accepted,true);T.validateMeasurement(complete,row);
  const partial=T.measure(row,s=>require("../../prototype/search-ai.js").createAI(Q).analyzeMove(s,{maxDepth:4,timeLimitMs:0}));
  assert.equal(partial.label.accepted,false);assert.equal(partial.label.reason,"incomplete-depth");
  const safety=T.measure(row,(s,o)=>{const r=A.analyzeMove(s,o);r.stats.safetyStops=1;r.scoreMeaning="heuristic-with-unresolved-safety-stop";return r;});
  assert.equal(safety.label.reason,"safety-stop-in-search");
});
test("measurement rejects illegal teacher output, input mutation and invalid time",()=>{
  const row=smallRow();
  assert.throws(()=>T.measure(row,(s,o)=>{const r=A.analyzeMove(s,o);r.move={type:"pass"};return r;}),/Illegal/);
  assert.throws(()=>T.measure(row,(s,o)=>{const r=A.analyzeMove(s,o);s.turn++;return r;}),/mutated/);row.state.turn--;
  assert.throws(()=>T.measure(row,(s,o)=>{const r=A.analyzeMove(s,o);r.stats.elapsedMs=NaN;return r;}));
});
test("completed measurements are reused without teacher execution and stale fingerprints fail",()=>{
  const row=smallRow(),corpus={rows:[row],traceSha256:P.hash([row])},root=fs.mkdtempSync(path.join(os.tmpdir(),"bao-teacher-resume-"));
  try {
    const first=T.runShard(root,0,{corpus,analyze:A.analyzeMove});assert.equal(first.generated,1);
    const again=T.runShard(root,0,{corpus,analyze:()=>{throw Error("Unexpected re-execution");}});assert.equal(again.reused,1);assert.equal(again.generated,0);
    const file=path.join(root,"shard-0",row.id+".json"),saved=JSON.parse(fs.readFileSync(file));saved.fingerprint="outdated";fs.writeFileSync(file,JSON.stringify(saved));
    assert.throws(()=>T.runShard(root,0,{corpus}),/fingerprint/);
    assert.throws(()=>T.runShard(root,4,{corpus}));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test("coverage separates reserved-only from two and three KETE and keeps canonical identity",()=>{
  const s=E.initialState();s.reserve[0]--;s.nyakuaReserve[0]=1;
  assert.equal(T.tags(s).threePlacement,true);s.pits[0][1][0]+=s.reserve[0];s.reserve[0]=0;
  I.validate(s);assert.equal(T.tags(s).reservedOnly,true);assert.equal(T.tags(s).twoPlacement,false);
  assert.deepEqual(T.distribution([9,1,3,5]),{n:4,mean:4.5,median:3,p95:9,max:9});
});
