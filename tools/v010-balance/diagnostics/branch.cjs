'use strict';
// MIT. A single-move intervention along a pinned original trace; exploratory.
const fs=require('node:fs'),z=require('node:zlib'),assert=require('node:assert/strict'),C=require('../core.cjs');
const [src,out,profile,plyText,choiceText]=process.argv.slice(2),ply=Number(plyText),choice=Number(choiceText);
const input=fs.readFileSync(src+'/'+profile+'-0.json.gz'),row=JSON.parse(z.gunzipSync(input)),old=row.games[0];
let game={board:C.E.clone(old.start),history:[]};for(const t of old.turns.slice(0,ply-1))game=C.S.apply(game,t.move);
const start=C.E.clone(game.board),legal=C.Q.moveVariants(start),forced=legal[choice];assert.ok(forced);
const config={id:'NAKAKAMADO-V010-PRE-MTAJI-INTERVENTION-001',posthoc:true,profile,ply,choice,forced,
  originalMove:old.turns[ply-1].move,seed:old.seed,nodes:8192,inputSha256:C.hash(input),sourceSha256:C.fingerprint()};
fs.mkdirSync(out,{recursive:true});const file=out+'/'+profile+'-'+ply+'-'+choice+'.json';
if(fs.existsSync(file))throw Error('Existing intervention result');
const ai=C.Research.createAI(C.Q,{now:()=>0}),turns=C.E.clone(old.turns.slice(0,ply-1));
let stop='ply-limit';const seen=new Set([C.positionKey(game.board)]);
for(let i=ply-1;i<400&&C.Q.outcome(game.board)==='ongoing';i++){
 const b=game.board,r=ai.analyzeMove(b,{maxNodes:8192,maxDepth:32,exactRoot:true,tieSeed:old.seed,timeLimitMs:60000,quiescenceDepth:1});
 const move=i===ply-1?forced:r.move,before=C.Q.stateKey(b);game=C.S.apply(game,move);C.invariant(game.board);
 turns.push({move,before,after:C.Q.stateKey(game.board),player:b.player,phase:b.phase,elapsedMs:0,stats:r.stats,summary:game.history.at(-1),intervened:i===ply-1});
 if(C.Q.outcome(game.board)!=='ongoing')break;const k=C.positionKey(game.board);if(seen.has(k)){stop='state-repeat';break;}seen.add(k);
}
const status=C.Q.outcome(game.board);if(status!=='ongoing')stop=status;
const g={profile:'branch-intervention',seed:old.seed,firstPlayer:0,start:old.start,turns,final:game.board,stop,
 firstWin:status==='normal-terminal'?Number(game.board.winner===0):null,
 trajectory:C.hash(turns.map(t=>[t.move.type,t.move.phase,t.move.row,t.move.index,t.move.direction,t.move.side,t.move.houseChoice,t.move.houseTwo]))};
C.auditGame(g);fs.writeFileSync(file,JSON.stringify({config,game:g,checksum:C.hash(g)}));
console.log(JSON.stringify({profile,ply,choice,move:forced,firstWin:g.firstWin,plies:turns.length,stop}));
