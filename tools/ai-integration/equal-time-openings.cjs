"use strict";
// MIT. Short generator-only prefixes. Does not load teacher rows, ciphertext or keys.
const assert=require('node:assert/strict');
const E=require('../../prototype/next-turn-engine.js'),Q=require('../../prototype/search-transition.js').createForEngine(E);
const S=require('../../prototype/steal.js').createForEngine(E),C=require('../nyakua-three/core.cjs');
const P=require('./learning-pipeline.cjs'),I=require('./learning-input.cjs'),R=require('./formal-registry.cjs');
const spec=require('./equal-time-spec.json'),old=require('./formal-collection-spec.json');
const hash=P.hash,clone=x=>JSON.parse(JSON.stringify(x));
function physical(s){return JSON.stringify([s.pits,s.reserve,s.nyakuaReserve,s.pending,s.houseOwned,s.player,s.phase,s.winner,s.reason]);}
function prefix(policy,index,plies=spec.openingPlies){
 assert.ok(old.policies.includes(policy));assert.ok(Number.isSafeInteger(index)&&index>=0);assert.ok(Number.isSafeInteger(plies)&&plies>=0&&plies<=12);
 let game=S.initialGame();game.board.player=index%2;
 const seed=C.seedAt(index),random=[C.rng(seed^0xa341316c),C.rng(seed^0xc8013ea4)];
 const states=[clone(game.board)],moves=[],seen=new Set([physical(game.board)]);let cutoff=null;
 while(moves.length<plies&&Q.outcome(game.board)==='ongoing'){
  const b=game.board,p=b.player,cs=Q.moveVariants(b).map(move=>({move,next:Q.applyMove(b,move).state}));assert.ok(cs.length);
  let pool=cs;
  if(policy!=='random'){
   const values=cs.map(c=>policy==='reply'&&Q.outcome(c.next)==='ongoing'
    ?Math.min(...Q.moveVariants(c.next).map(m=>C.score(Q.applyMove(c.next,m).state,p)))
    :C.score(c.next,p)+(c.move.type==='capture'?2:0));
   const best=Math.max(...values);pool=cs.filter((c,i)=>values[i]>=best-(policy==='noisy'?7:0));
  }
  const chosen=pool[Math.floor(random[p]()*pool.length)];game=S.apply(game,chosen.move);assert.deepEqual(game.board,chosen.next);
  moves.push(chosen.move);states.push(clone(game.board));
  if(Q.outcome(game.board)!=='ongoing'){cutoff=Q.outcome(game.board);break;}
  if(seen.has(physical(game.board))){cutoff='repetition';break;}seen.add(physical(game.board));
 }
 const complete=moves.length===plies&&!cutoff;
 return {policy,seedIndex:index,seed,first:index%2,moves,states,cutoff,complete,
  group:complete?hash(states.map(I.positionKey)):null,rootSha256:hash(game.board)};
}
function opening(t){assert.ok(t.complete);return {policy:t.policy,seedIndex:t.seedIndex,seed:t.seed,first:t.first,
  moves:t.moves,group:t.group,rootSha256:t.rootSha256};}
function replayOpening(o){
 const t=prefix(o.policy,o.seedIndex,o.moves.length);assert.deepEqual(opening(t),o,'Opening generator or record changed');
 let g=S.initialGame();g.board.player=o.first;for(const m of o.moves)g=S.apply(g,m);
 assert.equal(hash(g.board),o.rootSha256);I.validate(g.board);return g;
}
function registry(){return R.validateRegistry(require('./formal-development-exclusions.json'));}
function pilotOpenings(){const r=registry(),groups=new Set(r.openingGroups);
 return spec.pilotOpenings.map(x=>{const o=opening(prefix(x.policy,x.seedIndex));assert.ok(groups.has(o.group),'Pilot must be development-excluded');return o;});}
function oldGroups({progress=()=>{}}={}){
 const groups=new Set();let valid=0,short=0;
 for(const policy of old.policies){
  for(let i=0;i<old.seedCount;i++){const t=prefix(policy,old.seedStartIndex+i,old.openingPlies);if(t.complete){groups.add(t.group);valid++;}else short++;}
  progress({phase:'original-generator-prefixes',policy,valid,short});
 }
 return {groups,valid,short,digest:hash([...groups].sort())};
}
function formalOpenings({progress=()=>{}}={}){
 const r=registry(),historical=oldGroups({progress}),excluded=new Set([...r.openingGroups,...historical.groups]);
 const positions=new Set(r.positionHashes),inputs=new Set(r.inputHashes),selectedGroups=new Set(),selectedPositions=new Set();
 const d=spec.formalDesign,result=[],counts={short:0,excludedGroup:0,excludedRoot:0,duplicateGroup:0,duplicateRoot:0};
 for(const policy of d.policies)for(const first of [0,1]){
  // Hash ordering is fixed before any match, separately in each policy/starting-side stratum.
  const indexes=Array.from({length:d.candidateSeedCount},(_,i)=>d.candidateSeedStart+i).filter(i=>i%2===first)
   .sort((a,b)=>hash([d.orderingSalt,policy,a]).localeCompare(hash([d.orderingSalt,policy,b]),'en'));
  let accepted=0;
  for(const index of indexes){
   const t=prefix(policy,index);if(!t.complete){counts.short++;continue;}
   if(excluded.has(t.group)){counts.excludedGroup++;continue;}
   const root=t.states.at(-1),position=hash(I.positionKey(root));
   if(positions.has(position)||inputs.has(hash(I.encode(root)))){counts.excludedRoot++;continue;}
   if(selectedGroups.has(t.group)){counts.duplicateGroup++;continue;}
   if(selectedPositions.has(position)){counts.duplicateRoot++;continue;}
   selectedGroups.add(t.group);selectedPositions.add(position);result.push(opening(t));accepted++;
   if(accepted===d.pairsPerPolicyAndStartingSide)break;
  }
  assert.equal(accepted,d.pairsPerPolicyAndStartingSide,'Insufficient independent openings: HOLD without seed expansion');
  progress({phase:'independent-prefixes',policy,first,accepted});
 }
 assert.equal(result.length,d.pairs);
 // Interleave all eight strata across each shard, keeping fixed pair IDs.
 const scheduled=Array.from({length:d.pairsPerPolicyAndStartingSide},(_,k)=>Array.from({length:8},(_,s)=>result[s*d.pairsPerPolicyAndStartingSide+k])).flat();
 return {id:d.id,openingPlies:spec.openingPlies,openings:scheduled,
  exclusions:{developmentDigest:r.digest,originalSeedStart:old.seedStartIndex,originalSeedCount:old.seedCount,
   originalPolicies:old.policies,originalValidPrefixes:historical.valid,originalShortPrefixes:historical.short,
   originalUniqueGroups:historical.groups.size,originalGroupsSha256:historical.digest,
   excludedOpeningGroups:excluded.size,selectedUniqueGroups:selectedGroups.size,selectedUniqueRoots:selectedPositions.size,rejections:counts},
  scope:'independent-starting-prefixes-not-disjoint-future-game-states',formalRowsRead:0};
}
module.exports={spec,hash,clone,E,Q,S,physical,prefix,opening,replayOpening,registry,pilotOpenings,oldGroups,formalOpenings};
