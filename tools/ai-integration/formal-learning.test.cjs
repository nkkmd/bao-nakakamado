"use strict";
// MIT. Gate/contract/reader tests use fabricated reports or development states.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const D=require('./formal-learning-data.cjs'),V=require('./formal-learning-validation.cjs'),M=require('./formal-learning-evaluator.cjs');
const B=require('./formal-learning-artifact.cjs'),spec=D.spec;
test('Frozen collection source and public summary match; HOLD and changed digests rejected',()=>{
 const summary=require('../../doc/AI_FORMAL_COLLECTION_RUN_V2_20261005.json').summary;
 assert.equal(D.checkSummary(summary),summary);
 for(const [key,value] of [['status','HOLD'],['development',true],['sourceDigest','0'.repeat(64)],['postAuditLeaks',1]]){
  assert.throws(()=>D.checkSummary({...summary,[key]:value}));
 }
 assert.throws(()=>D.normalizeRows({planDigest:spec.collection.planDigest,rows:[]},'final'));
 assert.throws(()=>D.normalizeRows({planDigest:spec.collection.planDigest,rows:[]},'train'));
});
test('Pinned Actions dataset receipt rejects replacement, rerun, expiry and failure',()=>{
 const r=spec.collection,run={repository:{full_name:r.repository},id:r.runId,run_attempt:r.attempt,head_sha:r.headSha,status:'completed',conclusion:'success'};
 const artifact={id:r.artifactId,name:r.name,digest:r.digest,expired:false,size_in_bytes:9127430,workflow_run:{id:r.runId,head_sha:r.headSha}};
 assert.equal(B.checkMetadata(run,artifact),true);
 for(const change of [{run_attempt:2},{head_sha:'f'.repeat(40)},{conclusion:'failure'}])assert.throws(()=>B.checkMetadata({...run,...change},artifact));
 for(const change of [{expired:true},{digest:'sha256:'+'0'.repeat(64)},{name:'formal-plan'},{id:1}])assert.throws(()=>B.checkMetadata(run,{...artifact,...change}));
});
test('Resume only accepts explicit immutable checkpoint receipts and registered model seeds',async()=>{
 assert.deepEqual(B.parseResume('[]'),[]);
 const pinned={repository:spec.collection.repository,name:'learning-logic-2026100401',runId:123,attempt:1,artifactId:456,headSha:'a'.repeat(40),digest:'sha256:'+'b'.repeat(64)};
 assert.deepEqual(B.parseResume(JSON.stringify([pinned])),[pinned]);
 for(const change of [{name:'learning-linear-2026100401'},{name:'learning-logic-0'},{repository:'another/repo'},{attempt:0},{digest:'latest'}])
  assert.throws(()=>B.parseResume(JSON.stringify([{...pinned,...change}])));
 assert.throws(()=>B.parseResume(JSON.stringify([pinned,pinned])));
 assert.deepEqual(await B.resumeModel('/unused-fresh-output','logic',2026100401,{records:[]}),{restored:false,kind:'logic',seed:2026100401});
});
const baseline={groupMse:1,strata:Object.fromEntries(spec.selection.strata.map(t=>[t,{rows:10,mae:.2,mse:1}]))};
const measured={groupMse:.5,strata:Object.fromEntries(spec.selection.strata.map(t=>[t,{rows:10,mae:.2,mse:.5}]))};
test('Every gate is applied; sparse NYAKUA strata, parity, size and latency fail closed',()=>{
 const overhead={bytes:1000,microseconds:100,mismatches:0};assert.equal(V.gate(measured,baseline,overhead).passed,true);
 for(const change of [{bytes:1048577},{microseconds:2001},{mismatches:1}])assert.equal(V.gate(measured,baseline,{...overhead,...change}).passed,false);
 const degraded=JSON.parse(JSON.stringify(measured));degraded.strata.reservedOnly.mae=.251;assert.equal(V.gate(degraded,baseline,overhead).passed,false);
 const absent=JSON.parse(JSON.stringify(measured));absent.strata.twoPlacement.mae=null;assert.equal(V.gate(absent,baseline,overhead).passed,false);
 assert.equal(V.gate({...measured,groupMse:.91},baseline,overhead).passed,false);
});
test('Selection requires nine fixed candidates; all seeds pass, median family rank, fixed deployment seed',()=>{
 const reports=spec.models.flatMap((kind,k)=>spec.training.seeds.map((seed,s)=>({kind,seed,modelSha256:String(k)+String(s),gate:{passed:true},metrics:{groupMse:[.2,.1,.3][k]+s*.001}})));
 let selection=V.select(reports);assert.equal(selection.selected.kind,'mlp');assert.equal(selection.selected.seed,spec.selection.deploymentSeed);
 assert.equal(selection.authorizedToOpenOnce,false);assert.equal(selection.finalOpened,false);
 reports.find(r=>r.kind==='mlp'&&r.seed===spec.training.seeds[2]).gate.passed=false;assert.equal(V.select(reports).selected.kind,'linear');
 reports.forEach(r=>r.gate.passed=false);assert.equal(V.select(reports).status,'HOLD');
 assert.throws(()=>V.select(reports.slice(1)));assert.throws(()=>V.select([...reports.slice(1),reports[1]]));
});
test('Primary metric weights independent opening groups rather than row volume',()=>{
 const rows=[...Array.from({length:9},()=>({group:'large',target:0,tags:{namua:true}})),{group:'small',target:1,tags:{mtaji:true}}];
 const metrics=V.metrics(rows,Array(10).fill(0));assert.equal(metrics.mse,.1);assert.equal(metrics.groupMse,.5);
});
test('Workflow isolates train/validation, is manual only, and contains no collection key or opening command',()=>{
 const workflow=fs.readFileSync(path.join(__dirname,'../../.github/workflows/formal-learning.yml'),'utf8');
 assert.ok(!/BAO_COLLECTION_KEY|secrets\.|formal-collection\.cjs.*open|\n  (push|pull_request):/.test(workflow));
 const trainJob=workflow.split('\n  train:\n')[1].split('\n  validation:\n')[0];assert.ok(!trainJob.includes('learning-validation'));
 assert.ok(trainJob.includes('learning-train'));assert.ok(workflow.includes("pattern: learning-*-20*"));
});
test('Integer interpreter rejects obsolete input width, malformed indices and noninteger weights',()=>{
 const good={schema:1,specId:spec.id,inputSize:368,encodingId:spec.encodingId,kind:'linear',seed:spec.training.seeds[0],
  learningFingerprint:'1'.repeat(64),trainDigest:'2'.repeat(64),quantizationScale:4096,weights:Array(368).fill(0),bias:0};
 assert.ok(M.validateModel(good));assert.throws(()=>M.validateModel({...good,inputSize:399}));
 assert.throws(()=>M.validateModel({...good,bias:NaN}));assert.throws(()=>M.validateModel({...good,weights:[.1,...good.weights.slice(1)]}));
 assert.throws(()=>M.evaluateInputs(good,Array(368).fill(2),Array(368).fill(0)));
});
test('Validation accepts canonical zero in both perspectives and rejects real antisymmetry errors',()=>{
 const state=require('../../prototype/next-turn-engine.js').initialState(),rows=[{state}];
 const model={schema:1,specId:spec.id,inputSize:368,encodingId:spec.encodingId,kind:'linear',seed:spec.training.seeds[0],
  learningFingerprint:'1'.repeat(64),trainDigest:'2'.repeat(64),quantizationScale:4096,weights:Array(368).fill(0),bias:0};
 const evaluator=M.createEvaluator(model);
 assert.equal(evaluator.evaluate(state),0);assert.equal(evaluator.evaluate(state,1-state.player),0);
 assert.doesNotThrow(()=>V.checkStatePredictions(evaluator,rows,[0]));
 assert.doesNotThrow(()=>V.checkStatePredictions({evaluate:(_,p=state.player)=>p===state.player?7:-7},rows,[7]));
 assert.throws(()=>V.checkStatePredictions({evaluate:()=>7},rows,[7]));
 assert.throws(()=>V.checkStatePredictions({evaluate:(_,p=state.player)=>p===state.player?0:1},rows,[0]));
});
