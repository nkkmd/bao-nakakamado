"use strict";
// MIT. Frozen candidate interpreter smoke on already excluded development paths.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const F=require('./formal-final.cjs'),A=require('./formal-collection.cjs'),P=require('./learning-pipeline.cjs'),I=require('./learning-input.cjs');
const M=require('./formal-learning-evaluator.cjs'),Q=require('../../prototype/search-transition.js').createForEngine(require('../../prototype/next-turn-engine.js'));
function verify(directory){
 assert.ok(!fs.existsSync(directory));const before=F.preflight();fs.mkdirSync(directory,{recursive:true,mode:0o700});
 const states=[];for(const [policy,index] of [['random',700000],['greedy',700001]]){
  const available=P.trajectory(policy,index).states.filter((s,i)=>i>=12&&Q.outcome(s)==='ongoing');
  for(let i=0;i<Math.min(16,available.length);i++)states.push(available[Math.floor(i*available.length/Math.min(16,available.length))]);
 }
 const modelFile=path.resolve(__dirname,'../..',F.spec.candidate.directory,'model.json'),viewsFile=path.join(directory,'development-views.json');
 const views=states.map(state=>({input:I.encode(state),opponentInput:I.encode(state,1-state.player)}));A.atomic(viewsFile,views);
 const proc=cp.spawnSync('python3',[path.join(__dirname,'formal-learning-predict.py'),modelFile,viewsFile],{encoding:'utf8',maxBuffer:1024*1024});
 assert.equal(proc.status,0,'Development Python inference failed');const expected=JSON.parse(proc.stdout),evaluator=M.createEvaluator(A.read(modelFile));
 assert.equal(expected.length,states.length);let antisymmetry=0;
 states.forEach((state,i)=>{const score=evaluator.evaluate(state);assert.equal(score,expected[i]);
  assert.equal(evaluator.evaluate(state,1-state.player),score===0?0:-score);antisymmetry++;});
 assert.deepEqual(F.preflight(),before);
 const result={schema:1,status:'PASS-DEVELOPMENT-ONLY-FINAL-UNOPENED',specId:F.spec.id,fingerprint:F.fingerprint(),
  developmentPaths:['random/700000','greedy/700001'],pythonNodeIntegerComparisons:states.length,integerMismatches:0,
  antisymmetryComparisons:antisymmetry,formalRowsRead:0,finalOpened:false,authorizedToOpenOnce:false};
 A.atomic(path.join(directory,'verification.json'),result);return result;
}
if(require.main===module){try{console.log(JSON.stringify(verify(process.argv[2])));}catch{console.error('Final development check failed; no row payload logged');process.exitCode=1;}}
module.exports={verify};
