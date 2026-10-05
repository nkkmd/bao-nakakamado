"use strict";
// MIT. Public-result publication and context tests use a fake Git database only.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const R=require('./formal-final-runner.cjs'),F=require('./formal-final.cjs');
const env=()=>({GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',GITHUB_REPOSITORY:F.spec.opening.repository,
 GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'a'.repeat(40),GITHUB_RUN_ID:'123',BAO_FINAL_AUTHORIZATION:'OPEN-FROZEN-FINAL-ONCE',
 BAO_FINAL_EXPECTED_HEAD:'a'.repeat(40),BAO_FINAL_EXPECTED_FINGERPRINT:R.fingerprint()});
function records(){
 const {authorization,origin}=R.context(env()),claim={...F.checkAuthorization(authorization,origin),claimRef:F.spec.opening.claimRef,claimObjectSha:'b'.repeat(40)};
 const report={schema:1,specId:F.spec.id,runnerFingerprint:R.fingerprint(),preparationFingerprint:F.fingerprint(),learningFingerprint:F.spec.learningFingerprint,
  origin,modelSha256:F.spec.candidate.modelSha256,finalRowsDigest:F.spec.finalRowsDigest,authorizationDigest:claim.authorizationDigest,
  claimObjectSha:claim.claimObjectSha,collectionArtifact:{id:F.spec.collection.artifactId,digest:F.spec.collection.digest},
  status:'HOLD-FINAL-EXECUTION-ERROR',passed:false,retuning:false,alternativeCandidateEvaluation:false,publicAdopted:false,
  finalOpened:false,decryptionAttempted:true,failureStage:'decrypt',completedAtJST:'2026-10-05T13:00:00+09:00'};
 return {authorization,claim,report};
}
function gitStore(rec,{loseResponse=false}={}){
 let saved=null,tree=null;const methods=[],payloads=[],response=(status,data)=>({status,json:async()=>data});
 const fetchImpl=async(url,options)=>{
  const method=options.method||'GET';methods.push(method);assert.equal(options.redirect,'error');
  if(url.includes('/git/ref/tags/'))return response(200,{object:{sha:rec.claim.claimObjectSha,type:'tag'}});
  if(url.includes('/git/tags/'))return response(200,{message:JSON.stringify(F.checkAuthorization(rec.authorization,rec.authorization.origin)),object:{sha:rec.report.origin.headSha,type:'commit'}});
  if(url.includes('/git/ref/heads/'))return response(saved?200:404,saved);
  if(method==='GET'&&url.includes('/git/commits/'))return response(200,{tree:{sha:'c'.repeat(40)}});
  if(method==='GET'&&url.includes('/git/trees/'))return response(200,{truncated:false,tree});
  const b=JSON.parse(options.body);payloads.push(b);
  if(url.endsWith('/git/blobs')){assert.equal(b.encoding,'utf-8');assert.ok(!/"(state|input|target|key|predictions)"\s*:/.test(b.content));
   const bytes=Buffer.from(b.content),sha=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');return response(201,{sha});}
  if(url.endsWith('/git/trees')){assert.equal(b.base_tree,'c'.repeat(40));tree=b.tree;assert.equal(tree.length,3);return response(201,{sha:'c'.repeat(40)});}
  if(url.endsWith('/git/commits')){assert.deepEqual(b.parents,[rec.report.origin.headSha]);return response(201,{sha:'d'.repeat(40)});}
  if(url.endsWith('/git/refs')){assert.equal(b.ref,R.resultRef);if(saved)return response(422,{});saved={ref:b.ref,object:{sha:b.sha,type:'commit'}};
   if(loseResponse)throw Error('Development response loss after persistence');return response(201,saved);}
  throw Error('Unexpected fake Git endpoint');
 };
 return {fetchImpl,methods,payloads,get saved(){return saved;}};
}
test('Final dispatch binds main, exact head, runner fingerprint, explicit action and first attempt',()=>{
 assert.equal(R.context(env()).authorization.runnerFingerprint,R.fingerprint());
 for(const change of [{GITHUB_EVENT_NAME:'push'},{GITHUB_REF:'refs/heads/other'},{GITHUB_RUN_ATTEMPT:'2'},
  {GITHUB_REPOSITORY:'someone/fork'},{BAO_FINAL_EXPECTED_HEAD:'0'.repeat(40)},{BAO_FINAL_EXPECTED_FINGERPRINT:'0'.repeat(64)},
  {BAO_FINAL_AUTHORIZATION:'yes'},{GITHUB_RUN_ID:'0'}])assert.throws(()=>R.context({...env(),...change}));
});
test('Collection key must be canonical 32-byte base64 and is never included in records',()=>{
 const value=crypto.randomBytes(32);assert.deepEqual(R.checkKey(value.toString('base64')),value);
 for(const bad of [undefined,'',Buffer.alloc(31).toString('base64'),Buffer.alloc(33).toString('base64'),' '.repeat(44)])assert.throws(()=>R.checkKey(bad));
 assert.ok(!JSON.stringify(records()).includes('BAO_COLLECTION_KEY'));
});
test('Publication verifies durable claim and creates only the fixed result branch',async()=>{
 const rec=records(),store=gitStore(rec);const saved=await R.publish(rec,{fetchImpl:store.fetchImpl,token:'development-only'});
 assert.equal(saved.resultRef,R.resultRef);assert.ok(store.saved);assert.ok(store.methods.every(m=>['GET','POST'].includes(m)));
 assert.equal(store.payloads.filter(p=>p.ref).length,1);
});
test('Public report re-publication is idempotent; no second evaluation or Git mutation',async()=>{
 const rec=records(),store=gitStore(rec),args={fetchImpl:store.fetchImpl,token:'development-only'};
 const first=await R.publish(rec,args),before=store.methods.length;const again=await R.publish(rec,args);
 assert.deepEqual(again,first);assert.ok(store.methods.slice(before).every(m=>m==='GET'));
});
test('Lost publication response is resolved by hashes of persisted report, authorization and claim',async()=>{
 const rec=records(),store=gitStore(rec,{loseResponse:true});const saved=await R.publish(rec,{fetchImpl:store.fetchImpl,token:'development-only'});
 assert.ok(store.saved);assert.equal(saved.resultCommitSha,'d'.repeat(40));
});
test('An existing result with different bytes is rejected rather than overwritten',async()=>{
 const rec=records(),store=gitStore(rec),args={fetchImpl:store.fetchImpl,token:'development-only'};await R.publish(rec,args);
 const changed=structuredClone(rec);changed.report.completedAtJST='2026-10-05T13:00:01+09:00';const before=store.methods.length;
 await assert.rejects(R.publish(changed,args));assert.ok(store.methods.slice(before).every(m=>m==='GET'));
});
test('Publication refuses a mismatching or missing durable opening claim',async()=>{
 const rec=records();await assert.rejects(R.publish(rec,{token:'development-only',fetchImpl:async()=>({status:200,json:async()=>({object:{sha:'0'.repeat(40),type:'tag'}})})}));
 await assert.rejects(R.publish(rec,{token:'development-only',fetchImpl:async()=>({status:404})}));
});
test('Private payloads, unknown metadata, modified origin and unsupported failure stages cannot be published',()=>{
 for(const [container,key,value] of [['report','state',{pits:[]}],['authorization','key','development'],['claim','rows',[]],
  ['report','failureStage','arbitrary secret text'],['report','modelSha256','0'.repeat(64)],['report','runnerFingerprint','0'.repeat(64)]]){
  const rec=records();rec[container][key]=value;assert.throws(()=>R.checkPublicRecords(rec));}
});
test('Numerical reports must reproduce all fixed gates and match model bytes, parity counts and runtime metadata',()=>{
 const rec=records(),metrics=(mae,mse)=>({rows:512,groups:16,mae,mse,groupMse:mse,
  strata:Object.fromEntries(F.spec.criteria.strata.map(tag=>[tag,{rows:256,mae,mse}]))});
 const reference=metrics(.5,1),measured=metrics(.1,.1),bytes=1612,microseconds=10,gate=F.finalGate(measured,reference,{bytes,microseconds,mismatches:0});
 delete rec.report.failureStage;Object.assign(rec.report,gate,{baseline:reference,metrics:measured,bytes,microseconds,pythonNodeIntegerComparisons:512,
  integerMismatches:0,antisymmetryComparisons:512,environment:{node:'v24.19.0',platform:'Linux',arch:'x64',cpu:'Development fixture',python:'3.12.14',numpy:'2.3.5'},finalOpened:true});
 assert.equal(R.checkPublicRecords(rec),rec);
 for(const mutate of [r=>r.report.criteria[0].threshold=0,r=>r.report.bytes=1,r=>r.report.environment.state={},
  r=>r.report.antisymmetryComparisons=511,r=>r.report.microseconds=-1]){
  const changed=structuredClone(rec);mutate(changed);assert.throws(()=>R.checkPublicRecords(changed));}
});
test('The manual worker has no automatic event; credentials are not persisted and only public records are uploaded',()=>{
 const w=fs.readFileSync(path.join(__dirname,'../../.github/workflows/formal-final.yml'),'utf8');
 assert.ok(w.includes('workflow_dispatch:'));assert.ok(!/\n  (push|pull_request|schedule):/.test(w));
 assert.ok(w.includes('github.run_attempt == 1'));assert.ok(w.includes('persist-credentials: false'));
 assert.ok(w.includes('/public/*.json'));assert.ok(!w.includes('/private/'));assert.ok(!/run:.*\$\{\{/.test(w));
});
