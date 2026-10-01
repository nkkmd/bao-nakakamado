"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const E = require("../prototype/four-row-engine.js");
const S = require("../prototype/steal.js").createForEngine(E);
function rng(seed) { let x=seed>>>0;return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;}; }
function seedAt(i) {return (0x924f3aa1+i*0x9e3779b1)>>>0;}
function total(b) {return [...b.reserve,...b.pending,...b.pits.flat(2)].reduce((a,v)=>a+v,0);}
function score(b,side) {
 if(b.winner!==null)return b.winner===side?100000:-100000;
 const front=p=>b.pits[p][E.FRONT].reduce((a,v)=>a+v,0);
 const all=p=>b.reserve[p]+b.pits[p].flat().reduce((a,v)=>a+v,0);
 return 2*(front(side)-front(1-side))+all(side)-all(1-side);
}
function game(seed,policy="random",first=0,details=false) {
 const random=rng(seed);let g=S.initialGame();g.board.player=first;
 const trace=[];let plies=0,bulk=0,stolen=0,passes=0;
 while(g.board.winner===null&&plies<400) {
  const moves=S.moveVariants(g);assert.ok(moves.length);
  let choices=moves;
  if(policy!=="random"&&moves.length>1) {
   const values=moves.map(m=>{
    const b=S.apply({board:g.board,history:[]},m).board;
    let value=score(b,g.board.player)+(m.type==="capture"?2:0);
    if(policy==="reply"&&b.winner===null)value=Math.min(...S.moveVariants({board:b,history:[]}).map(r=>score(S.apply({board:b,history:[]},r).board,g.board.player)));
    return {m,value};
   });
   const best=Math.max(...values.map(v=>v.value));
   choices=values.filter(v=>v.value>=best-(policy==="noisy"?7:0)).map(v=>v.m);
  }
  const m=choices[Math.floor(random()*choices.length)],before=g.board;
  g=S.apply(g,m);const entry=g.history.at(-1);plies++;bulk+=entry.placed>1;stolen+=entry.stolen;passes+=m.type==="pass";
  assert.equal(total(g.board),64);assert.ok([...g.board.reserve,...g.board.pending,...g.board.pits.flat(2)].every(v=>Number.isInteger(v)&&v>=0));
  assert.notEqual(g.board.reason,"relay-limit");
  if(g.board.reason==="no-move"){const b=E.clone(g.board);b.winner=null;b.reason="";assert.equal(E.legalMoves(b).length,0);}
  if(details)trace.push({before,move:m,after:g.board,...entry});
 }
 assert.notEqual(g.board.winner,null,"400-turn cutoff");assert.equal(passes,0);
 return {seed,policy,first,plies,bulk,stolen,passes,winner:g.board.winner,reason:g.board.reason,board:g.board,history:g.history,...(details?{trace}:{})};
}
if(require.main===module) {
 const n=Number(process.argv[2]||100),out=process.argv[3]||"/tmp/four-row-nyakua-check.json",summaries=[];
 let transitions=0,mirrorPairs=0,replays=0;
 for(const p of ["random","noisy","greedy","reply"]) {
  const games=[];
  for(let i=0;i<n;i++) {
   const a=game(seedAt(40000+i),p,0,i<10);games.push(a);
   if(i<10) {
    const b=game(seedAt(40000+i),p,1,true);mirrorPairs++;
    assert.equal(a.trace.length,b.trace.length);
    for(let j=0;j<a.trace.length;j++) {
     const x=E.clone(a.trace[j].after);x.pits.reverse();x.reserve.reverse();x.pending.reverse();x.houseOwned.reverse();x.player=1-x.player;if(x.winner!==null)x.winner=1-x.winner;
     assert.deepEqual(x,b.trace[j].after);assert.deepEqual(a.trace[j].move,b.trace[j].move);
     const before={board:a.trace[j].before,history:[]};
     for(const m of S.moveVariants(before)) {
      const r=S.apply(before,m),events=S.applyWithEvents(before,m);
      assert.deepEqual(r,events.game);assert.deepEqual(events.events.at(-1).state,r.board);transitions++;
     }
    }
    assert.deepEqual(S.replay(a.history).board,a.board);replays++;
   }
  }
  summaries.push({policy:p,n,firstWins:games.filter(g=>g.winner===0).length,avgPlies:games.reduce((a,g)=>a+g.plies,0)/n,bulkGames:games.filter(g=>g.bulk).length,nyakuaGames:games.filter(g=>g.stolen).length});
 }
 const hashes={};const crypto=require('node:crypto');
 for(const file of ['prototype/engine.js','prototype/bulk-engine.js','prototype/four-row-engine.js','prototype/steal.js'])hashes[file]=crypto.createHash('sha256').update(fs.readFileSync(require('node:path').join(__dirname,'..',file))).digest('hex');
 const result={rulesVersion:E.RULES_VERSION,ruleId:E.RULE_ID,node:process.version,nPerPolicy:n,mainGames:4*n,mirrorPairs,replays,transitions,hashes,summaries};
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
module.exports={E,S,rng,seedAt,total,game};
