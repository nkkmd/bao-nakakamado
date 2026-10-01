"use strict";
const assert=require('node:assert/strict');
const c=require('./core.cjs'),liveE=require('../../prototype/bounce-engine.js');
const liveS=require('../../prototype/steal.js');
const equal=(a,b)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
let transitions=0,protectedCandidates=0,searchCases=0;
function brute(b,d,side,kind){
 if(b.winner!==null||d===0)return c.score(b,side,kind);
 const values=c.variants(b).map(m=>brute(c.advance(b,m).b,d-1,side,kind));
 return b.player===side?Math.max(...values):Math.min(...values);
}
equal(c.initial(c.config),liveE.initialState());
assert.equal(c.E.RULE_ID,liveE.RULE_ID);
assert.equal(c.E.NYAKUA_PROTECT_LAST,true);
for(let i=0;i<8;i++){
 const g=c.play(c.config,['random','random'],c.seedAt(1000+i),0,true);
 for(const t of g.path){
  const game={board:t.before,history:[]};equal(c.variants(t.before),liveS.moveVariants(game));
  for(const m of c.variants(t.before)){
   const actual=liveS.applyWithEvents(game,m),computed=c.advance(t.before,m);
   equal(actual.game.board,computed.b);equal(actual.game.history[0],computed.entry);
   if(t.before.reserve[1-t.before.player]===1&&computed.entry.captures>=2){
    assert.equal(computed.entry.stolen,0);protectedCandidates++;
   }
   transitions++;
  }
 }
 for(const index of [0,Math.floor(g.path.length/2),g.path.length-1]){
  const b=g.path[index].before,side=b.player;
  for(const d of [2,3,4])for(const kind of ['material','mobility']){
   const m=c.select(b,'search'+d+'-'+kind,c.rng(3456),{searchNodes:0});
   const best=Math.max(...c.variants(b).map(m=>brute(c.advance(b,m).b,d-1,side,kind)));
   assert.equal(brute(c.advance(b,m).b,d-1,side,kind),best);searchCases++;
  }
 }
}
assert.ok(protectedCandidates>0);
console.log(JSON.stringify({status:'PASS',transitions,protectedCandidates,searchCases}));
