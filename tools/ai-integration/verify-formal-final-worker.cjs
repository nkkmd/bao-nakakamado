"use strict";
// MIT. Full decrypt -> interpreter -> public aggregation on already excluded development paths.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const A=require('./formal-collection.cjs'),F=require('./formal-final.cjs'),R=require('./formal-final-runner.cjs'),P=require('./learning-pipeline.cjs');
const I=require('./learning-input.cjs'),T=require('./teacher-feasibility.cjs');
const Q=require('../../prototype/search-transition.js').createForEngine(require('../../prototype/next-turn-engine.js'));
const baseline=require('../../prototype/search-evaluator.js').createEvaluator(Q);
async function verify(directory){
 assert.ok(!fs.existsSync(directory));F.preflight();fs.mkdirSync(directory,{recursive:true,mode:0o700});const rows=[];
 for(const [policy,index] of [['random',700000],['greedy',700001]]){
  const available=P.trajectory(policy,index).states.filter((s,i)=>i>=12&&Q.outcome(s)==='ongoing');
  for(let i=0;i<Math.min(16,available.length);i++){
   const state=available[Math.floor(i*available.length/Math.min(16,available.length))],p=state.player,b=Math.max(-1,Math.min(1,baseline.evaluate(state,p)/1024));
   rows.push({id:A.hash(I.positionKey(state)),group:'development-'+policy,state,input:I.encode(state),opponentInput:I.encode(state,1-p),target:b,baseline:b,
    tags:{...T.tags(state),terminalLine:false}});
  }
 }
 const binding={purpose:'development-final-worker',namespace:'already-excluded-paths'},key=crypto.randomBytes(32),sealed=A.encrypt(rows,key,binding),before=A.hash(rows);
 const env={GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',GITHUB_REPOSITORY:F.spec.opening.repository,GITHUB_RUN_ATTEMPT:'1',
  GITHUB_SHA:'a'.repeat(40),GITHUB_RUN_ID:'123',BAO_FINAL_AUTHORIZATION:'OPEN-FROZEN-FINAL-ONCE',BAO_FINAL_EXPECTED_HEAD:'a'.repeat(40),BAO_FINAL_EXPECTED_FINGERPRINT:R.fingerprint()};
 const {authorization,origin}=R.context(env);let claimed=false,opens=0,saves=0,report;
 const run=()=>F.runOnce({authorization,origin,reserve:()=>{assert.equal(claimed,false);claimed=true;
   return {...F.checkAuthorization(authorization,origin),claimRef:F.spec.opening.claimRef,claimObjectSha:'b'.repeat(40)};},
  open:()=>{opens++;const decoded=A.decrypt(sealed,key,binding);assert.equal(A.hash(decoded),before);return decoded;},
  evaluate:decoded=>R.evaluateRows(decoded,directory),persist:value=>{saves++;report=value;
   assert.ok(!/"(state|input|opponentInput|target|predictions|key)"\s*:/.test(JSON.stringify(value)));}});
 try{await run();await assert.rejects(run());assert.equal(opens,1);assert.equal(saves,1);
  assert.equal(report.pythonNodeIntegerComparisons,32);assert.equal(report.integerMismatches,0);assert.equal(report.antisymmetryComparisons,32);
  assert.equal(report.criteria.length,18);assert.equal(A.hash(rows),before);assert.equal(fs.existsSync(path.join(directory,'views.json')),false);
 }finally{key.fill(0);}
 const result={schema:1,status:'PASS-DEVELOPMENT-WORKER-FORMAL-FINAL-UNOPENED',runnerFingerprint:R.fingerprint(),preparationFingerprint:F.fingerprint(),
  developmentPaths:['random/700000','greedy/700001'],developmentDecryptions:opens,publicAggregateSaves:saves,blockedSecondOpening:true,
  pythonNodeIntegerComparisons:32,integerMismatches:0,antisymmetryComparisons:32,criteriaChecked:18,formalRowsRead:0,finalOpened:false,
  environment:{node:process.version,...R.pythonEnvironment()}};
 A.atomic(path.join(directory,'verification.json'),result);return result;
}
if(require.main===module)verify(process.argv[2]).then(r=>console.log(JSON.stringify(r))).catch(()=>{console.error('Development worker check failed; no payload logged');process.exitCode=1;});
module.exports={verify};
