"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const E = require("../../prototype/bounce-engine.js");
// Historical v0.6.0 studies allow taking the opponent's last hand KETE.
const S = require("../../prototype/steal.js").createForEngine(E, { protectLast: false });
const REF = "ec3961c6d178ae5c146d1ffbdeabdce274575b46";
function rng(seed) { let x=seed>>>0; return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;}; }
function seedAt(i) { return (0x924f3aa1 + i*0x9e3779b1)>>>0; }
function initial(hand, first=0) { const b=E.initialState();b.reserve=[hand,hand];b.player=first;return b; }
function validate(b,hand) {
 const values=[...b.reserve,...b.pending,...b.pits.flat(2)];
 assert.ok(values.every(x=>Number.isInteger(x)&&x>=0));
 assert.equal(values.reduce((a,b)=>a+b,0),20+2*hand);
 assert.notEqual(b.reason,"relay-limit");
}
function variants(b) { return S.moveVariants({board:b,history:[]}); }
function advance(b,m) { const g=S.apply({board:b,history:[]},m);return {b:g.board,entry:g.history[0]}; }
function score(b,side,kind="material") {
 if(b.winner!==null) return b.winner===side?100000:-100000;
 const front=p=>b.pits[p][0].reduce((a,b)=>a+b,0);
 let v=3*(front(side)-front(1-side))+b.reserve[side]-b.reserve[1-side];
 if(kind==="mobility") {
   const a=E.clone(b),c=E.clone(b);a.player=side;c.player=1-side;
   v+=2*(E.legalMoves(a).length-E.legalMoves(c).length);
   v+=b.pits[side][0].filter(x=>x>0).length-b.pits[1-side][0].filter(x=>x>0).length;
 }
 return v;
}
function key(b) { return JSON.stringify([b.pits,b.reserve,b.houseOwned,b.player,b.phase,b.winner,b.pending]); }
function children(b) { return variants(b).map(m=>({m,...advance(b,m)})); }
function select(b,policy,random,stats) {
 const moves=variants(b);
 assert.ok(moves.length);
 if(moves.length===1 || policy==="random")return moves[Math.floor(random()*moves.length)];
 const side=b.player;
 const cs=moves.map(m=>({m,...advance(b,m)}));
 let values;
 if(["noisy","greedy","reply"].includes(policy)) {
 values=cs.map(c=>{
   let v=score(c.b,side)+(c.m.type==="capture"?2:0);
   if(policy==="reply"&&c.b.winner===null) v=Math.min(...children(c.b).map(d=>score(d.b,side)));
   return v;
 });
 } else {
 const match=policy.match(/^search(\d+)(?:-(material|mobility))?$/);
 assert.ok(match,"Unknown policy "+policy);
 const depth=Number(match[1]),kind=match[2]||"material",table=new Map();
 function solve(pos,d,alpha,beta) {
   stats.searchNodes++;
   if(pos.winner!==null||d===0)return score(pos,side,kind);
   const originalAlpha=alpha,originalBeta=beta;
   const k=d+":"+key(pos),cached=table.get(k);
   if(cached!==undefined)return cached;
   const max=pos.player===side;
   let best=max?-Infinity:Infinity,cut=false;
   const sub=children(pos);
   sub.sort((a,b)=>(max?-1:1)*(score(a.b,side,kind)-score(b.b,side,kind)));
   for(const c of sub) {
     const v=solve(c.b,d-1,alpha,beta);
     best=max?Math.max(best,v):Math.min(best,v);
     if(max)alpha=Math.max(alpha,best);else beta=Math.min(beta,best);
     if(alpha>=beta){cut=true;break;}
   }
   if(!cut&&best>originalAlpha&&best<originalBeta)table.set(k,best);
   return best;
 }
 values=cs.map(c=>solve(c.b,depth-1,-Infinity,Infinity));
 }
 const best=Math.max(...values),slack=policy==="noisy"?7:0;
 const options=cs.filter((c,i)=>values[i]>=best-slack);
 return options[Math.floor(random()*options.length)].m;
}
function play(hand,policies,seed,first=0,trace=false,identityStreams=false) {
 let b=initial(hand,first);
 const random=rng(seed),streams=[rng(seed^0xa341316c),rng(seed^0xc8013ea4)];
 if(identityStreams==="swap")streams.reverse();
 const stats={plies:0,nyakua:0,bulk:0,mtajiMoves:0,passes:0,searchNodes:0};
 const path=[];
 const seen=new Map();
 while(b.winner===null&&stats.plies<400) {
   const role=b.player===first?0:1;
   const r=identityStreams?streams[role]:random;
   const m=select(b,policies[role],r,stats);
   const before=b; const next=advance(b,m);b=next.b;
   validate(b,hand);
   if(b.reason==="no-move") assert.equal(E.legalMoves(b).length,0);
   stats.plies++;stats.nyakua+=next.entry.stolen;stats.bulk+=next.entry.placed>1;
   stats.mtajiMoves+=before.phase==="mtaji";stats.passes+=m.type==="pass";
   if(trace)path.push({before,move:m,after:b,entry:next.entry});
   const k=key(b);seen.set(k,(seen.get(k)||0)+1);
   assert.ok(seen.get(k)<10,"Repeated position");
 }
 assert.notEqual(b.winner,null,"400-ply cutoff");
 return {hand,policies,seed,first,winner:b.winner,firstWon:b.winner===first,reason:b.reason,...stats,final:b,...(trace?{path}:{})};
}
function wilson(w,n) {
 const z=1.959963984540054,p=w/n,d=1+z*z/n;
 const c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;
 return [100*(c-h),100*(c+h)];
}
function summarize(games) {
 const n=games.length,sum=fn=>games.reduce((a,g)=>a+fn(g),0),w=sum(g=>g.firstWon);
 return {n,firstWins:w,secondWins:n-w,firstWinPct:100*w/n,wilson95Pct:wilson(w,n),
   avgPlies:sum(g=>g.plies)/n,mtajiPlayedPct:100*sum(g=>g.mtajiMoves>0)/n,
   bulkPct:100*sum(g=>g.bulk>0)/n,nyakuaPct:100*sum(g=>g.nyakua>0)/n,
   reasons:games.reduce((a,g)=>(a[g.reason]=(a[g.reason]||0)+1,a),{}),
   searchNodes:sum(g=>g.searchNodes)};
}
function mirrorCheck(hand,policy,n=100) {
 let mismatches=0;
 for(let i=0;i<n;i++) {
   const seed=seedAt(1000+i);
   const a=play(hand,[policy,policy],seed,0,true),b=play(hand,[policy,policy],seed,1,true);
   if(a.winner!==1-b.winner||a.plies!==b.plies||a.reason!==b.reason)mismatches++;
   assert.equal(a.path.length,b.path.length);
   for(let j=0;j<a.path.length;j++) {
     const p=E.clone(a.path[j].after);
     p.pits.reverse();p.reserve.reverse();p.houseOwned.reverse();p.pending.reverse();
     p.player=1-p.player;if(p.winner!==null)p.winner=1-p.winner;
     assert.deepEqual(p,b.path[j].after);
     assert.deepEqual(a.path[j].move,b.path[j].move);
   }
 }
 assert.equal(mismatches,0);
 return {hand,policy,pairs:n,mismatches};
}
function boundedProof(hand,maxDepth,nodeBudget) {
 const root=initial(hand),side=root.player,records=[];
 let pv=[];
 for(let depth=1;depth<=maxDepth;depth++) {
   let nodes=0,hits=0;const table=new Map(),start=Date.now();
   function solve(b,d) {
     if(++nodes>nodeBudget)throw new Error("NODE_BUDGET");
     if(b.winner!==null)return b.winner===side?1:-1;
     if(d===0)return 0;
     const k=d+":"+key(b);if(table.has(k)){hits++;return table.get(k);}
     const max=b.player===side;let best=max?-1:1;
     const cs=children(b);
     cs.sort((a,b)=>(max?-1:1)*(score(a.b,side)-score(b.b,side)));
     for(const c of cs) {
       const v=solve(c.b,d-1);
       best=max?Math.max(best,v):Math.min(best,v);
       if((max&&best===1)||(!max&&best===-1))break;
     }
     table.set(k,best);return best;
   }
   try {
     const result=solve(root,depth);
     const record={hand,depth,result:result===1?"FIRST_FORCED_WIN":result===-1?"SECOND_FORCED_WIN":"UNKNOWN",
       nodes,hits,tableSize:table.size,elapsedMs:Date.now()-start};
     records.push(record);console.log(JSON.stringify({proof:record}));
     if(result!==0) {
       let b=root,d=depth;
       while(b.winner===null&&d>0) {
         const max=b.player===side;
         const cs=children(b).map(c=>({...c,v:solve(c.b,d-1)}));
         const best=max?Math.max(...cs.map(c=>c.v)):Math.min(...cs.map(c=>c.v));
         const c=cs.find(c=>c.v===best);pv.push({move:c.m,after:c.b,value:c.v});
         b=c.b;d--;
       }
       break;
     }
   } catch(e) {
     if(e.message!=="NODE_BUDGET")throw e;
     records.push({hand,depth,result:"BUDGET_STOP",nodes,hits,tableSize:table.size,elapsedMs:Date.now()-start});
     break;
   }
 }
 return {hand,records,pv};
}
if(require.main===module) {
 const args=process.argv.slice(2),mode=args[0]||"self",n=Number(args[1]||5000);
 const policies=(args[2]||"random,noisy,greedy,reply").split(","),out=args[3]||"results.json";
 const hands=(args[4]||"12,8,6").split(",").map(Number);
 assert.ok(["self","proof"].includes(mode),"Mode must be self or proof");
 assert.ok(Number.isSafeInteger(n)&&n>0,"Positive integer count/depth required");
 assert.ok(hands.length&&hands.every(h=>[12,8,6].includes(h)),"Hands must be 12,8,6");
 const result={reference:REF,createdAt:new Date().toISOString(),mode,n,seedStartIndex:1000,rows:[]};
 for(const hand of hands) {
   if(mode==="proof"){result.rows.push(boundedProof(hand,n,Number(policies[0])));continue;}
   for(const policy of policies) {
     const games=[];
     for(let i=0;i<n;i++)games.push(play(hand,[policy,policy],seedAt(1000+i)));
     const batches=[];for(let i=0;i<n;i+=1000)batches.push(summarize(games.slice(i,i+1000)));
     const row={hand,policy,...summarize(games),batches};
     result.rows.push(row);console.log(JSON.stringify(row));
   }
 }
 if(mode==="self") {
   result.mirrorChecks=[];
   for(const hand of hands)for(const policy of policies)result.mirrorChecks.push(mirrorCheck(hand,policy,Math.min(n,100)));
 }
 fs.writeFileSync(out,JSON.stringify(result,null,2)+"\n");
}
module.exports={E,S,REF,rng,seedAt,initial,validate,variants,advance,score,select,play,summarize,mirrorCheck,boundedProof};
