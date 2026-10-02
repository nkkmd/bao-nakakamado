"use strict";
const assert=require('node:assert/strict'),test=require('node:test');
const E=require('./next-turn-engine.js'),S=require('./steal.js').createForEngine(E);
const total=b=>[...b.pits.flat(2),...b.reserve,...b.nyakuaReserve,...b.pending].reduce((a,n)=>a+n,0);
function position(){return [{type:'takata',phase:'namua',row:0,index:6,direction:'left'},
 {type:'capture',phase:'namua',row:0,index:4,direction:'left',side:'right'},
 {type:'takata',phase:'namua',row:0,index:5,direction:'left'}].reduce((g,m)=>S.apply(g,m),S.initialGame());}
test('v0.8.0 uses protected separate reserves and no bulk',()=>{
 const b=S.initialGame().board;assert.equal(total(b),64);assert.deepEqual(b.nyakuaReserve,[0,0]);
 assert.equal(E.RULES_VERSION,'0.8.0');assert.equal(E.NYAKUA_NEXT_TURN_THREE,true);assert.equal(E.NYAKUA_FIXED_PIT_BULK,false);
});
test('steal is stored separately, survives opponent turn, and is used next own turn',()=>{
 let g=position(),p=g.board.player,o=1-p;const m=S.moveVariants(g).find(x=>S.apply(g,x).history.at(-1).stolen);assert.ok(m);
 const ordinary=g.board.reserve[p];g=S.apply(g,m);assert.equal(g.board.reserve[p],ordinary-1);assert.equal(g.board.nyakuaReserve[p],1);
 g=S.apply(g,S.moveVariants(g)[0]);assert.equal(g.board.nyakuaReserve[p],1);
 const r=S.applyWithEvents(g,S.moveVariants(g)[0]),entry=r.game.history.at(-1),event=r.events.find(x=>x.kind==='reserve');
 assert.equal(entry.ordinaryPlaced,2);assert.equal(entry.reservedPlaced,1);assert.equal(entry.placed,3);assert.equal(event.count,3);
 assert.equal(event.state.pits[p][event.position.row][event.position.index],g.board.pits[p][event.position.row][event.position.index]+3);
 assert.equal(r.game.board.nyakuaReserve[p],entry.stolen);assert.equal(total(r.game.board),64);assert.deepEqual(r.events.at(-1).state,r.game.board);
});
test('endgame 3, 2, or 1 placement protects the last ordinary and all reserved KETE',()=>{
 const fixture=position();
 for(const hand of [0,1,2,5])for(const enemy of [0,1,2,5]){
  const g=E.clone(fixture),p=g.board.player,o=1-p;g.board.reserve[p]=hand;g.board.reserve[o]=enemy;g.board.nyakuaReserve=[1,1];
  for(const m of S.moveVariants(g)){
   assert.notEqual(m.type,'pass');const before=E.clone(g),r=S.applyWithEvents(g,m),entry=r.game.history.at(-1);
   assert.deepEqual(g,before);assert.equal(entry.placed,Math.min(hand,2)+1);assert.equal(entry.reservedPlaced,1);
   assert.equal(entry.stolen,Number(entry.captures>=2&&enemy>=2));assert.equal(r.game.board.reserve[o],enemy-entry.stolen);assert.equal(r.game.board.nyakuaReserve[o],1);
   assert.equal(total(r.game.board),total(g.board));assert.deepEqual(r.events.at(-1).state,r.game.board);
  }
 }
});
test('a three-KETE move can steal again for the following own turn',()=>{
 const g=position(),p=g.board.player;g.board.nyakuaReserve[p]=1;
 const m=S.moveVariants(g).find(x=>S.apply(g,x).history.at(-1).stolen);assert.ok(m);const r=S.apply(g,m),entry=r.history.at(-1);
 assert.equal(entry.placed,3);assert.equal(entry.stolen,1);assert.equal(r.board.nyakuaReserve[p],1);
});
test('own ordinary zero with reserved one is a move, not a pass, and postpones MTAJI',()=>{
 const g=S.initialGame();g.board.reserve=[1,0];g.board.nyakuaReserve=[0,1];
 const a=S.apply(g,S.moveVariants(g)[0]);assert.equal(a.board.phase,'namua');assert.notEqual(S.moveVariants(a)[0].type,'pass');
 const b=S.apply(a,S.moveVariants(a)[0]);assert.equal(b.history.at(-1).placed,1);assert.equal(b.board.phase,'mtaji');
});
test('NYUMBA continues to sow exactly two after three-KETE placement',()=>{
 const g=S.initialGame();g.board.pits[0][0][5]=g.board.pits[0][0][6]=0;g.board.nyakuaReserve[0]=1;
 const m=S.moveVariants(g).find(x=>x.houseTwo),r=S.applyWithEvents(g,m);assert.equal(r.game.history.at(-1).placed,3);assert.equal(r.events.find(x=>x.kind==='lift').count,2);
 assert.equal(r.events.find(x=>x.kind==='lift').state.pits[0][0][4],7);
});
test('replay checks both kinds of placement and MTAJI never steals',()=>{
 let g=position();g=S.apply(g,S.moveVariants(g)[0]);assert.deepEqual(S.replay(g.history),g);
 const bad=E.clone(g.history);bad.at(-1).reservedPlaced++;assert.throws(()=>S.replay(bad),/reserved placement/);
 const b=position();b.board.phase='mtaji';b.board.reserve=[0,0];b.board.nyakuaReserve=[0,0];
 for(const m of S.moveVariants(b)){const r=S.apply(b,m);assert.equal(r.history.at(-1).placed,0);assert.equal(r.history.at(-1).stolen,0);}
});
