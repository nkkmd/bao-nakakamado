'use strict';
// MIT. Post-hoc paired interventions; results are exploratory, never formal samples.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('../core.cjs'),R=C.Research.createAI(C.Q,{now:()=>0});
const out=process.argv[2],nodes=Number(process.argv[3]),initialChoice=Number(process.argv[4]),index=Number(process.argv[5]||0);
fs.mkdirSync(out,{recursive:true});
const manifest=require('../formal-manifest.json'),seed=Number.parseInt(C.hash([manifest.contract.seedDomain,index]).slice(0,8),16);
const initial=C.E.initialState(),moves=C.Q.moveVariants(initial),forced=moves[initialChoice];assert.ok(forced);
const config={id:'NAKAKAMADO-V010-FIRST-MOVE-INTERVENTION-001',posthoc:true,nodes,initialChoice,forced,seed,index,maxPlies:400,
  formalManifestDigest:manifest.digest,sourceSha256:C.fingerprint(),diagnosticSha256:C.hash(fs.readFileSync(__filename))};
const file=path.join(out,`${nodes}-${initialChoice}-${index}.json`);
if(fs.existsSync(file)){const saved=JSON.parse(fs.readFileSync(file));assert.deepEqual(saved.config,config);assert.equal(saved.checksum,C.hash(saved.game));C.auditGame(saved.game);console.log(JSON.stringify({reused:true,file}));process.exit(0);}
if(fs.existsSync(file+'.started'))throw Error('HOLD interrupted intervention');fs.writeFileSync(file+'.started',JSON.stringify(config),{flag:'wx'});
let game={board:initial,history:[]},turns=[],seen=new Set([C.positionKey(initial)]),stop='ply-limit';
for(let ply=0;ply<400&&C.Q.outcome(game.board)==='ongoing';ply++){
  const b=game.board,r=R.analyzeMove(b,{maxNodes:nodes,maxDepth:32,exactRoot:true,tieSeed:seed,timeLimitMs:60000,quiescenceDepth:1});
  const move=ply===0?forced:r.move;assert.ok(C.Q.moveVariants(b).some(m=>C.Public.moveKey(m)===C.Public.moveKey(move)));
  const before=C.Q.stateKey(b);game=C.S.apply(game,move);C.invariant(game.board);
  turns.push({move,before,after:C.Q.stateKey(game.board),player:b.player,phase:b.phase,elapsedMs:0,stats:r.stats,summary:game.history.at(-1),intervened:ply===0});
  if(C.Q.outcome(game.board)!=='ongoing')break;const k=C.positionKey(game.board);if(seen.has(k)){stop='state-repeat';break;}seen.add(k);
}
const outcome=C.Q.outcome(game.board);if(outcome!=='ongoing')stop=outcome;
const g={profile:`intervention-${nodes}`,seed,firstPlayer:0,start:initial,turns,final:game.board,stop,
  firstWin:outcome==='normal-terminal'?Number(game.board.winner===0):null,
  trajectory:C.hash(turns.map(t=>[t.move.type,t.move.phase,t.move.row,t.move.index,t.move.direction,t.move.side,t.move.houseChoice,t.move.houseTwo]))};
C.auditGame(g);const row={config,game:g,checksum:C.hash(g)};fs.writeFileSync(file+'.tmp',JSON.stringify(row));fs.renameSync(file+'.tmp',file);
console.log(JSON.stringify({nodes,initialChoice,index,seed,move:forced,firstWin:g.firstWin,plies:turns.length,stop}));
