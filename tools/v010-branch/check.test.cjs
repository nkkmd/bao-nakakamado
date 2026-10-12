'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),z=require('node:zlib');
const C=require('../v010-balance/core.cjs'),V=require('../v010-balance/diagnostics/proof.cjs'),P=require('../v010-gc/prover.cjs'),I=require('./inputs.cjs'),A=require('./compose.cjs'),S=require('./study.cjs');
function normal(b,target,d){if(C.Q.outcome(b)==='safety-stop')return false;if(b.winner!==null)return b.winner===target;if(!d)return false;const rs=C.S.moveVariants({board:b,history:[]}).map(move=>normal(C.S.apply({board:b,history:[]},move).board,target,d-1));return b.player===target?rs.some(Boolean):rs.every(Boolean);}
test('old 003 certificates and provenance are checked; disjoint splits cover every legal move',()=>{
 assert.equal(I.load().length,34);assert.equal(I.prepare().verifiedStates,34890);assert.equal(I.roots().length,27);
 for(const parent of I.parents()){const roots=I.roots().filter(r=>r.parentId===parent.id),legal=C.S.moveVariants({board:parent.state,history:[]});assert.deepEqual(roots.map(r=>r.move),legal);for(const r of roots)assert.deepEqual(r.state,C.S.apply({board:parent.state,history:[]},r.move).board);}
 assert.deepEqual(I.parents().map(p=>C.Q.moveVariants(p.state).length),[9,4]);
});
test('split synthesis agrees with independent exhaustive physical transitions',()=>{
 const game=require('../v010-certainty/inputs.cjs').load().find(r=>r.games).games[0];let state=game.start;const states=[C.E.initialState()];for(const [i,tr] of game.turns.entries()){if(i>=game.turns.length-5)states.push(state);state=C.S.apply({board:state,history:[]},tr.move).board;}
 for(const b of states)for(let d=2;d<=5;d++){const certificates=C.Q.moveVariants(b).map(move=>{const next=C.Q.applyMove(b,move).state;for(const target of [0,1]){const r=P.prove(next,target,{maxDepth:d-1,maxNodes:200000});if(r.certificate)return r.certificate;}return null;});
  const cert=A.compose(b,certificates);for(const target of [0,1])assert.equal(cert?.target===target,normal(b,target,d));if(cert)V.verify(cert);}
});
test('unknown defender branch prevents all-response composition; missing, swapped, or tampered proofs fail',()=>{
 const c=JSON.parse(z.gunzipSync(fs.readFileSync(path.join(C.root,'doc/v010-balance/diagnostics/primary-8192-ply29.json.gz'))));
 const children=C.Q.moveVariants(c.start).map(move=>P.prove(C.Q.applyMove(c.start,move).state,1,{maxDepth:9,maxNodes:200000}).certificate);assert.ok(children.every(Boolean));const composed=A.compose(c.start,children);V.verify(composed);
 const absent=[...children];absent[0]=null;assert.equal(A.compose(c.start,absent),null);assert.throws(()=>A.compose(c.start,children.slice(1)));
 const bad=JSON.parse(JSON.stringify(children));bad[0].start.turn++;assert.throws(()=>A.compose(c.start,bad));const dropped=JSON.parse(JSON.stringify(composed));dropped.nodes[dropped.root].children.pop();assert.throws(()=>V.verify(dropped));
});
test('finite horizon, interrupted job, budget stop and nested provenance remain unknown or HOLD',()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'branch-004-')),m={digest:'development-only',parents:I.parents(),roots:I.roots(),contract:{maxCache:100,maxStoredNodes:1000,collectAt:800,collectTarget:600,maxHeapBytes:1610612736,initialMaxDepth:4},budgets:{split:{maxDepth:2,maxNodes:1,wallMs:1000},opening:{maxDepth:2,maxNodes:1,wallMs:1000}}};
 try{assert.throws(()=>S.job(out,9,1,null,m),/Missing/);for(let i=0;i<m.roots.length;i++)for(const target of [0,1]){const r=S.job(out,i,target,out,m);assert.equal(r.status,'NODE_BUDGET');assert.equal(S.job(out,i,target,out,m).newSearches,0);}
 const summary=S.aggregate(out,m);assert.equal(summary.initial.status,'UNKNOWN');assert.ok(summary.parents.every(x=>x.winner===null));
 const file=path.join(out,'proof-0-0.json.gz'),bytes=fs.readFileSync(file),row=S.read(file);row.result.status='PROVED';row.result.winner=0;row.checksum=C.hash(row.result);assert.throws(()=>S.audit(row,0,0,m));fs.unlinkSync(file);assert.throws(()=>S.job(out,0,0,null,m),/HOLD/);assert.throws(()=>S.job(out,9,1,out,m));fs.writeFileSync(file,bytes);
 const later=path.join(out,'proof-9-0.json.gz'),r=S.read(later);r.dependencies[0].sha256='0'.repeat(64);fs.writeFileSync(later,z.gzipSync(JSON.stringify(r)));assert.throws(()=>S.job(out,13,1,out,m));}
 finally{fs.rmSync(out,{recursive:true,force:true});}
});
