'use strict';
// MIT. Quantified coverage, shallow independent values and exact resume behavior.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const C=require('../v010-balance/core.cjs'),I=require('./inputs.cjs'),S=require('./study.cjs'),V=require('../v010-balance/diagnostics/proof.cjs'),PN=require('../v010-pn007/prover.cjs'),A=require('../v010-branch/compose.cjs'),S4=require('../v010-branch/study.cjs');
function normal(b,t,d){if(C.Q.outcome(b)==='safety-stop')return false;if(b.winner!==null)return b.winner===t;if(d===0)return false;const values=C.S.moveVariants({board:b,history:[]}).map(m=>normal(C.S.apply({board:b,history:[]},m).board,t,d-1));return b.player===t?values.some(Boolean):values.every(Boolean);}
test('retain 54 old goals, 6 parents, 33 replies, 2 known parents, 3 pinned certificates and 15 deferred roots',()=>{
 assert.equal(I.load().rows.length,54);assert.equal(I.parents().length,6);assert.equal(I.allReplies().length,33);assert.equal(I.roots().length,6);assert.equal(I.heldRoots().length,15);assert.equal(I.pinnedCertificates().length,3);assert.deepEqual(I.knownParents().map(r=>r.certificate.depth).sort((a,b)=>a-b),[51,53]);
 assert.deepEqual(I.parents().map(p=>p.move),C.S.moveVariants({board:I.whole().state,history:[]}));
 for(const p of I.parents()){const b=C.S.apply({board:I.whole().state,history:[]},p.move).board;assert.deepEqual(b,p.state);assert.deepEqual(I.allReplies().filter(r=>r.parentId===p.id).map(r=>r.move),C.S.moveVariants({board:b,history:[]}));}
 for(const r of I.allReplies()){const p=I.parents().find(p=>p.id===r.parentId);assert.deepEqual(r.state,C.S.apply({board:p.state,history:[]},r.move).board);}
 assert.equal(new Set([...I.roots(),...I.heldRoots()].map(r=>r.id)).size,21);
 for(const r of I.roots())assert.equal(r.parentMove.index,4);
 const initial=I.initialRoots();assert.equal(initial.length,14);for(const r of initial){let b=C.E.initialState();for(const m of r.path)b=C.S.apply({board:b,history:[]},m).board;assert.deepEqual(b,r.state);}
});
test('all selected roots and both goals match ordinary exhaustive depth 0..3',()=>{for(const r of I.roots())for(const d of [0,1,2,3])for(const t of [0,1]){const x=PN.prove(r.state,t,{maxDepth:d,maxNodes:1000000,wallMs:30000});assert.equal(x.status,normal(r.state,t,d)?'PROVED':'UNKNOWN');if(x.certificate)V.verify(x.certificate);else assert.equal(x.winner,null);}});
test('missing or modified legal defender replies are rejected; safety stop remains unknown',()=>{
 const cert=I.load().composed.find(c=>c.depth===51);V.verify(cert);const clone=structuredClone(cert);const defender=Object.values(clone.nodes).find(n=>n.children?.length>1);assert.ok(defender);defender.children.pop();assert.throws(()=>V.verify(clone));const bad=structuredClone(cert);bad.target=0;assert.throws(()=>V.verify(bad));
 const cs=new Map(I.knownParents().map(r=>[r.id,r.certificate]));assert.equal(A.compose(I.whole().state,I.parents().map(p=>cs.get(p.id)||null)),null);
 const b={...C.E.initialState(),reason:'relay-limit',winner:0};for(const t of [0,1]){const r=PN.prove(b,t,{maxDepth:5});assert.equal(r.status,'UNKNOWN');assert.equal(r.winner,null);assert.equal(r.certificate,null);}
});
test('12 development goals keep pinned first-player win and deferred roots; exact reuse and interrupted HOLD',()=>{
 const input=I.prepare(),out=fs.mkdtempSync(path.join(os.tmpdir(),'deepen012-')),m={digest:'development-only',whole:I.whole(),parents:I.parents(),allReplies:I.allReplies(),roots:I.roots(),heldRoots:I.heldRoots(),pinnedReplies:I.pinnedReplies(),inputs:{oldGames:input.oldGames,verifiedStates:input.verifiedStates},contract:{maxDepth:78,parentMaxDepth:79,wholeMaxDepth:80,maxNodes:1,wallMs:1000}};
 try{for(let i=0;i<m.roots.length;i++)for(const t of [0,1]){const x=S.job(out,i,t,m);assert.equal(x.status,'NODE_BUDGET');assert.equal(S.job(out,i,t,m).newSearches,0);}const summary=S.aggregate(out,m);assert.equal(summary.proofJobs,12);assert.equal(summary.primaryBefore13.status,'UNKNOWN');assert.equal(summary.primaryBefore13.coveredBranches,2);assert.equal(summary.heldRoots.length,15);assert.equal(summary.parents.reduce((n,p)=>n+p.replies.length,0),33);assert.equal(summary.initial.status,'UNKNOWN');assert.equal(summary.pinnedReplies.filter(r=>r.winner===0).length,1);
 const file=path.join(out,'proof-0-0.json.gz'),bytes=fs.readFileSync(file),r=S4.read(file);r.inputArchiveSha256='bad';assert.throws(()=>S.audit(r,0,0,m));fs.unlinkSync(file);assert.throws(()=>S.job(out,0,0,m),/HOLD/);fs.writeFileSync(file,bytes);
 }finally{fs.rmSync(out,{recursive:true,force:true});}
});
