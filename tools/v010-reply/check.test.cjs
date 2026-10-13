'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const C=require('../v010-balance/core.cjs'),V=require('../v010-balance/diagnostics/proof.cjs'),P=require('../v010-gc/prover.cjs'),I=require('./inputs.cjs'),I4=require('../v010-branch/inputs.cjs'),A=require('../v010-branch/compose.cjs'),S=require('./study.cjs'),S4=require('../v010-branch/study.cjs');
function normal(b,t,d){if(C.Q.outcome(b)==='safety-stop')return false;if(b.winner!==null)return b.winner===t;if(!d)return false;const a=C.S.moveVariants({board:b,history:[]}).map(m=>normal(C.S.apply({board:b,history:[]},m).board,t,d-1));return b.player===t?a.some(Boolean):a.every(Boolean);}
function smallCertificate(b,d){for(const t of [0,1]){const r=P.prove(b,t,{maxDepth:d,maxNodes:200000});if(r.certificate)return r.certificate;}return null;}
test('all 54 pinned records and six wins are checked; 7+10+9 replies cover normal transitions',()=>{
 assert.equal(I.load().length,54);assert.equal(I.prepare().verifiedStates,56105);assert.equal(I.known().length,6);assert.ok(!I.prepare().book.has(C.Q.stateKey(C.E.initialState())));
 assert.equal(I.roots().length,26);for(const p of I.parents()){const roots=I.roots().filter(r=>r.parentId===p.id),legal=C.S.moveVariants({board:p.state,history:[]});assert.deepEqual(roots.map(r=>r.move),legal);for(const r of roots){assert.equal(r.state.turn,21);assert.deepEqual(r.state,C.S.apply({board:p.state,history:[]},r.move).board);assert.equal(r.path.length,20);}}
 assert.deepEqual(I.parents().map(p=>I.roots().filter(r=>r.parentId===p.id).length),[7,10,9]);
});
test('two-level existential/all-response synthesis agrees with independent exhaustive normal engine',()=>{
 const game=require('../v010-certainty/inputs.cjs').load().find(r=>r.games).games[0];let b=game.start;const states=[C.E.initialState()];for(const [i,tr]of game.turns.entries()){if(i>=game.turns.length-5)states.push(b);b=C.S.apply({board:b,history:[]},tr.move).board;}
 for(const root of states)for(let d=3;d<=5;d++){const parents=C.Q.moveVariants(root).map(m=>{const p=C.Q.applyMove(root,m).state;if(C.Q.outcome(p)!=='ongoing')return smallCertificate(p,d-1);return A.compose(p,C.Q.moveVariants(p).map(reply=>smallCertificate(C.Q.applyMove(p,reply).state,d-2)));});const cert=A.compose(root,parents);
  for(const t of [0,1])assert.equal(cert?.target===t,normal(root,t,d));if(cert)V.verify(cert);}
});
test('six known successors cannot certify the whole move 19; missing defender response is rejected',()=>{
 const p=I4.parents().find(r=>r.ply===19),cs=I4.roots().filter(r=>r.parentId===p.id).map(r=>I.known().find(k=>k.id===r.id)?.certificate||null);assert.equal(A.compose(p.state,cs),null);
 const c=I4.load().find(r=>r.index===14&&r.target===1).result.certificate,book=I.prepare().book,children=C.Q.moveVariants(c.start).map(m=>P.prove(C.Q.applyMove(c.start,m).state,1,{book,maxDepth:17,maxNodes:1}).certificate);assert.ok(children.every(Boolean));V.verify(A.compose(c.start,children));children[0]=null;assert.equal(A.compose(c.start,children),null);
 const bad=JSON.parse(JSON.stringify(c));bad.nodes[bad.root].children.pop();assert.throws(()=>V.verify(bad));
});
test('52 partial jobs preserve UNKNOWN, zero-search reuse, HOLD and fixed input rejection',()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'reply-005-')),m={digest:'development-only',parents:I.parents(),roots:I.roots(),inputs:{oldGames:420,verifiedStates:56105},contract:{maxDepth:2,maxNodes:1,wallMs:1000,maxCache:100,maxStoredNodes:1000,collectAt:800,collectTarget:600,maxHeapBytes:1610612736,parentMaxDepth:79,wholeMaxDepth:80}};
 try{for(let i=0;i<m.roots.length;i++)for(const t of [0,1]){assert.equal(S.job(out,i,t,m).status,'NODE_BUDGET');assert.equal(S.job(out,i,t,m).newSearches,0);}const s=S.aggregate(out,m);assert.equal(s.proofJobs,52);assert.equal(s.primaryBefore19.status,'UNKNOWN');assert.equal(s.primaryBefore19.coveredBranches,6);assert.ok(s.parents.every(p=>p.winner===null));assert.equal(s.initial.status,'UNKNOWN');
  const file=path.join(out,'proof-0-0.json.gz'),bytes=fs.readFileSync(file),r=S4.read(file);r.inputArchiveSha256='0'.repeat(64);assert.throws(()=>S.audit(r,0,0,m));r.inputArchiveSha256=I.SHA;r.pinnedInput.verifiedStates++;assert.throws(()=>S.audit(r,0,0,m));fs.unlinkSync(file);assert.throws(()=>S.job(out,0,0,m),/HOLD/);fs.writeFileSync(file,bytes);
 }finally{fs.rmSync(out,{recursive:true,force:true});}
});
