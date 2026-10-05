"use strict";
// MIT. Development search connection; no training, data decryption or public UI activation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const E=require('../../prototype/next-turn-engine.js'),Q=require('../../prototype/search-transition.js').createForEngine(E);
const C=require('../../prototype/model-search-ai.js'),M=require('./formal-learning-evaluator.cjs'),I=require('./learning-input.cjs');
const F=require('./formal-final.cjs'),R=require('./formal-final-runner.cjs'),A=require('./formal-collection.cjs');
const spec=require('./model-search-spec.json'),root=path.resolve(__dirname,'../..');
const bytes=p=>fs.readFileSync(path.join(root,p));
function checkModelBytes(data){
 assert.equal(A.shaBytes(data),F.spec.candidate.modelSha256,'Frozen model bytes changed');
 const m=M.validateModel(JSON.parse(data));assert.equal(m.kind,'linear');assert.equal(m.seed,2026100401);
 assert.equal(m.learningFingerprint,F.spec.learningFingerprint);assert.equal(m.trainDigest,F.spec.candidate.trainDigest);return m;
}
function preflight(){
 F.preflight();assert.equal(E.RULES_VERSION,spec.rulesVersion);assert.equal(spec.heuristicScale,require('./formal-learning-spec.json').targetScale);
 assert.equal(spec.terminalWin,require('../../prototype/search-evaluator.js').WIN);
 assert.equal(A.shaBytes(bytes('prototype/search-ai.js')),spec.teacherSearchSha256);assert.equal(R.fingerprint(),spec.runnerFingerprint);
 const reportBytes=bytes('doc/formal-final/report.json');assert.equal(A.shaBytes(reportBytes),spec.finalReportSha256);
 const records=Object.fromEntries(['authorization','claim','report'].map(k=>[k,JSON.parse(bytes('doc/formal-final/'+k+'.json'))]));
 R.checkPublicRecords(records);assert.equal(records.report.status,F.spec.decision.passed);assert.equal(records.report.passed,true);
 checkModelBytes(bytes(F.spec.candidate.directory+'/model.json'));
 return Object.freeze({connectionId:spec.id,searchId:C.SEARCH_ID,evaluatorId:spec.evaluatorId,
  modelSha256:F.spec.candidate.modelSha256,finalReportSha256:spec.finalReportSha256,
  heuristicScale:spec.heuristicScale,terminalWin:spec.terminalWin,formalRowsRead:0,publicAdopted:false});
}
function createEvaluator(){
 preflight();const interpreter=M.createEvaluator(checkModelBytes(bytes(F.spec.candidate.directory+'/model.json')));
 function breakdown(state,player=state.player,check=()=>{}){
  assert.ok(player===0||player===1,'Invalid perspective');check();const outcome=Q.outcome(state);let total;
  if(outcome==='safety-stop')total=0;
  else if(outcome==='normal-terminal')total=state.winner===player?spec.terminalWin:-spec.terminalWin;
  else{I.validate(state);check();total=interpreter.evaluate(state,player);check();
   assert.ok(Number.isSafeInteger(total)&&Math.abs(total)<=spec.heuristicScale,'Invalid frozen integer output');}
  return {evaluatorId:spec.evaluatorId,modelSha256:F.spec.candidate.modelSha256,outcome,total,
   scoreMeaning:outcome==='ongoing'?'frozen-integer-heuristic':outcome==='safety-stop'?'unresolved-neutral-estimate':'terminal'};
 }
 return Object.freeze({ID:spec.evaluatorId,WIN:spec.terminalWin,breakdown,evaluate:(state,player,check)=>breakdown(state,player,check).total});
}
function createAI(options={}){
 for(const key of Object.keys(options))assert.equal(key,'now','Unknown model search constructor option');
 if(Object.hasOwn(options,'now'))assert.equal(typeof options.now,'function');
 return C.createAI(Q,{...options,evaluator:createEvaluator()});
}
module.exports={spec,preflight,checkModelBytes,createEvaluator,createAI};
