"use strict";
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createCore}=require('../balance-options/core.cjs');
const {makeEngine}=require('../balance-options/variant-engine.cjs');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
function generate(summary,budget=2000000){
 const record=summary.proof.records.find(r=>r.result==='FIRST_FORCED_WIN'||r.result==='SECOND_FORCED_WIN');
 if(!record)return {status:'NOT_APPLICABLE',reason:'No forced win proved within bounded search'};
 const core=createCore(summary.config,{protectLast:true,reference:summary.reference}),target=record.result==='FIRST_FORCED_WIN'?0:1;
 const memo=new Map(),ids=new Map(),nodes={};let visits=0;
 const key=(b,d)=>JSON.stringify([b,d]);
 function win(b,d){
  if(++visits>budget)throw new Error('CERTIFICATE_BUDGET');
  if(b.winner!==null)return b.winner===target;
  if(!d)return false;
  const k=key(b,d);if(memo.has(k))return memo.get(k);
  const ms=core.variants(b);assert.ok(ms.length);
  const result=b.player===target?ms.some(m=>win(core.advance(b,m).b,d-1)):ms.every(m=>win(core.advance(b,m).b,d-1));
  memo.set(k,result);return result;
 }
 function certificate(b,d){
  assert.ok(win(b,d));const k=key(b,d);if(ids.has(k))return ids.get(k);
  const id=String(ids.size);ids.set(k,id);nodes[id]={board:b,remaining:d,edges:[]};
  if(b.winner!==null)return id;
  let ms=core.variants(b);if(b.player===target)ms=[ms.find(m=>win(core.advance(b,m).b,d-1))];
  for(const move of ms)nodes[id].edges.push({move,to:certificate(core.advance(b,move).b,d-1)});
  return id;
 }
 try{const root=certificate(core.initial(summary.config),record.depth);return {status:'GENERATED',config:summary.config,reference:summary.reference,first:0,target,maxPlies:record.depth,root,nodes,visits,memoStates:memo.size};}
 catch(e){if(e.message!=='CERTIFICATE_BUDGET')throw e;return {status:'BUDGET_STOP',visits,budget};}
}
function verify(c,first=0){
 const {E,S}=makeEngine(c.config,{protectLast:true}),root=E.initialState();root.pits[0][0]=c.config.pits.slice();root.pits[1][0]=c.config.pits.slice();root.reserve[first]=c.config.hands[0];root.reserve[1-first]=c.config.hands[1];root.player=first;
 const data=JSON.parse(JSON.stringify(c)),target=first===0?c.target:1-c.target;
 if(first===1)for(const n of Object.values(data.nodes)){const b=n.board;b.pits.reverse();b.reserve.reverse();b.houseOwned.reverse();b.pending.reverse();b.player=1-b.player;if(b.winner!==null)b.winner=1-b.winner;}
 const equal=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b));equal(data.nodes[data.root].board,root);
 const seen=new Set();let edges=0,defenderMoves=0,leaves=0,maxPlies=0;
 const raw=b=>E.legalMoves(b).flatMap(m=>m.phase==='namua'&&m.type==='capture'?[m,{...m,houseChoice:'stop'},{...m,houseChoice:'use'}]:[m]);
 const next=(b,m)=>S.applyWithEvents({board:b,history:[]},m).game.board;
 const total=2*c.config.pits.reduce((a,v)=>a+v,0)+c.config.hands.reduce((a,v)=>a+v,0);
 function visit(id){
  if(seen.has(id))return;seen.add(id);const n=data.nodes[id];assert.ok(n);const b=n.board,counts=[...b.pits.flat(2),...b.reserve,...b.pending];
  assert.ok(counts.every(v=>Number.isInteger(v)&&v>=0));assert.equal(counts.reduce((a,v)=>a+v,0),total);assert.notEqual(b.reason,'relay-limit');
  if(b.winner!==null){assert.equal(b.winner,target);assert.equal(n.edges.length,0);leaves++;maxPlies=Math.max(maxPlies,c.maxPlies-n.remaining);return;}
  assert.ok(n.remaining>0);const ms=raw(b);assert.ok(ms.length);
  if(b.player===target)assert.equal(n.edges.length,1);
  for(const edge of n.edges){assert.ok(ms.some(m=>JSON.stringify(m)===JSON.stringify(edge.move)));const child=data.nodes[edge.to];assert.ok(child);assert.equal(child.remaining,n.remaining-1);equal(next(b,edge.move),child.board);edges++;visit(edge.to);}
  if(b.player!==target)for(const m of ms){const after=next(b,m);assert.ok(n.edges.some(e=>JSON.stringify(data.nodes[e.to].board)===JSON.stringify(after)),'Missing defender reply');defenderMoves++;}
 }
 visit(data.root);assert.equal(seen.size,Object.keys(data.nodes).length);
 return {status:'PASS',first,target,nodes:seen.size,edges,defenderMoves,terminalLeaves:leaves,maxPlies};
}
if(require.main===module){const dir=process.argv[2],summary=read(path.join(dir,'summary.json')),c=generate(summary);fs.writeFileSync(path.join(dir,'certificate.json'),JSON.stringify(c,null,2)+'\n');
 const result=c.status==='GENERATED'?{status:'PASS',results:[verify(c,0),verify(c,1)]}:{status:c.status,reason:c.reason};
 fs.writeFileSync(path.join(dir,'certificate-check.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({config:summary.config.id,...result}));}
module.exports={generate,verify};

