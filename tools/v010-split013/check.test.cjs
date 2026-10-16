'use strict';
// MIT. Layered quantifiers, independent shallow minimax and exact-record reuse.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const C=require('../v010-balance/core.cjs'),I=require('./inputs.cjs'),S=require('./study.cjs'),V=require('../v010-balance/diagnostics/proof.cjs'),PN=require('../v010-pn007/prover.cjs'),A=require('../v010-branch/compose.cjs'),S4=require('../v010-branch/study.cjs');
function normal(b,t,d){if(C.Q.outcome(b)==='safety-stop')return false;if(b.winner!==null)return b.winner===t;if(d===0)return false;const values=C.S.moveVariants({board:b,history:[]}).map(m=>normal(C.S.apply({board:b,history:[]},m).board,t,d-1));return b.player===t?values.some(Boolean):values.every(Boolean);}
test('012 records and complete partitions retain 6 parents, 33 replies and 18 deferred roots',()=>{
 assert.equal(I.load().rows.length,12);assert.equal(I.parents().length,6);assert.equal(I.allReplies().length,33);assert.equal(I.splitParents().length,3);assert.equal(I.roots().length,8);assert.equal(I.heldRoots().length,18);assert.equal(I.pinnedCertificates().length,3);assert.equal(I.knownParents().length,2);
 for(const r of I.splitParents()){const moves=C.S.moveVariants({board:r.state,history:[]}),children=I.roots().filter(c=>c.splitRootId===r.id);assert.deepEqual(children.map(c=>c.move),moves);for(const c of children){assert.deepEqual(c.state,C.S.apply({board:r.state,history:[]},c.move).board);assert.equal(c.path.length,r.path.length+1);}}
 const inventory=JSON.parse(fs.readFileSync(path.join(C.root,'doc/v010-split013/inventory.json')));assert.deepEqual(inventory.rows.map(r=>r.onePly),[2,2,4,8,7,8]);assert.equal(inventory.rows.reduce((n,r)=>n+r.twoPly,0),178);
});
test('child values and composed root values agree with ordinary exhaustive search',()=>{
 for(const r of I.roots())for(const d of [0,1,2,3])for(const t of [0,1]){const x=PN.prove(r.state,t,{maxDepth:d,maxNodes:1000000,wallMs:30000});assert.equal(x.status,normal(r.state,t,d)?'PROVED':'UNKNOWN');if(x.certificate)V.verify(x.certificate);}
 for(const r of I.splitParents())for(const d of [1,2,3])for(const t of [0,1]){const cs=I.roots().filter(c=>c.splitRootId===r.id).map(c=>PN.prove(c.state,t,{maxDepth:d-1,maxNodes:1000000,wallMs:30000}).certificate),composed=A.compose(r.state,cs);assert.equal(composed?.target===t,normal(r.state,t,d));if(composed)V.verify(composed);}
});
test('missing defender responses, modified targets and safety stops do not certify wins',()=>{
 const cert=I.load().composed[0];V.verify(cert);const bad=structuredClone(cert),node=Object.values(bad.nodes).find(n=>n.children?.length>1);assert.ok(node);node.children.pop();assert.throws(()=>V.verify(bad));const wrong=structuredClone(cert);wrong.target=1-cert.target;assert.throws(()=>V.verify(wrong));
 const b={...C.E.initialState(),reason:'relay-limit',winner:0};for(const t of [0,1]){const r=PN.prove(b,t,{maxDepth:3});assert.equal(r.status,'UNKNOWN');assert.equal(r.certificate,null);assert.equal(r.winner,null);}
});
test('16 one-visit development goals preserve incomplete split roots, exact reuse and HOLD',()=>{
 const input=I.prepare(),out=fs.mkdtempSync(path.join(os.tmpdir(),'split013-')),m={digest:'development-only',whole:I.whole(),parents:I.parents(),allReplies:I.allReplies(),splitParents:I.splitParents(),roots:I.roots(),heldRoots:I.heldRoots(),pinnedReplies:I.pinnedReplies(),inputs:{oldGames:input.oldGames,verifiedStates:input.verifiedStates},contract:{maxDepth:77,rootMaxDepth:78,parentMaxDepth:79,wholeMaxDepth:80,maxNodes:1,wallMs:1000}};
 try{for(let i=0;i<m.roots.length;i++)for(const t of [0,1]){const r=S.job(out,i,t,m);assert.equal(r.status,'NODE_BUDGET');assert.equal(S.job(out,i,t,m).newSearches,0);}const s=S.aggregate(out,m);assert.equal(s.proofJobs,16);assert.equal(s.primaryBefore13.status,'UNKNOWN');assert.equal(s.primaryBefore13.coveredBranches,2);assert.equal(s.splitRoots.length,3);assert.ok(s.splitRoots.every(r=>r.winner===null));assert.equal(s.heldRoots.length,18);assert.equal(s.parents.reduce((n,p)=>n+p.replies.length,0),33);
 const file=path.join(out,'proof-0-0.json.gz'),bytes=fs.readFileSync(file),row=S4.read(file);row.inputArchiveSha256='bad';assert.throws(()=>S.audit(row,0,0,m));fs.unlinkSync(file);assert.throws(()=>S.job(out,0,0,m),/HOLD/);fs.writeFileSync(file,bytes);
 }finally{fs.rmSync(out,{recursive:true,force:true});}
});
test('positive three-ply child cannot turn one opponent branch into a root win',()=>{
 const prior=require('../v010-deepen012/manifest.json'),selected=prior.roots.filter(r=>r.parentMove.direction==='right');
 for(const r of selected)for(const target of [0,1]){const cs=C.S.moveVariants({board:r.state,history:[]}).map(move=>PN.prove(C.S.apply({board:r.state,history:[]},move).board,target,{maxDepth:3,maxNodes:1000000,wallMs:30000}).certificate),composed=A.compose(r.state,cs);assert.equal(composed?.target===target,normal(r.state,target,4));if(composed)V.verify(composed);}
 const r=selected[0],cs=C.S.moveVariants({board:r.state,history:[]}).map(move=>PN.prove(C.S.apply({board:r.state,history:[]},move).board,1,{maxDepth:3,maxNodes:1000000,wallMs:30000}).certificate);assert.ok(cs.some(Boolean));assert.ok(cs.some(c=>!c));assert.equal(A.compose(r.state,cs),null);
 const cert=cs.find(Boolean);V.verify(cert);assert.equal(cert.depth,3);assert.equal(cert.start.player,1);const children=C.S.moveVariants({board:cert.start,history:[]}).map(move=>PN.prove(C.S.apply({board:cert.start,history:[]},move).board,1,{maxDepth:2,maxNodes:1000000,wallMs:30000}).certificate),win=A.compose(cert.start,children);assert.ok(win);assert.equal(win.target,1);V.verify(win);
});
