"use strict";
// MIT. Only previously excluded development trajectories and normal-replay fixtures.
const assert=require('node:assert/strict'),P=require('./learning-pipeline.cjs'),I=require('./learning-input.cjs');
const A=require('./formal-collection.cjs'),T=require('./teacher-feasibility.cjs'),spec=require('./model-search-spec.json');
const E=require('../../prototype/next-turn-engine.js'),S=require('../../prototype/steal.js').createForEngine(E);
const registry=require('./formal-development-exclusions.json'),Registry=require('./formal-registry.cjs');
function corpus(){
 Registry.validateRegistry(registry);const excluded=new Set(registry.positionHashes),rows=new Map();
 const add=(state,origin)=>{if(state.winner!==null||state.reason!=='')return;I.validate(state);
  const id=A.hash(I.positionKey(state));assert.ok(excluded.has(id),'Development root must already be excluded');
  if(!rows.has(id))rows.set(id,{id,origin,state:JSON.parse(JSON.stringify(state)),tags:T.tags(state)});};
 for(const [policy,index] of spec.developmentPaths){
  const states=P.trajectory(policy,index).states;let g=S.initialGame();g.board.player=index%2;
  add(g.board,{policy,index,ply:0});
  for(let ply=1;ply<states.length;ply++){
   const key=JSON.stringify(states[ply]),m=S.moveVariants(g).find(m=>JSON.stringify(S.apply(g,m).board)===key);
   assert.ok(m,'Normal replay edge missing');g=S.apply(g,m);assert.deepEqual(g.board,states[ply]);add(g.board,{policy,index,ply});
  }
 }
 for(const row of require('../../'+spec.reservedOnlyFixtures).rows.filter(r=>T.tags(r.state).reservedOnly)){
  T.replayCertificate(row);add(row.state,{...row.origin,source:spec.reservedOnlyFixtures});
 }
 const values=[...rows.values()];for(const tag of spec.requiredCoverage)assert.ok(values.some(r=>r.tags[tag]),'Missing coverage '+tag);
 return values;
}
module.exports={corpus};
