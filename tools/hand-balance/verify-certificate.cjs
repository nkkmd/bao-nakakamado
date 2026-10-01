"use strict";
// No search/evaluator import. Replays a strategy and covers every defender move.
const fs=require('node:fs'),assert=require('node:assert/strict');
const E=require('../../prototype/bounce-engine.js');
// The saved v0.6.0 certificate allows taking the last opposing hand KETE.
const S=require('../../prototype/steal.js').createForEngine(E,{protectLast:false});
function verify(c){
 assert.equal(c.hand,6);assert.ok(c.first===0||c.first===1);assert.equal(c.maxPlies,13);
 const root=E.initialState();root.reserve=[6,6];root.player=c.first;
 assert.deepEqual(c.nodes[c.root].board,root);
 const checked=new Set();let edges=0,rawDefenderMoves=0,terminalLeaves=0,maxPlies=0;
 const rawMoves=b=>E.legalMoves(b).flatMap(m=>m.phase==='namua'&&m.type==='capture'?
   [m,{...m,houseChoice:'stop'},{...m,houseChoice:'use'}]:[m]);
 const next=(b,m)=>S.applyWithEvents({board:b,history:[]},m).game.board;
 function visit(id){
  if(checked.has(id))return;checked.add(id);const n=c.nodes[id];assert.ok(n);
  const b=n.board,values=[...b.pits.flat(2),...b.reserve,...b.pending];
  assert.ok(values.every(v=>Number.isInteger(v)&&v>=0));assert.equal(values.reduce((a,v)=>a+v,0),32);
  assert.notEqual(b.reason,'relay-limit');
  if(b.winner!==null){assert.equal(b.winner,c.first);assert.equal(n.edges.length,0);terminalLeaves++;maxPlies=Math.max(maxPlies,c.maxPlies-n.remaining);return;}
  assert.ok(n.remaining>0);const ms=rawMoves(b);assert.ok(ms.length);
  if(b.player===c.first)assert.equal(n.edges.length,1);
  for(const e of n.edges){
   assert.ok(ms.some(m=>JSON.stringify(m)===JSON.stringify(e.move)));
   const child=c.nodes[e.to];assert.ok(child);assert.equal(child.remaining,n.remaining-1);
   assert.deepEqual(next(b,e.move),child.board);edges++;visit(e.to);
  }
  if(b.player!==c.first){
   for(const m of ms){const after=next(b,m);assert.ok(n.edges.some(e=>JSON.stringify(c.nodes[e.to].board)===JSON.stringify(after)),'Missing defender reply');rawDefenderMoves++;}
  }
 }
 visit(c.root);assert.equal(checked.size,Object.keys(c.nodes).length);
 return {status:'PASS',first:c.first,nodes:checked.size,edges,rawDefenderMoves,terminalLeaves,maxPlies};
}
if(require.main===module){
const original=JSON.parse(fs.readFileSync('results/winning-certificate.json','utf8'));
const mirrored=structuredClone(original);mirrored.first=1;
for(const n of Object.values(mirrored.nodes)){
 const b=n.board;b.pits.reverse();b.reserve.reverse();b.pending.reverse();b.houseOwned.reverse();b.player=1-b.player;if(b.winner!==null)b.winner=1-b.winner;
}
const results=[verify(original),verify(mirrored)];
fs.writeFileSync('results/certificate-verification.json',JSON.stringify({method:'All defender legal moves, including both house choices; display-event replay; both seats',results},null,2)+'\n');
console.log(JSON.stringify(results));

}
module.exports={verify};
