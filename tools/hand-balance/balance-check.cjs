"use strict";
const assert=require("node:assert/strict");
const {initial,advance,variants,score,select,rng,play,seedAt}=require("./balance.cjs");
function brute(b,d,side,kind) {
 if(b.winner!==null||d===0)return score(b,side,kind);
 const values=variants(b).map(m=>brute(advance(b,m).b,d-1,side,kind));
 return b.player===side?Math.max(...values):Math.min(...values);
}
let cases=0;const hands=[12,8,6];
for(const hand of hands) {
 for(let i=0;i<8;i++) {
   const path=play(hand,["random","random"],seedAt(1000+i),0,true).path;
   for(const index of [0,Math.floor(path.length/2),path.length-1]) {
     const b=path[index].before,side=b.player;
     for(const depth of [2,3,4])for(const kind of ["material","mobility"]) {
       const chosen=select(b,"search"+depth+"-"+kind,rng(3456),{searchNodes:0});
       const values=variants(b).map(m=>brute(advance(b,m).b,depth-1,side,kind));
       assert.equal(brute(advance(b,chosen).b,depth-1,side,kind),Math.max(...values));
       cases++;
     }
   }
 }
}
console.log(JSON.stringify({alphaBetaVersusIndependentBrute:cases,status:"PASS"}));
