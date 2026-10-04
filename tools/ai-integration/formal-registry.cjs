"use strict";
// MIT. Development exclusions; never loads formal candidates or teacher labels.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const P=require('./learning-pipeline.cjs'),I=require('./learning-input.cjs'),C=require('../nyakua-three/core.cjs');
const E=require('../../prototype/next-turn-engine.js'),Q=require('../../prototype/search-transition.js').createForEngine(E);
const S=require('../../prototype/steal.js').createForEngine(E),hash=P.hash;
const files=['tools/ai-integration/transition-verification.json','tools/ai-integration/search-verification-spec.json',
 'tools/ai-integration/search-verification.json','tools/ai-integration/learning-spec.json',
 'tools/ai-integration/teacher-feasibility-corpus.json','tools/ai-integration/reserved-only-reachable-fixtures.json',
 'prototype/search-ai.test.cjs','prototype/search-transition.test.cjs','tools/ai-integration/learning-pipeline.test.cjs',
 'tools/nyakua-three/results/anomalies/self-random-three-3435580265-game.json','tools/ai-integration/formal-registry.cjs','tools/ai-integration/formal-development-spec.json',
 'tools/ai-integration/formal-collection.test.cjs','tools/ai-integration/verify-formal-infrastructure.cjs'];
function sourceHashes(){return {...P.sources(),...Object.fromEntries(files.map(p=>[p,hash(fs.readFileSync(path.join(__dirname,'../..',p),'utf8'))]))};}
function makeRegistry(){
 const positions=new Set(),inputs=new Set(),groups=new Set(),counts={};
 const add=(s,name)=>{if(Q.outcome(s)!=='ongoing')return;try{I.validate(s);}catch{return;}
  positions.add(hash(I.positionKey(s)));inputs.add(hash(I.encode(s)));counts[name]=(counts[name]||0)+1;};
 const addPath=(states,name,children=false)=>{for(const s of states){add(s,name);if(children&&Q.outcome(s)==='ongoing')for(const m of Q.moveVariants(s))add(Q.applyMove(s,m).state,name);}
  const prefix=states.slice(0,13);if(prefix.length===13&&prefix.every(s=>Q.outcome(s)==='ongoing'))groups.add(hash(prefix.map(I.positionKey)));};
 const transition=require('./transition-verification.json');
 for(const policy of ['random','noisy','greedy','reply'])for(let i=0;i<transition.seedBlock.count;i++){
  const g=C.play('three',[policy,policy],C.seedAt(transition.seedBlock.startIndex+i),0,true);
  addPath([E.initialState(),...g.path.map(x=>x.after)],'stage1',true);
 }
 const search=require('./search-verification-spec.json');
 for(const policy of search.policies)for(let i=0;i<search.seedsPerPolicy;i++){
  const g=C.play('three',[policy,policy],C.seedAt(search.seedStartIndex+i),0,true);
  addPath([E.initialState(),...g.path.map(x=>x.after)],'stage2',true);
 }
 for(const policy of P.spec.pilot.policies)for(let i=0;i<P.spec.pilot.seedCount;i++)addPath(P.trajectory(policy,P.spec.pilot.seedStartIndex+i).states,'stage3',true);
 const infrastructure=require('./formal-development-spec.json');
 for(const policy of infrastructure.policies)for(let i=0;i<infrastructure.seedCount;i++)addPath(P.trajectory(policy,infrastructure.seedStartIndex+i).states,'infrastructurePilot',true);
 const calibration=require('./teacher-feasibility-corpus.json');
 for(const r of calibration.rows){let g=S.initialGame();g.board.player=r.origin.first;const states=[g.board];
  for(const m of r.moves){g=S.apply(g,m);states.push(g.board);}assert.deepEqual(g.board,r.state);addPath(states,'calibration',true);}
 // Valid 64-KETE tactical input fixtures; invalid sparse boards cannot enter the domain.
 let g=S.initialGame();for(const m of [{type:'takata',phase:'namua',row:0,index:6,direction:'left'},
  {type:'capture',phase:'namua',row:0,index:4,direction:'left',side:'right'},
  {type:'takata',phase:'namua',row:0,index:5,direction:'left'}]){g=S.apply(g,m);add(g.board,'tactical');}
 for(const base of [E.initialState(),g.board])for(const hand of [0,1,2,5,base.reserve[base.player]])for(const protectedStone of [0,1]){
  const s=JSON.parse(JSON.stringify(base)),p=s.player;s.pits[p][1][0]+=s.reserve[p]+s.nyakuaReserve[p]-hand-protectedStone;
  s.reserve[p]=hand;s.nyakuaReserve[p]=protectedStone;add(s,'tactical');
 }
 const anomaly=require('../nyakua-three/results/anomalies/self-random-three-3435580265-game.json');
 addPath([E.initialState(),...anomaly.path.map(x=>x.after)],'tactical',true);
 const payload={id:'NAKAKAMADO-DEVELOPMENT-EXCLUSIONS-v1',rulesVersion:'0.8.0',
  scope:'stored-development-corpora-plus-conservative-whole-path-and-one-ply-neighbourhoods',
  sources:sourceHashes(),positionHashes:[...positions].sort(),inputHashes:[...inputs].sort(),openingGroups:[...groups].sort(),visits:counts};
 return {...payload,digest:hash(payload)};
}
function validateRegistry(r){const {digest,...payload}=r;assert.equal(digest,hash(payload),'Registry checksum');assert.deepEqual(r.sources,sourceHashes(),'Registry sources');
 for(const k of ['positionHashes','inputHashes','openingGroups']){assert.ok(Array.isArray(r[k]));assert.deepEqual(r[k],[...new Set(r[k])].sort());assert.ok(r[k].every(x=>/^[a-f0-9]{64}$/.test(x)));}return r;}
if(require.main===module){try{assert.equal(process.argv.length,3);const r=makeRegistry();fs.writeFileSync(process.argv[2],JSON.stringify(r)+'\n');
 console.log(JSON.stringify({id:r.id,digest:r.digest,positions:r.positionHashes.length,inputs:r.inputHashes.length,openingGroups:r.openingGroups.length,visits:r.visits}));
}catch{console.error('Development registry failed; no payload logged');process.exitCode=1;}}
module.exports={makeRegistry,validateRegistry,sourceHashes};
