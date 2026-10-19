'use strict';
// MIT. Enumerate only legal next moves; never invokes an AI or proof search.
const fs=require('node:fs'),assert=require('node:assert/strict'),K=require('../v010-followup/core.cjs'),R=require('../v010-followup/registry.cjs'),{C}=K;
const analysis=JSON.parse(fs.readFileSync('doc/v010-balance018/results-analysis.json'));
const openings=R.openings().filter(o=>o.forced&&o.firstIndex===2).map(o=>{
 let game=C.S.initialGame();for(const m of o.moves)game=C.S.apply(game,m);assert.equal(C.Q.stateKey(game.board),o.startKey);
 const prior=new Set(analysis.prior017FirstDecisionChoices[o.id].map(C.Public.moveKey));const legal=C.S.moveVariants(game),observed=new Set(analysis.cells.filter(c=>c.openingId===o.id).flatMap(c=>c.observedFirstDecisionMoves).map(C.Public.moveKey));assert.ok([...observed].every(k=>legal.some(m=>C.Public.moveKey(m)===k)));
 return {openingId:o.id,stateKey:o.startKey,plyBefore:3,legalFirstDecisionMoves:legal.map(move=>({move,observedInStudy018:observed.has(C.Public.moveKey(move)),observedInStudy017:prior.has(C.Public.moveKey(move))})),legalCount:legal.length,observedCount:observed.size,warning:'Enumeration and observed AI choice only; no continuation search or proof.'};
});
fs.writeFileSync('doc/v010-balance018/decision-frontier.json',JSON.stringify({openings,newGames:0,newProofSearches:0},null,2)+'\n');console.log(JSON.stringify(openings.map(o=>({openingId:o.openingId,legal:o.legalCount,observed:o.observedCount}))));
