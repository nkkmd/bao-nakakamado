"use strict";
// MIT. Frozen final evaluation contract. CLI is read-only preflight, never opening.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const A=require('./formal-collection.cjs'),D=require('./formal-learning-data.cjs');
const V=require('./formal-learning-validation.cjs'),M=require('./formal-learning-evaluator.cjs');
const I=require('./learning-input.cjs'),T=require('./teacher-feasibility.cjs');
const spec=require('./formal-final-spec.json'),root=path.resolve(__dirname,'../..');
const baseline=require('../../prototype/search-evaluator.js').createEvaluator(require('../../prototype/search-transition.js').createForEngine(require('../../prototype/next-turn-engine.js')));
const read=p=>A.read(path.join(root,p)),bytes=p=>fs.readFileSync(path.join(root,p));
function fingerprint(){return A.hash({spec:A.shaBytes(bytes('tools/ai-integration/formal-final-spec.json')),
 implementation:A.shaBytes(bytes('tools/ai-integration/formal-final.cjs')),learning:D.fingerprint()});}
function preflight(){
 assert.equal(spec.schema,1);assert.equal(spec.learningSpecId,D.spec.id);assert.equal(spec.learningFingerprint,D.fingerprint());
 assert.deepEqual(spec.collection,D.spec.collection);assert.equal(spec.opening.authorizedToOpenOnce,false);
 assert.equal(spec.opening.finalOpened,false);assert.equal(spec.opening.liveWorkflowInstalled,false);
 assert.equal(spec.opening.claimRef,'refs/tags/nyakua-final-open-'+spec.finalRowsDigest);
 const criteria=Object.fromEntries(Object.keys(spec.criteria).map(k=>[k,D.spec.selection[k]]));assert.deepEqual(spec.criteria,criteria);
 assert.equal(spec.minimumRows,A.formalV2.minimumAcceptedRows.final);assert.equal(spec.minimumOpeningGroups,A.formalV2.minimumOpeningGroups.final);
 assert.deepEqual(spec.minimumCoverage,A.formalV2.minimumCoverage.final);
 const summary=D.checkSummary(read('doc/AI_FORMAL_COLLECTION_RUN_V2_20261005.json').summary);
 assert.equal(summary.final.digest,spec.finalRowsDigest);
 const c=spec.candidate,dir=c.directory,modelBytes=bytes(dir+'/model.json'),trainingBytes=bytes(dir+'/training.json');
 assert.equal(A.shaBytes(modelBytes),c.modelSha256);assert.equal(A.shaBytes(trainingBytes),c.trainingSha256);
 assert.equal(A.shaBytes(bytes(dir+'/receipt.json')),c.receiptSha256);
 assert.equal(A.shaBytes(bytes(spec.validationReport.path)),spec.validationReport.sha256);
 const model=M.validateModel(JSON.parse(modelBytes)),training=JSON.parse(trainingBytes),receipt=read(dir+'/receipt.json'),report=read(spec.validationReport.path);
 assert.equal(model.kind,c.kind);assert.equal(model.seed,c.seed);assert.equal(model.learningFingerprint,spec.learningFingerprint);
 assert.equal(model.trainDigest,c.trainDigest);assert.equal(training.modelSha256,c.modelSha256);assert.deepEqual(training.origin,c.origin);
 assert.equal(training.binding.learningFingerprint,spec.learningFingerprint);assert.equal(training.binding.trainDigest,c.trainDigest);
 assert.equal(receipt.authorizedToOpenOnce,false);assert.equal(receipt.finalOpened,false);
 assert.equal(report.learningFingerprint,spec.learningFingerprint);assert.equal(report.validationDigest,c.validationDigest);
 assert.equal(report.trainDigest,c.trainDigest);assert.deepEqual(report.origin,c.origin);
 const selected=V.select(report.reports);assert.equal(selected.passed,true);assert.deepEqual(selected.selected,report.selected);
 assert.deepEqual(selected.selected,{kind:c.kind,seed:c.seed,modelSha256:c.modelSha256});
 for(const r of report.reports){assert.ok(r.gate.passed);assert.equal(r.gate.criteria.length,18);
  assert.ok(r.gate.criteria.every(g=>Number.isFinite(g.observed)&&Number.isFinite(g.threshold)&&g.operator==='<='&&g.observed<=g.threshold));}
 return {schema:1,status:'READY-TO-FREEZE-OPENING-PROCEDURE-NOT-AUTHORIZED',specId:spec.id,fingerprint:fingerprint(),
  modelSha256:c.modelSha256,finalRowsDigest:spec.finalRowsDigest,claimRef:spec.opening.claimRef,
  authorizedToOpenOnce:false,formalRowsRead:0,finalOpened:false,liveWorkflowInstalled:false};
}
function checkOrigin(origin){
 assert.equal(origin.repository,spec.opening.repository);assert.ok(Number.isSafeInteger(origin.runId)&&origin.runId>0);
 assert.equal(origin.attempt,1);assert.ok(/^[a-f0-9]{40}$/.test(origin.headSha));
}
function checkAuthorization(authorization,origin){
 checkOrigin(origin);assert.equal(authorization.schema,1);assert.equal(authorization.specId,spec.id);
 assert.equal(authorization.authorizedToOpenOnce,true);assert.equal(authorization.fingerprint,fingerprint());
 assert.equal(authorization.modelSha256,spec.candidate.modelSha256);assert.equal(authorization.finalRowsDigest,spec.finalRowsDigest);
 assert.equal(authorization.headSha,origin.headSha);assert.deepEqual(authorization.origin,origin);
 assert.ok(typeof authorization.frozenAtJST==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/.test(authorization.frozenAtJST));
 return {schema:1,status:'CLAIMED-MAY-HAVE-OPENED',specId:spec.id,fingerprint:fingerprint(),
  modelSha256:spec.candidate.modelSha256,finalRowsDigest:spec.finalRowsDigest,authorizationDigest:A.hash(authorization),origin};
}
// The REST ref creation is atomic across runners. No update/delete path exists here.
// A timeout, response loss or existing ref consumes the attempt: never retry opening.
async function reserveOpening(authorization,origin,{fetchImpl=fetch,token=process.env.GITHUB_TOKEN}={}){
 preflight();const claim=checkAuthorization(authorization,origin);assert.ok(typeof token==='string'&&token.length>0);
 const api='https://api.github.com/repos/'+spec.opening.repository,headers={Accept:'application/vnd.github+json',
  'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json',Authorization:'Bearer '+token};
 const request=(url,options={})=>fetchImpl(url,{...options,headers,redirect:'error',signal:AbortSignal.timeout(25000)});
 const existing=await request(api+'/git/ref/'+spec.opening.claimRef.slice(5));
 assert.equal(existing.status,404,'Final opening already claimed or registry unavailable');
 const tag=await request(api+'/git/tags',{method:'POST',body:JSON.stringify({tag:spec.opening.claimRef.slice(10),message:JSON.stringify(claim),object:origin.headSha,type:'commit'})});
 assert.equal(tag.status,201,'Claim object creation failed');const object=await tag.json();assert.ok(/^[a-f0-9]{40}$/.test(object.sha));
 const created=await request(api+'/git/refs',{method:'POST',body:JSON.stringify({ref:spec.opening.claimRef,sha:object.sha})});
 assert.equal(created.status,201,'Final opening claim conflict; never retry');const ref=await created.json();
 assert.equal(ref.ref,spec.opening.claimRef);assert.equal(ref.object.sha,object.sha);assert.equal(ref.object.type,'tag');
 const verified=await request(api+'/git/ref/'+spec.opening.claimRef.slice(5));assert.equal(verified.status,200);
 const current=await verified.json();assert.equal(current.object.sha,object.sha);assert.equal(current.object.type,'tag');
 return {...claim,claimRef:spec.opening.claimRef,claimObjectSha:object.sha};
}
// Orchestration seam for the future manual worker, tested with development callbacks.
// No production decrypt callback or workflow is installed in this preparation stage.
async function runOnce({authorization,origin,reserve,open,evaluate,persist}){
 preflight();const expected=checkAuthorization(authorization,origin);
 for(const fn of [reserve,open,evaluate,persist])assert.equal(typeof fn,'function');
 const claim=await reserve(authorization,origin);for(const [k,v] of Object.entries(expected))assert.deepEqual(claim[k],v);
 assert.equal(claim.claimRef,spec.opening.claimRef);assert.ok(/^[a-f0-9]{40}$/.test(claim.claimObjectSha));
 const payload=await open(claim),report=await evaluate(payload,claim);
 await persist(report,claim);return report;
}
function normalizeFinal(rows){
 assert.equal(A.hash(rows),spec.finalRowsDigest,'Frozen final rows changed');assert.ok(rows.length>=spec.minimumRows);
 assert.ok(new Set(rows.map(r=>r.group)).size>=spec.minimumOpeningGroups);
 const coverage=T.coverage(rows);for(const [tag,minimum] of Object.entries(spec.minimumCoverage))assert.ok(coverage[tag]>=minimum);
 const normalized=rows.map(r=>{
  assert.equal(r.split,'final');A.replay(r,A.formalV2);A.checkMeasurement(r.measurement,r,A.formalV2);
  const label=r.measurement.label;assert.equal(label.accepted,true);assert.equal(label.completedDepth,4);assert.equal(label.quiescenceDepth,1);
  const p=r.state.player;return {id:r.id,group:r.group,state:r.state,input:I.encode(r.state,p),opponentInput:I.encode(r.state,1-p),
   target:label.target,baseline:Math.max(-1,Math.min(1,baseline.evaluate(r.state,p)/D.spec.targetScale)),
   tags:{...T.tags(r.state),north:p===1,south:p===0,terminalLine:label.kind==='finite-depth-terminal-line'}};
 });
 for(const key of ['id','input'])assert.equal(new Set(normalized.map(r=>A.hash(r[key]))).size,normalized.length);
 return normalized;
}
function finalGate(observed,reference,overhead){
 const gate=V.gate(observed,reference,overhead);
 return {status:gate.passed?spec.decision.passed:spec.decision.failed,...gate,alternativeCandidateEvaluation:false,retuning:false,publicAdopted:false};
}
if(require.main===module){try{
 assert.equal(process.argv.length,3);assert.equal(process.argv[2],'preflight');console.log(JSON.stringify(preflight()));
}catch{console.error('Final preflight failed; no key or row payload logged');process.exitCode=1;}}
module.exports={spec,fingerprint,preflight,checkAuthorization,reserveOpening,runOnce,normalizeFinal,finalGate};
