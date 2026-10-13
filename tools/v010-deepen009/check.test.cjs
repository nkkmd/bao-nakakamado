'use strict';
// MIT. The four unresolved roots and previous three parent proofs remain complete.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const C=require('../v010-balance/core.cjs'),V=require('../v010-balance/diagnostics/proof.cjs'),I=require('./inputs.cjs'),S=require('./study.cjs'),S4=require('../v010-branch/study.cjs'),P=require('../v010-pn007/prover.cjs'),Schedule=require('./schedule.cjs'),A=require('../v010-branch/compose.cjs');
function normal(b,t,d){if(C.Q.outcome(b)==='safety-stop')return false;if(b.winner!==null)return b.winner===t;if(d===0)return false;const a=C.S.moveVariants({board:b,history:[]}).map(m=>normal(C.S.apply({board:b,history:[]},m).board,t,d-1));return b.player===t?a.some(Boolean):a.every(Boolean);}
test('008 originals, three known parents, all four unresolved responses and zero-search book reuse are exact',()=>{
 assert.equal(I.load().rows.length,32);assert.equal(I.parents().length,4);assert.equal(I.allReplies().length,22);assert.equal(I.knownParents().length,3);assert.equal(I.roots().length,4);assert.equal(I.pinnedCertificates().length,3);const parent=I.parents().find(p=>!I.knownParents().some(k=>k.id===p.id));assert.deepEqual(I.roots().map(r=>r.move),C.S.moveVariants({board:parent.state,history:[]}));for(const r of I.roots())assert.deepEqual(r.state,C.S.apply({board:parent.state,history:[]},r.move).board);
 const input=I.prepare();for(const k of I.knownParents())for(const t of [0,1]){const x=P.prove(k.certificate.start,t,{...input,maxDepth:79,maxNodes:1,maxTableEntries:1000000});assert.equal(x.visits,0);assert.equal(x.winner,1);V.verify(x.certificate);assert.equal(x.status,t===1?'PROVED':'OPPONENT-PROVED');}
 assert.equal(A.compose(I.whole().state,I.parents().map(p=>I.knownParents().find(k=>k.id===p.id)?.certificate||null)),null);
});
test('both table capacities and all four roots agree with the independent normal engine at depths 0..3',()=>{for(const r of I.roots())for(const maxTableEntries of [500000,1000000])for(const depth of [0,1,2,3])for(const target of [0,1]){const x=P.prove(r.state,target,{maxDepth:depth,maxNodes:1000000,wallMs:30000,maxTableEntries});assert.equal(x.status,normal(r.state,target,depth)?'PROVED':'UNKNOWN');if(x.certificate)V.verify(x.certificate);}});
test('009 cumulative schedule reaches later horizons only within the total budget and never turns refutation into another winner',()=>{
 const b=C.E.initialState(),x=Schedule.prove(b,0,{maxNodes:7,wallMs:10000});assert.equal(x.visits,7);assert.equal(x.winner,null);assert.equal(x.certificate,null);
 const terminal={...b,winner:0,reason:'relay-limit'},y=Schedule.prove(terminal,0,{maxNodes:1000,wallMs:10000});assert.equal(y.winner,null);assert.equal(y.certificate,null);assert.ok(y.attempts.every(a=>a.status==='UNKNOWN'));
 const stopped=P.prove(b,0,{maxDepth:4,maxTableEntries:1,maxNodes:1000});assert.equal(stopped.status,'TABLE_BUDGET');assert.equal(stopped.winner,null);
});
test('eight partial jobs retain all three known parents and 22 responses; finished bytes reuse no searches, interrupted or tampered records reject',()=>{
 const input=I.prepare(),out=fs.mkdtempSync(path.join(os.tmpdir(),'deepen009-')),m={digest:'development-only',whole:I.whole(),parents:I.parents(),allReplies:I.allReplies(),roots:I.roots(),pinnedReplies:[],inputs:{oldGames:input.oldGames,verifiedStates:input.verifiedStates},contract:{maxDepth:78,parentMaxDepth:79,wholeMaxDepth:80,maxNodes:1,wallMs:1000}};
 try{for(let i=0;i<4;i++)for(const target of [0,1]){assert.equal(S.job(out,i,target,m).status,'NODE_BUDGET');assert.equal(S.job(out,i,target,m).newSearches,0);}const s=S.aggregate(out,m);assert.equal(s.proofJobs,8);assert.equal(s.primaryBefore17.status,'UNKNOWN');assert.equal(s.primaryBefore17.coveredBranches,3);assert.equal(s.parents.reduce((n,p)=>n+p.replies.length,0),22);assert.equal(s.initial.status,'UNKNOWN');
 const file=path.join(out,'proof-0-0.json.gz'),row=S4.read(file),bytes=fs.readFileSync(file);row.inputArchiveSha256='bad';assert.throws(()=>S.audit(row,0,0,m));row.inputArchiveSha256=I.SHA;row.checksum='bad';assert.throws(()=>S.audit(row,0,0,m));fs.unlinkSync(file);assert.throws(()=>S.job(out,0,0,m),/HOLD/);fs.writeFileSync(file,bytes);
 const bad=structuredClone(I.knownParents()[0].certificate);bad.nodes[bad.root].children[0].move={type:'illegal'};assert.throws(()=>V.verify(bad));
 }finally{fs.rmSync(out,{recursive:true,force:true});}
});
