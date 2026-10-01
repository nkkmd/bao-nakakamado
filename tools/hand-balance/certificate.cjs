"use strict";
// Independent Boolean AND/OR search: no evaluation function or alpha-beta.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {E,S,REF}=require('./balance.cjs');
const b=E.initialState();b.reserve=[6,6];
const memo=new Map(),nodes={},ids=new Map();let visited=0;
const moves=x=>S.moveVariants({board:x,history:[]});
const step=(x,m)=>S.apply({board:x,history:[]},m).board;
const key=(x,d)=>JSON.stringify([d,x]);
function winning(x,d){
 visited++;if(x.winner!==null)return x.winner===0;
 if(d===0)return false;
 const k=key(x,d);if(memo.has(k))return memo.get(k);
 const ms=moves(x);assert.ok(ms.length);
 const ok=x.player===0?ms.some(m=>winning(step(x,m),d-1)):ms.every(m=>winning(step(x,m),d-1));
 memo.set(k,ok);return ok;
}
function certify(x,d){
 assert.ok(winning(x,d));const k=key(x,d);if(ids.has(k))return ids.get(k);
 const id=String(ids.size);ids.set(k,id);nodes[id]={board:x,remaining:d,edges:[]};
 if(x.winner!==null)return id;
 let ms=moves(x);if(x.player===0)ms=[ms.find(m=>winning(step(x,m),d-1))];
 for(const move of ms)nodes[id].edges.push({move,to:certify(step(x,move),d-1)});
 return id;
}
const start=Date.now(),root=certify(b,13);
const certificate={reference:REF,hand:6,first:0,maxPlies:13,root,nodes};
fs.writeFileSync('results/winning-certificate.json',JSON.stringify(certificate,null,2)+'\n');
fs.writeFileSync('results/certificate-generation.json',JSON.stringify({status:'PASS',visited,memoStates:memo.size,certificateNodes:Object.keys(nodes).length,elapsedMs:Date.now()-start},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',visited,certificateNodes:Object.keys(nodes).length}));
