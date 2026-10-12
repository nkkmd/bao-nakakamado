'use strict';
// MIT. Fixed research-only alternate weights; never imported by prototype/.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const C=require('../v010-balance/core.cjs');
const V=require('../../prototype/end-pit-search-evaluator.js');
const POLICIES=Object.freeze([
 {id:'base-8192',nodes:8192,evaluator:'base'},
 {id:'base-32768',nodes:32768,evaluator:'base'},
 {id:'mobility-8192',nodes:8192,evaluator:'mobility'}
]);
const WEIGHTS=Object.freeze({boardSeeds:4,frontSeeds:2,frontOccupied:80,frontConnections:6,reusablePits:6,
 mobility:12,captureMoves:6,maxCapture:4,relayShape:1,frontSafety:16,houseOwned:12,
 ordinaryHand:4,nyakuaMoves:2});
const ALT_ID='NAKAKAMADO-MOBILITY-DIAGNOSTIC-V010-v1';
const alternateFactory={createEvaluator(Q){const b=V.createEvaluator(Q);
 function breakdown(state,player,check=()=>{}){const r=b.breakdown(state,player,check);
   if(r.outcome!=='ongoing')return {...r,evaluatorId:ALT_ID};
   const weights={...WEIGHTS,...(state.phase==='mtaji'?{ordinaryHand:0,nyakuaMoves:0}:{})};
   const contributions=Object.fromEntries(Object.entries(weights).map(([k,w])=>[k,r.features[k]*w]));
   const total=Math.max(-100000,Math.min(100000,Object.values(contributions).reduce((s,n)=>s+n,0)));
   return {...r,evaluatorId:ALT_ID,contributions,total};}
 return Object.freeze({...b,ID:ALT_ID,breakdown,evaluate:(state,player,check)=>breakdown(state,player,check).total});}};
function factory(evaluator){const file=path.join(__dirname,'../v010-balance/research-search.cjs');
 const sandbox={module:{exports:{}},require:createRequire(file),NakakamadoEndPitSearchEvaluator:evaluator==='base'?V:alternateFactory};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),sandbox,{filename:file});return sandbox.module.exports;}
function createPolicy(profile,Q=C.Q){const raw=factory(profile.evaluator).createAI(Q,{now:()=>0});
 return {profile,analyzeMove:(state,seed,options={})=>JSON.parse(JSON.stringify(raw.analyzeMove(state,
   {maxNodes:profile.nodes,maxDepth:32,timeLimitMs:60000,exactRoot:true,tieSeed:seed,quiescenceDepth:1,...options}))),
   evaluate:raw.evaluate};}
module.exports={POLICIES,WEIGHTS,ALT_ID,alternateFactory,createPolicy};
