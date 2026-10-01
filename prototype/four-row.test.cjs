"use strict";
const assert=require("node:assert/strict");
const test=require("node:test");
const E=require("./four-row-engine.js");
const S=require("./steal.js").createForEngine(E);
const total=b=>[...b.reserve,...b.pending,...b.pits.flat(2)].reduce((a,v)=>a+v,0);
function position() {
 const moves=[{type:"takata",phase:"namua",row:0,index:6,direction:"left"},
  {type:"capture",phase:"namua",row:0,index:4,direction:"left",side:"right"},
  {type:"takata",phase:"namua",row:0,index:5,direction:"left"}];
 return moves.reduce((g,m)=>S.apply(g,m),S.initialGame());
}
test("playable rules fix 32 pits, hand22, protection and one-pit bulk",()=>{
 const b=S.initialGame().board;
 assert.equal(b.pits.flat(2).length,32);assert.deepEqual(b.reserve,[22,22]);
 assert.deepEqual(b.pits[0],[[0,0,0,0,6,2,2,0],Array(8).fill(0)]);
 assert.equal(total(b),64);assert.equal(E.NYAKUA_PROTECT_LAST,true);
 assert.equal(E.NYAKUA_FIXED_PIT_BULK,true);assert.equal(E.SOWING_PATH,"ring");
});
test("sowing crosses into the rear row and completes a sixteen-pit ring",()=>{
 for(const [start,dir,end] of [[{player:0,row:0,index:7},"right",{player:0,row:1,index:7}],
  [{player:0,row:1,index:0},"right",{player:0,row:0,index:0}],
  [{player:0,row:0,index:0},"left",{player:0,row:1,index:0}],
  [{player:0,row:1,index:7},"left",{player:0,row:0,index:7}]])assert.deepEqual(E.nextPit(0,start,dir),end);
 for(const dir of ["left","right"]) {
  const start={player:0,row:0,index:4};let cursor=start;const seen=new Set();
  for(let i=0;i<16;i++){seen.add(`${cursor.row}:${cursor.index}`);cursor=E.nextPit(0,cursor,dir);}
  assert.equal(seen.size,16);assert.deepEqual(cursor,start);
 }
});
test("multiple captures transfer exactly one, but never the last reserve KETE",()=>{
 const before=position(),side=before.board.player,op=1-side;
 const move=S.moveVariants(before).find(m=>m.index===4&&m.side==="right");assert.ok(move);
 for(const hand of [0,1,2,5]) {
  const g=E.clone(before);g.board.reserve[side]+=g.board.reserve[op]-hand;g.board.reserve[op]=hand;
  const unchanged=E.clone(g),r=S.applyWithEvents(g,move),entry=r.game.history.at(-1);
  assert.deepEqual(g,unchanged);assert.ok(entry.captures>=2);
  assert.equal(entry.stolen,Number(hand>=2));assert.equal(r.game.board.reserve[op],hand-Number(hand>=2));
  assert.equal(total(r.game.board),64);assert.deepEqual(r.events.at(-1).state,r.game.board);
  assert.equal(entry.placed,hand===0?g.board.reserve[side]:1);
 }
});
test("one-pit bulk places all reserve once and enters common MTAJI",()=>{
 const g=position(),side=g.board.player,op=1-side;
 const m=S.moveVariants(g).find(m=>m.index===4&&m.side==="right");
 g.board.reserve[side]+=g.board.reserve[op];g.board.reserve[op]=0;
 const count=g.board.reserve[side],r=S.applyWithEvents(g,m),placements=r.events.filter(e=>e.kind==="reserve");
 assert.equal(placements.length,1);assert.equal(placements[0].count,count);
 assert.equal(placements[0].state.pits[side][0][m.index],g.board.pits[side][0][m.index]+count);
 assert.deepEqual(r.game.board.reserve,[0,0]);assert.equal(r.game.board.phase,"mtaji");
 assert.equal(r.game.history.at(-1).stolen,0);assert.equal(total(r.game.board),64);
});
test("MTAJI captures do not activate NYAKUA",()=>{
 const g=position();g.board.phase="mtaji";g.board.reserve=[0,0];
 const m=S.moveVariants(g).find(m=>m.type==="capture");assert.ok(m);
 const r=S.apply(g,m);assert.equal(r.history.at(-1).stolen,0);assert.deepEqual(r.board.reserve,[0,0]);
 assert.equal(total(r.board),total(g.board));
});
