"use strict";
// MIT. Validate the frozen train/validation contract without collection keys.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const A=require('./formal-collection.cjs'),I=require('./learning-input.cjs'),T=require('./teacher-feasibility.cjs');
const E=require('../../prototype/next-turn-engine.js'),Q=require('../../prototype/search-transition.js').createForEngine(E);
const baseline=require('../../prototype/search-evaluator.js').createEvaluator(Q);
const spec=require('./formal-learning-spec.json');
const SOURCE_PATHS=['formal-learning-spec.json','formal-learning-data.cjs','formal-learning-trainer.py',
 'formal-learning-evaluator.cjs','formal-learning-validation.cjs','formal-learning-predict.py','formal-learning-requirements.txt',
 'formal-learning-artifact.cjs','formal-learning-unzip.py','learning-input.cjs','learning_input.py',
 '../../.github/workflows/formal-learning.yml'];
function fingerprint(){return A.hash(Object.fromEntries(SOURCE_PATHS.map(p=>[p,A.shaBytes(fs.readFileSync(path.join(__dirname,p)))])));}
function checkSummary(s){
 assert.equal(A.hash(A.sources()),spec.collection.sourceDigest,'Frozen collection implementation changed');
 assert.equal(s.status,'READY-FOR-TRAINING-DESIGN');assert.equal(s.development,false);assert.equal(s.postAuditLeaks,0);
 for(const k of ['configId','planDigest','sourceDigest','registryDigest','auditDigest'])assert.equal(s[k],spec.collection[k]);
 assert.equal(s.final.sealed,true);assert.equal(s.final.requirementsPassed,true);assert.equal(s.final.ciphertextSha256,spec.collection.finalCiphertextSha256);
 for(const split of ['train','validation']){assert.equal(s[split].passed,true);assert.equal(s[split].rows,spec.collection[split].rows);assert.equal(s[split].digest,spec.collection[split].digest);}
 return s;
}
function normalizeRows(data,split){
 assert.ok(['train','validation'].includes(split),'Only train and validation are allowed');
 assert.equal(data.planDigest,spec.collection.planDigest);assert.equal(data.rows.length,spec.collection[split].rows);
 assert.equal(A.hash(data.rows),spec.collection[split].digest,'Frozen split digest');
 const rows=data.rows.map(r=>{
  assert.equal(r.split,split);A.replay(r,A.formalV2);A.checkMeasurement(r.measurement,r,A.formalV2);
  const l=r.measurement.label;assert.equal(l.accepted,true);assert.equal(l.completedDepth,4);assert.equal(l.quiescenceDepth,1);
  const p=r.state.player,tags={...T.tags(r.state),north:p===1,south:p===0,terminalLine:l.kind==='finite-depth-terminal-line'};
  return {id:r.id,group:r.group,state:r.state,input:I.encode(r.state,p),opponentInput:I.encode(r.state,1-p),target:l.target,
   baseline:Math.max(-1,Math.min(1,baseline.evaluate(r.state,p)/spec.targetScale)),tags};
 });
 const seen=new Set();for(const r of rows){assert.ok(!seen.has(r.id),'Duplicate row');seen.add(r.id);}return rows;
}
function prepare(directory,output){
 assert.ok(!fs.existsSync(output),'Prepared output already exists');
 const summary=checkSummary(A.read(path.join(directory,'collection-summary.json')));
 const sets=Object.fromEntries(['train','validation'].map(split=>[split,normalizeRows(A.read(path.join(directory,split+'.json')),split)]));
 const groups=new Set(sets.train.map(r=>r.group)),ids=new Set(sets.train.map(r=>r.id)),inputs=new Set(sets.train.map(r=>A.hash(r.input)));
 assert.ok(sets.validation.every(r=>!groups.has(r.group)&&!ids.has(r.id)&&!inputs.has(A.hash(r.input))),'Split leakage');
 const learningFingerprint=fingerprint();
 for(const split of ['train','validation']){
  const rows=sets[split],payload={schema:1,specId:spec.id,learningFingerprint,split,planDigest:summary.planDigest,
   collectionArtifactDigest:spec.collection.digest,collectionRowsDigest:spec.collection[split].digest,
   collectionRows:A.read(path.join(directory,split+'.json')).rows,rows};
  A.atomic(path.join(output,split,split+'.json'),{...payload,digest:A.hash(payload)});
 }
 return {status:'PREPARED-TRAIN-VALIDATION-ONLY',learningFingerprint,train:sets.train.length,validation:sets.validation.length,
  finalOpened:false,keyRequired:false};
}
function checkDataset(data,split){
 const {digest,...payload}=data;assert.equal(digest,A.hash(payload));assert.equal(data.schema,1);assert.equal(data.specId,spec.id);
 assert.equal(data.learningFingerprint,fingerprint());assert.equal(data.split,split);assert.equal(data.planDigest,spec.collection.planDigest);
 assert.equal(data.collectionArtifactDigest,spec.collection.digest);assert.equal(data.collectionRowsDigest,spec.collection[split].digest);
 assert.equal(data.rows.length,spec.collection[split].rows);
 assert.deepEqual(data.rows,normalizeRows({planDigest:data.planDigest,rows:data.collectionRows},split),'Normalized data differs from frozen labels');
 for(const r of data.rows){I.validate(r.state);assert.deepEqual(r.input,I.encode(r.state));assert.deepEqual(r.opponentInput,I.encode(r.state,1-r.state.player));
  assert.ok(Number.isFinite(r.target)&&Math.abs(r.target)<=1);assert.ok(Number.isFinite(r.baseline)&&Math.abs(r.baseline)<=1);}
 return data;
}
if(require.main===module){try{const [directory,output,split]=process.argv.slice(2);
 if(directory==='--check'){checkDataset(A.read(output),split);console.log(JSON.stringify({valid:true,split}));}
 else console.log(JSON.stringify(prepare(directory,output)));}
 catch{console.error('Learning preparation failed; no row payload logged');process.exitCode=1;}}
module.exports={spec,fingerprint,checkSummary,normalizeRows,prepare,checkDataset};
