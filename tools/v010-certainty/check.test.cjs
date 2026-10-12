'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const C=require('../v010-balance/core.cjs'),I=require('./inputs.cjs'),P=require('./prover.cjs'),S=require('./study.cjs'),V=require('../v010-balance/diagnostics/proof.cjs');
const exhaustive=(b,target,d)=>{if(C.Q.outcome(b)==='safety-stop')return false;if(b.winner!==null)return b.winner===target;if(!d)return false;
 const values=C.S.moveVariants({board:b,history:[]}).map(m=>exhaustive(C.S.apply({board:b,history:[]},m).board,target,d-1));return b.player===target?values.some(Boolean):values.every(Boolean);};
test('19 roots faithfully replay all 14 openings and five earlier trace states',()=>{
 const roots=I.roots();assert.equal(roots.length,19);assert.deepEqual([0,1,2,3].map(i=>roots.filter(r=>r.firstIndex===i).length),[4,4,2,4]);
 for(const r of roots){let b=C.E.initialState();for(const m of r.path)b=C.S.apply({board:b,history:[]},m).board;assert.deepEqual(b,r.state);}
});
test('frozen 420 old games are audited; unused data cannot become proof book wins',()=>{
 const p=I.prepare();assert.equal(p.oldGames,420);assert.equal(p.verifiedStates,1424);
 assert.ok(!p.book.has(C.Q.stateKey(C.E.initialState())));assert.ok(p.guidance[0].size>0&&p.guidance[1].size>0);
});
test('enhanced caching matches independent exhaustive normal transitions',()=>{
 const games=I.load().filter(r=>r.games).slice(0,3).map(r=>r.games[0]),states=[];
 for(const g of games){let b=g.start;for(const [i,tr]of g.turns.entries()){if(i>=g.turns.length-4)states.push(b);b=C.S.apply({board:b,history:[]},tr.move).board;}}
 for(const b of [C.E.initialState(),I.roots()[0].state,I.roots()[18].state,...states.slice(0,8)])for(const target of [0,1])for(const maxDepth of [1,2,3,4,5]){
  const r=P.prove(b,target,{maxDepth,maxNodes:500000,wallMs:60000,maxCache:2});assert.equal(r.status==='PROVED',exhaustive(b,target,maxDepth));if(r.certificate)V.verify(r.certificate);
 }
});
test('new and old book certificates preserve defender responses and depth bounds',()=>{
 const c=I.load().find(r=>r.index===8&&r.target===1&&r.result?.certificate).result.certificate;
 for(const target of [0,1]){const r=P.prove(c.start,target,{book:I.prepare().book,maxDepth:14});assert.equal(r.winner,1);assert.equal(r.status,target===1?'PROVED':'OPPONENT-PROVED');V.verify(r.certificate);}
 const bounded=P.prove(c.start,1,{book:I.prepare().book,maxDepth:1,maxNodes:10000});assert.equal(bounded.certificate,null);
 const children=c.nodes[c.root].children,parts=children.map(e=>({status:'PROVED',target:1,depth:c.nodes[e.to].depth,start:C.Q.applyMove(c.start,e.move).state,root:e.to,nodes:c.nodes}));
 const combined=P.attach(c.start,children.map(e=>e.move),parts,1);V.verify(combined);assert.equal(combined.depth,14);
 assert.throws(()=>P.attach(c.start,children.slice(1).map(e=>e.move),parts.slice(1),1),/coverage/);
 assert.throws(()=>P.attach(C.E.initialState(),[C.Q.moveVariants(C.E.initialState())[0]],[c],0),/Wrong certificate|state mismatch/);
});
test('node, wall and memory stops retain an unknown winner',()=>{
 const b=C.E.initialState();const r=P.prove(b,0,{maxNodes:1});assert.equal(r.status,'NODE_BUDGET');assert.equal(r.winner,null);
 let tick=0;const w=P.prove(b,0,{wallMs:1,now:()=>tick++});assert.equal(w.status,'WALL_BUDGET');assert.equal(w.certificate,null);
 const h=P.prove(b,0,{maxHeapBytes:1,heap:()=>2});assert.equal(h.status,'MEMORY_BUDGET');assert.equal(h.winner,null);
});
test('completed jobs reuse with zero search; interrupted jobs HOLD; fabricated proofs rejected',()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'certainty-test-')),m={digest:'development-only',roots:I.roots(),contract:{maxDepth:2,maxNodes:1,wallMs:1000,maxCache:100,maxStoredNodes:1000,maxHeapBytes:1610612736}};
 for(let i=0;i<m.roots.length;i++)for(const t of [0,1]){S.job(out,i,t,m);assert.equal(S.job(out,i,t,m).newSearches,0);}
 const r=S.aggregate(out,m);assert.equal(r.initial.status,'UNKNOWN');assert.equal(r.proofJobs,38);assert.equal(r.newGames,0);
 const file=path.join(out,'proof-0-0.json.gz'),row=S.read(file);row.result.status='PROVED';row.result.winner=0;row.checksum=C.hash(row.result);assert.throws(()=>S.audit(row,0,0,m));
 fs.unlinkSync(file);assert.throws(()=>S.job(out,0,0,m),/HOLD/);fs.rmSync(out,{recursive:true});
});
