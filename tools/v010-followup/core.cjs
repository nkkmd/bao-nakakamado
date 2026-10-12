'use strict';
// MIT. Whole records include forced opening moves; matrices are conditional.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),C=require('../v010-balance/core.cjs');
const P=require('./policies.cjs');
const PAIRS=Object.freeze([[0,0],[1,1],[2,2],[0,2],[2,0],[0,1],[1,0]]);
function play(opening,profiles,seed,firstPlayer,{maxPlies=400}={}){
 let game=C.S.initialGame();if(firstPlayer)game.board=C.mirror(game.board);
 const start=C.E.clone(game.board),turns=[],seen=new Set([C.positionKey(start)]),actors=profiles.map(p=>P.createPolicy(p));let stop='ply-limit';
 for(let ply=0;ply<maxPlies&&C.Q.outcome(game.board)==='ongoing';ply++){
   const b=game.board,role=b.player===firstPlayer?0:1,t=performance.now(),forced=ply<opening.moves.length;
   const r=forced?{move:opening.moves[ply],stats:null}:actors[role].analyzeMove(b,seed);
   assert.ok(C.Q.moveVariants(b).some(m=>C.Public.moveKey(m)===C.Public.moveKey(r.move)));
   const before=C.Q.stateKey(b),normal=C.S.apply(game,r.move);assert.deepEqual(normal.board,C.Q.applyMove(b,r.move).state);game=normal;C.invariant(game.board);
   turns.push({move:r.move,before,after:C.Q.stateKey(game.board),player:b.player,phase:b.phase,elapsedMs:performance.now()-t,
     stats:r.stats,summary:game.history.at(-1),forced,policyId:profiles[role].id});
   if(C.Q.outcome(game.board)!=='ongoing')break;const k=C.positionKey(game.board);if(seen.has(k)){stop='state-repeat';break;}seen.add(k);
 }
 const outcome=C.Q.outcome(game.board);if(outcome!=='ongoing')stop=outcome;
 const g={profile:profiles.map(p=>p.id).join('/'),openingId:opening.id,seed,firstPlayer,start,turns,final:game.board,stop,
   firstWin:outcome==='normal-terminal'?Number(game.board.winner===firstPlayer):null,
   trajectory:C.hash(turns.map(t=>[t.move.type,t.move.phase,t.move.row,t.move.index,t.move.direction,t.move.side,t.move.houseChoice,t.move.houseTwo]))};
 audit(g,opening,profiles,maxPlies);return g;
}
function audit(g,opening,profiles,maxPlies=400){C.auditGame(g);assert.equal(g.openingId,opening.id);assert.ok(g.turns.length<=maxPlies);
 let b=C.E.clone(g.start),seen=new Set([C.positionKey(b)]),repeat=false;
 for(const [i,t]of g.turns.entries()){
   const role=t.player===g.firstPlayer?0:1;assert.equal(t.policyId,profiles[role].id);assert.equal(t.forced,i<opening.moves.length);
   if(t.forced){assert.equal(C.Public.moveKey(t.move),C.Public.moveKey(opening.moves[i]));assert.equal(t.stats,null);}
   else {assert.ok(t.stats);assert.equal(t.stats.maxNodes,profiles[role].nodes);assert.ok(t.stats.nodes<=profiles[role].nodes);
     assert.equal(t.stats.evaluatorId,profiles[role].evaluator==='base'?'NAKAKAMADO-HANDCRAFT-V010-v1':P.ALT_ID);
     if(t.stats.completedDepth){assert.ok(t.stats.exactRootScores);assert.ok(t.stats.exactRootScores.some(r=>C.Public.moveKey(r.move)===C.Public.moveKey(t.move)&&r.score===t.stats.rootScore));}}
   b=C.S.apply({board:b,history:[]},t.move).board;
   if(C.Q.outcome(b)==='ongoing'){const k=C.positionKey(b);if(seen.has(k))repeat=true;seen.add(k);}
 }
 if(g.stop==='ply-limit')assert.equal(g.turns.length,maxPlies);
 assert.equal(repeat,g.stop==='state-repeat');
}
const files=['tools/v010-followup/policies.cjs','tools/v010-followup/registry.cjs','tools/v010-followup/book.cjs','tools/v010-followup/prover.cjs','tools/v010-followup/core.cjs',
 'tools/v010-followup/study.cjs','tools/v010-followup/freeze.cjs','tools/v010-followup/check.test.cjs','tools/v010-followup/archive.py',
 'tools/v010-followup/inputs/primary-8192-0.json.gz','tools/v010-followup/inputs/low-512-0.json.gz','tools/v010-followup/inputs/middle-2048-0.json.gz',
 'doc/v010-balance/diagnostics/intervention-records.zip','doc/v010-balance/diagnostics/primary-8192-ply29.json.gz','doc/v010-balance/diagnostics/low-512-ply51.json.gz',
 'doc/v010-balance/diagnostics/middle-2048-ply55.json.gz','.github/workflows/v010-followup-study.yml'];
function fingerprint(){return {...C.fingerprint(),...Object.fromEntries(files.map(p=>[p,C.hash(fs.readFileSync(path.join(C.root,p)))]))};}
module.exports={C,P,PAIRS,play,audit,fingerprint};
