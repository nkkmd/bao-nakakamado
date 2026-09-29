// Conditional continuation study from reachable asymmetric-hand NAMUA boards.
// No production rule changes. Run from repository root:
// node tools/fixed-pit-triggered-study.cjs 2000 200 0
// node tools/fixed-pit-triggered-study.cjs 2000 200 2000
"use strict";
const S=require('./fixed-pit-bulk-study.cjs');
const MAX_CONTINUATION=400;
function rng(seed){let x=seed>>>0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
function score(b,p){
  if(b.winner!==null)return b.winner===p?100000:-100000;
  const front=q=>b.pits[q][0].reduce((a,x)=>a+x,0);
  const all=q=>b.reserve[q]+b.pits[q].flat().reduce((a,x)=>a+x,0);
  return 2*(front(p)-front(1-p))+all(p)-all(1-p);
}
function choose(E,b,random,policy){
  const moves=E.moveVariantsForSearch(b);
  if(moves.length===1)return moves[0];
  const values=moves.map(move=>{
    const after=S.step(E,b,move).state;
    let value=score(after,b.player)+(move.type==='capture'?2:0);
    if(policy==='reply' && after.winner===null){
      value=Math.min(...E.moveVariantsForSearch(after).map(reply=>score(S.step(E,after,reply).state,b.player)));
    }
    return{move,value};
  });
  const best=Math.max(...values.map(x=>x.value));
  const tied=values.filter(x=>x.value===best);
  return tied[Math.floor(random()*tied.length)].move;
}
function mirror(b){
  const out=JSON.parse(JSON.stringify(b));
  for(const key of ['pits','reserve','houseOwned','pending'])out[key]=[out[key][1],out[key][0]];
  out.player=1-out.player;
  if(out.winner!==null)out.winner=1-out.winner;
  return out;
}
function collect(seedCount,perSide,startIndex=0){
  const positions=[],seen=new Set();
  for(const source of ['random','noisy','greedy']){
    const quotas=[0,0];
    for(let i=startIndex;i<startIndex+seedCount&&quotas.some(x=>x<perSide);i++){
      const g=S.game(S.seedAt(i),source,'current',0,true,true);
      const t=g.trace.find(x=>x.after.phase==='namua' && x.after.reserve.includes(0)
        && x.after.reserve[0]!==x.after.reserve[1]);
      if(!t || t.after.winner!==null)continue;
      const board=t.after,empty=board.reserve[0]===0?0:1;
      if(board.reserve[1-empty]<2 || quotas[empty]>=perSide)continue;
      const key=JSON.stringify({...board,turn:0});
      if(seen.has(key))continue;
      seen.add(key);quotas[empty]++;
      positions.push({source,i,seed:S.seedAt(i),empty,hand:board.reserve[1-empty],board});
    }
    if(quotas.some(x=>x<perSide))throw new Error(`Too few ${source} trigger boards: ${quotas}`);
  }
  return positions;
}
function continueFrom(start,variant,seed,policy='reply'){
  if(policy!=='reply' && policy!=='greedy')throw new Error(`Unknown continuation policy: ${policy}`);
  const E=variant==='fixed'?S.fixed:S.original,random=rng(seed);
  let board=JSON.parse(JSON.stringify(start)),plies=0,bulk=0,passes=0,directNoMove=0;
  while(board.winner===null && plies<MAX_CONTINUATION){
    const move=choose(E,board,random,policy),r=S.step(E,board,move);
    board=r.state;plies++;bulk+=r.bulk>0;passes+=move.type==='pass';
    directNoMove+=r.bulk>0 && board.reason==='no-move';
  }
  return{winner:board.winner,reason:board.reason,plies,bulk,passes,directNoMove,board};
}
function run(seedCount=1000,perSide=50,startIndex=0,policy='reply'){
  const positions=collect(seedCount,perSide,startIndex);
  const groups={};
  for(const p of positions){
    const key=p.source;
    groups[key]??={n:0,handMin:Infinity,handMax:0,changed:0,toEmpty:0,toOther:0,
      currentEmptyWins:0,fixedEmptyWins:0,currentNoMove:0,fixedNoMove:0,
      fixedBulkGames:0,fixedDirectNoMove:0,currentPlies:0,fixedPlies:0,mirrorErrors:0,unfinished:0,
      byEmpty:[{n:0,currentWins:0,fixedWins:0},{n:0,currentWins:0,fixedWins:0}]};
    const g=groups[key];g.n++;g.handMin=Math.min(g.handMin,p.hand);g.handMax=Math.max(g.handMax,p.hand);
    const continuationSeed=(p.seed^0x5bf03635)>>>0;
    const a=continueFrom(p.board,'current',continuationSeed,policy);
    const b=continueFrom(p.board,'fixed',continuationSeed,policy);
    const am=continueFrom(mirror(p.board),'current',continuationSeed,policy);
    const bm=continueFrom(mirror(p.board),'fixed',continuationSeed,policy);
    for(const [x,y] of [[a,am],[b,bm]]){
      if(x.winner===null || y.winner===null)g.unfinished++;
      else if(y.winner!==1-x.winner || x.reason!==y.reason || x.plies!==y.plies)g.mirrorErrors++;
    }
    if(a.winner!==b.winner){g.changed++;g[b.winner===p.empty?'toEmpty':'toOther']++;}
    g.currentEmptyWins+=a.winner===p.empty;g.fixedEmptyWins+=b.winner===p.empty;
    g.byEmpty[p.empty].n++;
    g.byEmpty[p.empty].currentWins+=a.winner===p.empty;
    g.byEmpty[p.empty].fixedWins+=b.winner===p.empty;
    g.currentNoMove+=a.reason==='no-move';g.fixedNoMove+=b.reason==='no-move';
    g.fixedBulkGames+=b.bulk>0;g.fixedDirectNoMove+=b.directNoMove;
    g.currentPlies+=a.plies;g.fixedPlies+=b.plies;
  }
  for(const [source,g] of Object.entries(groups)){
    console.log(JSON.stringify({source,startIndex,continuationPolicy:policy,...g,
      avgCurrentPlies:g.currentPlies/g.n,avgFixedPlies:g.fixedPlies/g.n}));
  }
}
if(require.main===module)run(Number(process.argv[2]||1000),Number(process.argv[3]||50),Number(process.argv[4]||0),process.argv[5]||'reply');
module.exports={mirror,collect,continueFrom,run};
