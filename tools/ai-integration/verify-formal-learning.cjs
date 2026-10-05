"use strict";
// MIT. Development-only smoke; reuses already excluded pilot trajectories.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const P=require('./learning-pipeline.cjs'),I=require('./learning-input.cjs'),D=require('./formal-learning-data.cjs'),A=require('./formal-collection.cjs');
const M=require('./formal-learning-evaluator.cjs'),T=require('./teacher-feasibility.cjs');
const E=require('../../prototype/next-turn-engine.js'),Q=require('../../prototype/search-transition.js').createForEngine(E),B=require('../../prototype/search-evaluator.js').createEvaluator(Q);
function swapped(s){return {...s,pits:[s.pits[1],s.pits[0]],reserve:[s.reserve[1],s.reserve[0]],nyakuaReserve:[s.nyakuaReserve[1],s.nyakuaReserve[0]],
 pending:[s.pending[1],s.pending[0]],houseOwned:[s.houseOwned[1],s.houseOwned[0]],player:1-s.player};}
function verify(root){
 assert.ok(!fs.existsSync(root),'Fresh verification directory required');const rows=[];
 for(const [policy,index] of [['random',700000],['greedy',700001]]){
  const trajectory=P.trajectory(policy,index),states=trajectory.states.filter((s,i)=>i>=12&&Q.outcome(s)==='ongoing');
  for(let i=0;i<states.length&&i<16;i++){const s=states[Math.floor(i*states.length/Math.min(16,states.length))],p=s.player;
   rows.push({state:s,input:I.encode(s,p),opponentInput:I.encode(s,1-p),target:Math.max(-1,Math.min(1,B.evaluate(s,p)/1024)),tags:T.tags(s)});
  }
 }
 assert.ok(rows.length>=16);const fixture=path.join(root,'development-fixture.json');A.atomic(fixture,{learningFingerprint:D.fingerprint(),rows});
 const python=cp.spawnSync('python3',[path.join(__dirname,'verify-formal-learning.py'),fixture,root],{encoding:'utf8',maxBuffer:8*1024*1024});
 if(python.status!==0)throw Error('Development smoke failed: '+python.stderr);
 const summary=JSON.parse(python.stdout),expected=A.read(path.join(root,'python-expected.json'));let predictions=0,symmetries=0;
 for(const kind of D.spec.models)for(const seed of D.spec.training.seeds){
  const file=path.join(root,'learning-'+kind+'-'+seed,'model.json'),model=M.validateModel(A.read(file)),evaluator=M.createEvaluator(model);
  rows.forEach((r,i)=>{
   const actual=evaluator.evaluate(r.state);assert.equal(actual,expected[kind+'-'+seed][i]);predictions++;
   assert.equal(evaluator.evaluate(r.state,1-r.state.player),-actual);assert.equal(evaluator.evaluate(swapped(r.state)),actual);symmetries+=2;
  });
 }
 const result={schema:1,status:'PASS',specId:D.spec.id,learningFingerprint:D.fingerprint(),...summary,
  pythonNodeIntegerComparisons:predictions,integerMismatches:0,symmetryComparisons:symmetries,models:9};
 A.atomic(path.join(root,'verification.json'),result);return result;
}
if(require.main===module)console.log(JSON.stringify(verify(process.argv[2])));
module.exports={verify,swapped};
