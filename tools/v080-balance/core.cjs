"use strict";
const assert=require('node:assert/strict');
const E=require('../../prototype/next-turn-engine.js');
const S=require('../../prototype/steal.js').createForEngine(E);
const T={E},B=E;
const engines={live:{E,initial:()=>E.initialState(),advance:(b,m)=>{const g=S.apply({board:b,history:[]},m);return {b:g.board,entry:g.history[0]};}}};
function rng(seed){let x=seed>>>0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
function seedAt(i){return(0x924f3aa1+i*0x9e3779b1)>>>0;}
function key(b){return JSON.stringify([b.pits,b.reserve,b.nyakuaReserve||[0,0],b.pending,b.houseOwned,b.player,b.phase,b.winner]);}
function total(b){return [...b.pits.flat(2),...b.reserve,...b.pending,...(b.nyakuaReserve||[])].reduce((a,n)=>a+n,0);}
function validate(b){assert.equal(total(b),64);assert.ok([...b.pits.flat(2),...b.reserve,...b.pending,...(b.nyakuaReserve||[])].every(n=>Number.isInteger(n)&&n>=0));}
function children(model,b){const a=engines[model],out=[];for(const m of a.E.legalMoves(b)){
 if(m.phase==='namua'&&m.type==='capture'){
  const stop={...m,houseChoice:'stop'},use={...m,houseChoice:'use'},x=a.advance(b,stop),y=a.advance(b,use);
  if(key(x.b)===key(y.b))out.push({m,...x});else out.push({m:stop,...x},{m:use,...y});
 }else out.push({m,...a.advance(b,m)});
}return out;}
function score(b,p,mobility=false){
 if(b.winner!==null)return b.reason==='relay-limit'?0:b.winner===p?100000:-100000;
 const o=1-p,front=i=>b.pits[i][0].reduce((a,n)=>a+n,0),all=i=>b.pits[i].flat().reduce((a,n)=>a+n,0)+b.reserve[i]+(b.nyakuaReserve?.[i]||0);
 let v=2*(front(p)-front(o))+all(p)-all(o);
 if(mobility){const e=b.nyakuaReserve?T.E:B,c=JSON.parse(JSON.stringify(b));c.player=p;const n=e.legalMoves(c).length;c.player=o;v+=2*(n-e.legalMoves(c).length)+b.pits[p][0].filter(Boolean).length-b.pits[o][0].filter(Boolean).length;}
 return v;
}
function choose(model,b,policy,random,stats){
 const cs=children(model,b),p=b.player;assert.ok(cs.length);
 if(policy==='random'||cs.length===1)return cs[Math.floor(random()*cs.length)];
 let values;
 if(['noisy','greedy','reply'].includes(policy))values=cs.map(c=>policy==='reply'&&c.b.winner===null?Math.min(...children(model,c.b).map(d=>score(d.b,p))):score(c.b,p)+(c.m.type==='capture'?2:0));
 else{
  const depth=Number(policy.match(/search(\d+)/)[1]),mobility=policy.includes('mobility'),budget=depth>=6?30000:Infinity;let nodes=0,complete=0;const table=new Map();
  function solve(pos,d,alpha,beta){if(++nodes>budget)throw Error('BUDGET');if(pos.winner!==null||d===0)return score(pos,p,mobility);
   const k=d+':'+key(pos),cached=table.get(k);if(cached!==undefined)return cached;
   const aa=alpha,bb=beta,max=pos.player===p;let best=max?-Infinity:Infinity,cut=false;
   const sub=children(model,pos);sub.sort((a,b)=>(max?-1:1)*(score(a.b,p,mobility)-score(b.b,p,mobility)));
   for(const c of sub){const v=solve(c.b,d-1,alpha,beta);best=max?Math.max(best,v):Math.min(best,v);if(max)alpha=Math.max(alpha,best);else beta=Math.min(beta,best);if(alpha>=beta){cut=true;break;}}
   if(!cut&&best>aa&&best<bb)table.set(k,best);return best;
  }
  values=cs.map(c=>score(c.b,p,mobility));
  for(let d=1;d<=depth;d++){try{const next=cs.map(c=>solve(c.b,d-1,-Infinity,Infinity));values=next;complete=d;}catch(e){if(e.message!=='BUDGET')throw e;break;}}
  stats.searchNodes+=nodes;stats.budgetStops+=complete<depth;stats.completedDepths ||= {};stats.completedDepths[complete]=(stats.completedDepths[complete]||0)+1;
 }
 const best=Math.max(...values),slack=policy==='noisy'?7:0,options=cs.filter((c,i)=>values[i]>=best-slack);
 return options[Math.floor(random()*options.length)];
}
function play(model,policies,seed,first=0,trace=false,swapStreams=false,opening=null){
 let b=engines[model].initial();b.player=first;
 const streams=[rng(seed^0xa341316c),rng(seed^0xc8013ea4)];if(swapStreams)streams.reverse();
 const stats={plies:0,namuaMoves:0,mtajiMoves:0,nyakua:0,multiPlacements:0,passes:0,searchNodes:0,budgetStops:0,
 nyakuaByRole:[0,0],capturesByRole:[0,0],multiByRole:[0,0],firstNyakuaRole:null,mtajiEntry:null,snapshots:{},opening:null};
 const path=[],seen=new Set([key(b)]);let cutoff=null;
 while(b.winner===null&&stats.plies<400){const before=b,role=b.player===first?0:1;
  const c=stats.plies===0&&opening!==null?children(model,b)[opening]:choose(model,b,policies[role],streams[role],stats);assert.ok(c);b=c.b;validate(b);
  stats.plies++;stats.namuaMoves+=before.phase==='namua';stats.mtajiMoves+=before.phase==='mtaji';stats.nyakua+=c.entry.stolen;stats.multiPlacements+=c.entry.placed>1;stats.passes+=c.m.type==='pass';
  stats.nyakuaByRole[role]+=c.entry.stolen;stats.capturesByRole[role]+=c.entry.captures;stats.multiByRole[role]+=c.entry.placed>1;
  if(c.entry.stolen&&stats.firstNyakuaRole===null)stats.firstNyakuaRole=role;
  if(stats.plies===1)stats.opening=c.m;
  if(before.phase==='namua'&&b.phase==='mtaji')stats.mtajiEntry={ply:stats.plies,nextRole:b.player===first?0:1,terminal:b.winner!==null,materialDiff:material(b,first)-material(b,1-first),frontDiff:front(b,first)-front(b,1-first)};
  if([10,20,30,40].includes(stats.plies))stats.snapshots[stats.plies]={materialDiff:material(b,first)-material(b,1-first),frontDiff:front(b,first)-front(b,1-first),handDiff:b.reserve[first]-b.reserve[1-first],phase:b.phase};
  if(trace)path.push({move:c.m,entry:c.entry,after:b});
  if(b.reason==='relay-limit'){cutoff='relay-limit';break;}
  if(b.winner===null&&seen.has(key(b))){cutoff='repetition';break;}seen.add(key(b));
 }
 if(b.winner===null&&!cutoff)cutoff='400-ply';
 return {model,policies,seed,first,...stats,winner:cutoff?null:b.winner,reason:cutoff||b.reason,firstWon:cutoff?null:b.winner===first,final:b,...(trace?{path}:{})};
}
function front(b,p){return b.pits[p][0].reduce((a,n)=>a+n,0);}
function material(b,p){return b.pits[p].flat().reduce((a,n)=>a+n,0)+b.reserve[p]+b.nyakuaReserve[p]+b.pending[p];}
function wilson(w,n){if(!n)return null;const z=1.959964,p=w/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [100*(c-h),100*(c+h)];}
function summarize(gs){const n=gs.length,completed=gs.filter(g=>g.winner!==null),w=completed.filter(g=>g.firstWon).length,sum=k=>gs.reduce((a,g)=>a+g[k],0),sorted=gs.map(g=>g.plies).sort((a,b)=>a-b);
 return {n,completed:completed.length,firstWins:w,secondWins:completed.length-w,firstWinPct:100*w/completed.length,wilson95Pct:wilson(w,completed.length),avgPlies:sum('plies')/n,medianPlies:(sorted[Math.floor((n-1)/2)]+sorted[Math.floor(n/2)])/2,p95Plies:sorted[Math.ceil(n*.95)-1],maxPlies:sorted.at(-1),avgNamuaMoves:sum('namuaMoves')/n,avgMtajiMoves:sum('mtajiMoves')/n,mtajiPlayedPct:100*gs.filter(g=>g.mtajiMoves>0).length/n,avgNyakua:sum('nyakua')/n,nyakuaPct:100*gs.filter(g=>g.nyakua>0).length/n,passes:sum('passes'),budgetStops:sum('budgetStops'),searchNodes:sum('searchNodes'),reasons:gs.reduce((a,g)=>(a[g.reason]=(a[g.reason]||0)+1,a),{})};
}
module.exports={E,T,B,S,front,material,engines,rng,seedAt,key,total,validate,children,score,choose,play,summarize};
