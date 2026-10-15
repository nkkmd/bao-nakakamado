'use strict';
// MIT. Complete coverage, local synthesis and immutable original input checks.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const C=require('../v010-balance/core.cjs'),V=require('../v010-balance/diagnostics/proof.cjs'),I=require('./inputs.cjs'),S=require('./study.cjs'),A=require('../v010-branch/compose.cjs'),S4=require('../v010-branch/study.cjs'),PN=require('../v010-pn007/prover.cjs');
function normal(b,t,d){if(C.Q.outcome(b)==='safety-stop')return false;if(b.winner!==null)return b.winner===t;if(d===0)return false;const values=C.S.moveVariants({board:b,history:[]}).map(m=>normal(C.S.apply({board:b,history:[]},m).board,t,d-1));return b.player===t?values.some(Boolean):values.every(Boolean);}
test('010 rows and all 6 moves / 33 responses are verified; known parent is retained without exploring five irrelevant replies',()=>{
 assert.equal(I.load().rows.length,2);assert.equal(I.parents().length,6);assert.equal(I.allReplies().length,33);assert.equal(I.roots().length,27);assert.equal(I.knownParents().length,1);assert.equal(I.knownParents()[0].certificate.target,1);assert.equal(I.knownParents()[0].certificate.depth,53);V.verify(I.knownParents()[0].certificate);
 assert.deepEqual(I.parents().map(p=>p.move),C.S.moveVariants({board:I.whole().state,history:[]}));for(const p of I.parents()){assert.deepEqual(p.state,C.S.apply({board:I.whole().state,history:[]},p.move).board);const replies=I.allReplies().filter(r=>r.parentId===p.id);assert.deepEqual(replies.map(r=>r.move),C.S.moveVariants({board:p.state,history:[]}));for(const r of replies)assert.deepEqual(r.state,C.S.apply({board:p.state,history:[]},r.move).board);}
 const known=I.knownParents()[0];assert.ok(!I.roots().some(r=>r.parentId===known.id));assert.equal(I.allReplies().filter(r=>r.parentId===known.id).length,6);assert.equal(I.pinnedCertificates()[0].certificate.depth,52);
 const incomplete=I.parents().map(p=>p.id===known.id?known.certificate:null);assert.equal(A.compose(I.whole().state,incomplete),null);
});
test('new partition roots agree with the normal engine exhaustive values for both targets and depths 0..2',()=>{for(const r of I.roots())for(const depth of [0,1,2])for(const target of [0,1]){const x=PN.prove(r.state,target,{maxDepth:depth,maxNodes:1000000,wallMs:30000});assert.equal(x.status,normal(r.state,target,depth)?'PROVED':'UNKNOWN');if(x.certificate)V.verify(x.certificate);else assert.equal(x.winner,null);}});
test('quantified synthesis and missing / modified defender responses use the independent verifier',()=>{
 const cert=I.load().composed.find(c=>c.start.turn===15),input=I.prepare(),moves=C.Q.moveVariants(cert.start),children=moves.map(move=>PN.prove(C.Q.applyMove(cert.start,move).state,1,{...input,maxDepth:78,maxNodes:1}).certificate);assert.ok(children.every(Boolean));const composed=A.compose(cert.start,children);V.verify(composed);assert.equal(composed.target,1);children[0]=null;assert.equal(A.compose(cert.start,children),null);
 const bad=structuredClone(composed);bad.nodes[bad.root].children.pop();assert.throws(()=>V.verify(bad));const bad2=structuredClone(composed);bad2.target=0;assert.throws(()=>V.verify(bad2));
});
test('54 partial jobs keep known 53-ply parent, UNKNOWN and all 33 responses; reuse starts no searches and interrupted records HOLD',()=>{
 const input=I.prepare(),out=fs.mkdtempSync(path.join(os.tmpdir(),'retro011-')),m={digest:'development-only',whole:I.whole(),parents:I.parents(),allReplies:I.allReplies(),roots:I.roots(),pinnedReplies:I.pinnedReplies(),inputs:{oldGames:input.oldGames,verifiedStates:input.verifiedStates},contract:{maxDepth:78,parentMaxDepth:79,wholeMaxDepth:80,maxNodes:1,wallMs:1000}};
 try{for(let i=0;i<m.roots.length;i++)for(const t of [0,1]){const x=S.job(out,i,t,m);assert.equal(x.status,'NODE_BUDGET');assert.equal(S.job(out,i,t,m).newSearches,0);}const s=S.aggregate(out,m);assert.equal(s.proofJobs,54);assert.equal(s.primaryBefore13.status,'UNKNOWN');assert.equal(s.primaryBefore13.coveredBranches,1);assert.equal(s.parents.reduce((n,p)=>n+p.replies.length,0),33);assert.equal(s.parents.filter(p=>p.keptKnown).length,1);assert.equal(s.parents.find(p=>p.keptKnown).depth,53);assert.equal(s.initial.status,'UNKNOWN');
 const file=path.join(out,'proof-0-0.json.gz'),row=S4.read(file),bytes=fs.readFileSync(file);row.inputArchiveSha256='bad';assert.throws(()=>S.audit(row,0,0,m));row.inputArchiveSha256=I.SHA;row.checksum='bad';assert.throws(()=>S.audit(row,0,0,m));fs.unlinkSync(file);assert.throws(()=>S.job(out,0,0,m),/HOLD/);fs.writeFileSync(file,bytes);
 }finally{fs.rmSync(out,{recursive:true,force:true});}
});

test('initial legal coverage agrees with normal engine and safety stops never win',()=>{
 const coverage=JSON.parse(fs.readFileSync(path.join(C.root,'doc/v010-retro011/initial-coverage.json')));
 const state=C.E.initialState(),moves=C.S.moveVariants({board:state,history:[]});assert.equal(moves.length,4);assert.deepEqual(coverage.rows.map(r=>r.move),moves);let count=0;
 for(const row of coverage.rows){const b=C.S.apply({board:state,history:[]},row.move).board;assert.deepEqual(row.state,b);const replies=C.S.moveVariants({board:b,history:[]});assert.deepEqual(row.replies.map(r=>r.move),replies);for(const r of row.replies)assert.deepEqual(r.state,C.S.apply({board:b,history:[]},r.move).board);count+=replies.length;}assert.equal(count,14);
 const stopped={...state,reason:'relay-limit',winner:0};for(const target of [0,1]){const r=PN.prove(stopped,target,{maxDepth:5});assert.equal(r.status,'UNKNOWN');assert.equal(r.certificate,null);assert.equal(r.winner,null);}
});
