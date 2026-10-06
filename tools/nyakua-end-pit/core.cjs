"use strict";
// MIT; see ../../LICENSE.
const assert = require('node:assert/strict'), R = require('./engine.cjs');
function rng(seed) {let x = seed >>> 0; return () => {x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296;};}
function seedAt(i) {return (0xa06a2026 + Math.imul(i + 1, 0x9e3779b1)) >>> 0;}
function key(b) {return JSON.stringify([b.pits,b.reserve,b.nyakuaReserve,b.pending,b.houseOwned,b.player,b.phase,b.winner,b.reason]);}
function swap(b) {const c=JSON.parse(JSON.stringify(b)); for(const k of ['pits','reserve','nyakuaReserve','pending','houseOwned']) c[k].reverse(); c.player=1-c.player; if(c.winner!==null)c.winner=1-c.winner; return c;}
function validate(b) {
  const counts=[...b.pits.flat(2),...b.reserve,...b.nyakuaReserve,...b.pending];
  assert.ok(counts.every(n=>Number.isSafeInteger(n)&&n>=0));
  assert.equal(counts.reduce((a,n)=>a+n,0),64);
}
function rawMoves(model,b) {return R.engine(model).legalMoves(b).flatMap(m=>m.phase==='namua'&&m.type==='capture'?[{...m,houseChoice:'stop'},{...m,houseChoice:'use'}]:[m]);}
function children(model,b) {
  const out=[], seen=new Set();
  for(const m of rawMoves(model,b)) {const r=R.advance(model,b,m); validate(r.b); const k=key(r.b); if(!seen.has(k)){seen.add(k);out.push({m,...r});}}
  return out;
}
function score(model,b,p,mobility=false) {
  if(b.reason==='relay-limit')return 0;
  if(b.winner!==null)return b.winner===p?100000:-100000;
  const o=1-p, front=i=>b.pits[i][0].reduce((a,n)=>a+n,0), all=i=>b.pits[i].flat().reduce((a,n)=>a+n,0)+b.reserve[i]+b.nyakuaReserve[i];
  let v=2*(front(p)-front(o))+all(p)-all(o);
  if(mobility){const c=JSON.parse(JSON.stringify(b)),E=R.engine(model);c.player=p;const n=E.legalMoves(c).length;c.player=o;v+=2*(n-E.legalMoves(c).length)+b.pits[p][0].filter(Boolean).length-b.pits[o][0].filter(Boolean).length;}
  return v;
}
function choose(model,b,policy,random,stats) {
  const cs=children(model,b),p=b.player;assert.ok(cs.length);
  if(policy==='random'||cs.length===1)return cs[Math.floor(random()*cs.length)];
  let values;
  if(['noisy','greedy','reply'].includes(policy)) values=cs.map(c=>policy==='reply'&&c.b.winner===null?Math.min(...children(model,c.b).map(d=>score(model,d.b,p))):score(model,c.b,p));
  else {
    const depth=Number(policy.match(/search(\d+)/)[1]),mobility=policy.includes('mobility'),budget=depth>=6?4000:12000;
    let nodes=0,complete=0;const table=new Map();
    function solve(pos,d,alpha,beta) {
      if(++nodes>budget)throw Error('NODE_BUDGET');
      if(pos.winner!==null||d===0)return score(model,pos,p,mobility);
      const k=d+':'+key(pos),aa=alpha,bb=beta,cached=table.get(k);
      if(cached){if(cached.flag==='exact')return cached.v;if(cached.flag==='lower')alpha=Math.max(alpha,cached.v);else beta=Math.min(beta,cached.v);if(alpha>=beta)return cached.v;}
      const max=pos.player===p,sub=children(model,pos);assert.ok(sub.length);
      sub.sort((a,b)=>(max?-1:1)*(score(model,a.b,p,mobility)-score(model,b.b,p,mobility)));
      let best=max?-Infinity:Infinity;
      for(const c of sub){const v=solve(c.b,d-1,alpha,beta);best=max?Math.max(best,v):Math.min(best,v);if(max)alpha=Math.max(alpha,best);else beta=Math.min(beta,best);if(alpha>=beta)break;}
      table.set(k,{v:best,flag:best<=aa?'upper':best>=bb?'lower':'exact'});return best;
    }
    values=cs.map(c=>score(model,c.b,p,mobility));
    for(let d=1;d<=depth;d++){try{const next=cs.map(c=>solve(c.b,d-1,-Infinity,Infinity));values=next;complete=d;}catch(e){if(e.message!=='NODE_BUDGET')throw e;break;}}
    stats.searchNodes+=nodes;stats.budgetStops+=Number(complete<depth);stats.completedDepthSum+=complete;stats.searchDecisions++;
  }
  const best=Math.max(...values),slack=policy==='noisy'?7:0,options=cs.filter((c,i)=>values[i]>=best-slack);
  return options[Math.floor(random()*options.length)];
}
function play(model,policies,seed,swapStreams=false,trace=false) {
  let b=R.engine(model).initialState();
  const streams=[rng(seed^0xa341316c),rng(seed^0xc8013ea4)];if(swapStreams)streams.reverse();
  const stats={plies:0,namuaMoves:0,mtajiMoves:0,nyakua:0,passes:0,searchNodes:0,budgetStops:0,searchDecisions:0,completedDepthSum:0,maxRelays:0,backAdds:0,houseAdds:0};
  const history=[],seen=new Set([key(b)]);let cutoff=null;
  while(b.winner===null&&stats.plies<400){
    const before=b,c=choose(model,b,policies[b.player],streams[b.player],stats);b=c.b;validate(b);
    stats.plies++;stats.namuaMoves+=Number(before.phase==='namua');stats.mtajiMoves+=Number(before.phase==='mtaji');stats.nyakua+=c.entry.stolen;stats.passes+=Number(c.m.type==='pass');
    stats.maxRelays=Math.max(stats.maxRelays,c.events.filter(e=>e.kind==='relay').length);
    stats.backAdds+=Number(c.entry.endpoint?.row===1);stats.houseAdds+=Number(c.entry.endpoint?.row===0&&c.entry.endpoint?.index===4);
    if(trace)history.push({move:c.m,entry:c.entry,after:b});
    if(b.reason==='relay-limit'){cutoff='relay-limit';break;}
    if(b.winner===null&&seen.has(key(b))){cutoff='repetition';break;}seen.add(key(b));
  }
  if(b.winner===null&&!cutoff)cutoff='400-ply';
  return {model,policies,seed,swapStreams,...stats,winner:cutoff?null:b.winner,reason:cutoff||b.reason,final:b,...(trace?{history}:{})};
}
function wilson(w,n){if(!n)return null;const z=1.959964,p=w/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [100*(c-h),100*(c+h)];}
function summarize(pairs) {
  const gs=pairs.flatMap(x=>x.games),normal=gs.filter(g=>g.winner!==null),w=normal.filter(g=>g.winner===0).length;
  const complete=pairs.filter(x=>x.games.every(g=>g.winner!==null)),v=complete.map(x=>x.games.filter(g=>g.winner===0).length/2),mean=v.reduce((a,n)=>a+n,0)/v.length;
  const se=v.length>1?Math.sqrt(v.reduce((a,n)=>a+(n-mean)**2,0)/(v.length-1)/v.length):null;
  const sum=k=>gs.reduce((a,g)=>a+g[k],0),plies=gs.map(g=>g.plies).sort((a,b)=>a-b);
  return {pairs:pairs.length,n:gs.length,normal:normal.length,firstWins:w,secondWins:normal.length-w,firstWinPct:100*w/normal.length,
    descriptiveWilson95Pct:wilson(w,normal.length),completePairs:complete.length,pairMeanFirstWinPct:100*mean,
    pairCluster95Pct:se===null?null:[Math.max(0,100*(mean-1.959964*se)),Math.min(100,100*(mean+1.959964*se))],
    firstWinsAllGameBoundsPct:[100*w/gs.length,100*(w+gs.length-normal.length)/gs.length],
    avgPlies:sum('plies')/gs.length,p95Plies:plies[Math.ceil(gs.length*.95)-1],maxPlies:plies.at(-1),avgNamuaMoves:sum('namuaMoves')/gs.length,
    mtajiPlayed:gs.filter(g=>g.mtajiMoves>0).length,nyakua:sum('nyakua'),passes:sum('passes'),backAdds:sum('backAdds'),houseAdds:sum('houseAdds'),
    maxRelays:Math.max(...gs.map(g=>g.maxRelays)),searchNodes:sum('searchNodes'),budgetStops:sum('budgetStops'),
    avgCompletedDepth:sum('completedDepthSum')/sum('searchDecisions'),reasons:gs.reduce((a,g)=>(a[g.reason]=(a[g.reason]||0)+1,a),{})};
}
module.exports={R,rng,seedAt,key,swap,validate,rawMoves,children,score,choose,play,summarize};
