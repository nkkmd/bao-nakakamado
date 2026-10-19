'use strict';
// MIT. Read-only legal enumeration. No AI calls or proof searches.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {C}=require('../v010-followup/core.cjs');
const opening=require('../v010-followup/registry.cjs').openings().find(o=>o.id==='opening-2-1');
let game=C.S.initialGame();for(const move of opening.moves)game=C.S.apply(game,move);
assert.equal(C.Q.stateKey(game.board),opening.startKey);
const branches=C.S.moveVariants(game).map(third=>{
 const next=C.S.apply(game,third);
 return {third,stateKey:C.Q.stateKey(next.board),replies:C.S.moveVariants(next).map(fourth=>({fourth,stateKey:C.Q.stateKey(C.S.apply(next,fourth).board)}))};
});
assert.equal(branches.length,2);assert.deepEqual(branches.map(x=>x.replies.length).sort(),[5,6]);
const output={studyId:'019',status:'PLANNED-NOT-SEALED-NOT-LAUNCHED',openingId:opening.id,startKey:opening.startKey,forcedPrefix:opening.moves,branches,thirdOnlyRoots:2,fourthForcedRoots:11,policyPairs:4,budgets:[2048,8192,32768],cells:156,pairsPerCell:4,proposedPairs:624,proposedGames:1248,newGames:0,newProofSearches:0};
fs.writeFileSync('doc/v010-balance019/input-inventory.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({roots:13,cells:156,proposedGames:1248,newGames:0,newProofSearches:0}));
