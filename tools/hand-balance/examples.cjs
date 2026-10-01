"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const {S,initial,play,seedAt}=require("./balance.cjs");
const games=[12,8,6].map(hand=>play(hand,["search3","search3"],seedAt(1000),0,true));
for(const g of games) {
 let current={board:initial(g.hand),history:[]};
 for(const t of g.path) {
   const next=S.applyWithEvents(current,t.move).game;
   assert.deepEqual(next.board,t.after);
   current=next;
 }
 assert.deepEqual(current.board,g.final);
}
fs.writeFileSync("results/example-games.json",JSON.stringify({policy:"search3",seedIndex:1000,replayedWithDisplayTransitions:true,games},null,2)+"\n");
console.log(JSON.stringify({sampleGames:games.length,displayReplayMatches:true}));
