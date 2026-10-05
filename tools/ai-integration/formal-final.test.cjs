"use strict";
// MIT. Fail-closed final protocol checks; development payloads only, no live API.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const F=require('./formal-final.cjs'),A=require('./formal-collection.cjs');
const origin={repository:F.spec.opening.repository,runId:123,attempt:1,headSha:'a'.repeat(40)};
const authorization=()=>({schema:1,specId:F.spec.id,authorizedToOpenOnce:true,fingerprint:F.fingerprint(),
 modelSha256:F.spec.candidate.modelSha256,finalRowsDigest:F.spec.finalRowsDigest,headSha:origin.headSha,origin,
 frozenAtJST:'2026-10-05T13:00:00+09:00'});
function registry(){
 let ref=null,tags=0,creates=0;const methods=[];
 const response=(status,value)=>({status,json:async()=>value});
 const fetchImpl=async(url,opts)=>{
  methods.push(opts.method||'GET');assert.equal(opts.redirect,'error');
  if(url.includes('/git/ref/'))return response(ref?200:404,ref);
  if(url.endsWith('/git/tags')){tags++;const b=JSON.parse(opts.body);assert.equal(b.type,'commit');assert.equal(b.object,origin.headSha);
   assert.equal(JSON.parse(b.message).status,'CLAIMED-MAY-HAVE-OPENED');return response(201,{sha:String(tags).padStart(40,'0')});}
  if(url.endsWith('/git/refs')){creates++;if(ref)return response(422,{});const b=JSON.parse(opts.body);
   assert.equal(b.ref,F.spec.opening.claimRef);ref={ref:b.ref,object:{type:'tag',sha:b.sha}};return response(201,ref);}
  throw Error('Unexpected URL');
 };
 return {fetchImpl,get ref(){return ref;},get creates(){return creates;},methods};
}
test('Read-only preflight verifies raw frozen artifacts and inherited conditions; no decryption',()=>{
 const original=A.decrypt;A.decrypt=()=>{throw Error('Forbidden decrypt during preflight');};
 try{const r=F.preflight();assert.equal(r.formalRowsRead,0);assert.equal(r.finalOpened,false);assert.equal(r.authorizedToOpenOnce,false);
  assert.equal(r.modelSha256,F.spec.candidate.modelSha256);assert.equal(r.liveWorkflowInstalled,false);
 }finally{A.decrypt=original;}
});
test('Authorization rejects stale sources, candidate switching, different final, reruns and nonmatching origin',()=>{
 for(const change of [{authorizedToOpenOnce:false},{fingerprint:'0'.repeat(64)},{modelSha256:'0'.repeat(64)},
  {finalRowsDigest:'0'.repeat(64)},{headSha:'0'.repeat(40)},{origin:{...origin,runId:124}},{frozenAtJST:'2026-10-05T00:00:00Z'}])
  assert.throws(()=>F.checkAuthorization({...authorization(),...change},origin));
 assert.throws(()=>F.checkAuthorization(authorization(),{...origin,attempt:2}));
 assert.throws(()=>F.checkAuthorization(authorization(),{...origin,repository:'another/repo'}));
});
test('An atomic durable ref permits only one of two simultaneous runners',async()=>{
 const store=registry(),args={fetchImpl:store.fetchImpl,token:'development-not-a-secret'};
 const results=await Promise.allSettled([F.reserveOpening(authorization(),origin,args),F.reserveOpening(authorization(),origin,args)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
 assert.ok(store.ref);assert.equal(store.creates,2);assert.ok(store.methods.every(m=>['GET','POST'].includes(m)));
});
test('Existing durable claim prevents opening from a fresh workspace and stops before mutation',async()=>{
 const store=registry(),args={fetchImpl:store.fetchImpl,token:'development-not-a-secret'};
 await F.reserveOpening(authorization(),origin,args);const before=store.methods.length;
 await assert.rejects(F.reserveOpening(authorization(),origin,args));assert.deepEqual(store.methods.slice(before),['GET']);
});
test('Response loss after ref creation consumes the opportunity and is never retried',async()=>{
 const store=registry();let calls=0;
 const fetchImpl=async(url,opts)=>{calls++;const r=await store.fetchImpl(url,opts);if(url.endsWith('/git/refs'))throw Error('Response lost');return r;};
 await assert.rejects(F.reserveOpening(authorization(),origin,{fetchImpl,token:'development-not-a-secret'}));
 assert.ok(store.ref);assert.equal(calls,3);
 await assert.rejects(F.reserveOpening(authorization(),origin,{fetchImpl:store.fetchImpl,token:'development-not-a-secret'}));
});
test('Registry unavailable or permission denied fails before any decrypt callback',async()=>{
 for(const status of [401,403,429,500]){let opened=0;
  await assert.rejects(F.runOnce({authorization:authorization(),origin,
   reserve:(a,o)=>F.reserveOpening(a,o,{fetchImpl:async()=>({status}),token:'development-not-a-secret'}),
   open:()=>{opened++;},evaluate:()=>{},persist:()=>{}}));assert.equal(opened,0);}
});
test('Decryption or result-persistence failure leaves the durable claim and blocks a second opening',async()=>{
 for(const failAt of ['open','persist']){const store=registry();let opened=0;
  const run=()=>F.runOnce({authorization:authorization(),origin,
   reserve:(a,o)=>F.reserveOpening(a,o,{fetchImpl:store.fetchImpl,token:'development-not-a-secret'}),
   open:()=>{opened++;if(failAt==='open')throw Error('Development decrypt failure');return {development:true};},
   evaluate:()=>({status:'development'}),persist:()=>{throw Error('Development persistence failure');}});
  await assert.rejects(run());assert.equal(opened,1);assert.ok(store.ref);
  await assert.rejects(run());assert.equal(opened,1);
 }
});
test('Completion orders reservation, opening, evaluation and persistence without retry',async()=>{
 const store=registry(),order=[];
 const report=await F.runOnce({authorization:authorization(),origin,
  reserve:async(a,o)=>{order.push('reserve');return F.reserveOpening(a,o,{fetchImpl:store.fetchImpl,token:'development-not-a-secret'});},
  open:()=>{order.push('open');return {development:true};},evaluate:p=>{assert.equal(p.development,true);order.push('evaluate');return {status:'development'};},
  persist:()=>{order.push('persist');}});
 assert.deepEqual(order,['reserve','open','evaluate','persist']);assert.equal(report.status,'development');
});
test('A reservation for different data is rejected before opening',async()=>{
 let opened=0;const store=registry();
 await assert.rejects(F.runOnce({authorization:authorization(),origin,
  reserve:async(a,o)=>({...await F.reserveOpening(a,o,{fetchImpl:store.fetchImpl,token:'development-not-a-secret'}),finalRowsDigest:'0'.repeat(64)}),
  open:()=>{opened++;},evaluate:()=>{},persist:()=>{}}));assert.equal(opened,0);
});
test('Final verdict inherits 18 gates; absent rare strata, bad parity and degradation produce HOLD',()=>{
 const b={groupMse:1,strata:Object.fromEntries(F.spec.criteria.strata.map(t=>[t,{rows:10,mae:.2,mse:1}]))};
 const m={groupMse:.5,strata:Object.fromEntries(F.spec.criteria.strata.map(t=>[t,{rows:10,mae:.2,mse:.5}]))};
 const overhead={bytes:1612,microseconds:10,mismatches:0};let r=F.finalGate(m,b,overhead);
 assert.equal(r.status,F.spec.decision.passed);assert.equal(r.criteria.length,18);assert.equal(r.publicAdopted,false);
 for(const overheadChange of [{mismatches:1},{bytes:1048577},{microseconds:2001}])assert.equal(F.finalGate(m,b,{...overhead,...overheadChange}).status,F.spec.decision.failed);
 const absent=structuredClone(m);absent.strata.reservedOnly.mae=null;assert.equal(F.finalGate(absent,b,overhead).passed,false);
 assert.equal(F.finalGate({...m,groupMse:.901},b,overhead).passed,false);
});
test('Final normalization rejects development and modified rows before replaying them',()=>{
 assert.throws(()=>F.normalizeFinal([]));assert.throws(()=>F.normalizeFinal([{split:'final',id:'development'}]));
});
test('Only preflight CLI and read-only CI are installed; no formal open workflow',()=>{
 const workflow=fs.readFileSync(path.join(__dirname,'../../.github/workflows/formal-final-check.yml'),'utf8');
 assert.ok(!/secrets\.|contents: write|workflow_dispatch:/.test(workflow));
 assert.ok(workflow.includes('formal-final.cjs preflight'));
 const implementation=fs.readFileSync(path.join(__dirname,'formal-final.cjs'),'utf8');assert.ok(!implementation.includes('A.decrypt('));
});
