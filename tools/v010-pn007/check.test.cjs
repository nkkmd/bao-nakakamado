'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const C=require('../v010-balance/core.cjs'),I=require('./inputs.cjs'),S=require('./study.cjs'),S4=require('../v010-branch/study.cjs'),A=require('../v010-branch/compose.cjs'),V=require('../v010-balance/diagnostics/proof.cjs'),P=require('./prover.cjs');
test('34 jobs preserve all 19 responses and both known immediate wins; interrupted and modified records are rejected',()=>{
 const input=I.prepare(),out=fs.mkdtempSync(path.join(os.tmpdir(),'pn-007-')),m={digest:'development-only',parents:I.parents(),roots:I.roots(),inputs:{oldGames:input.oldGames,verifiedStates:input.verifiedStates},contract:{maxDepth:78,maxNodes:1,wallMs:1000,parentMaxDepth:79,wholeMaxDepth:80}};
 try{for(let i=0;i<m.roots.length;i++)for(const t of [0,1]){assert.equal(S.job(out,i,t,m).status,'NODE_BUDGET');assert.equal(S.job(out,i,t,m).newSearches,0);}const s=S.aggregate(out,m);assert.equal(s.proofJobs,34);assert.equal(s.primaryBefore19.status,'UNKNOWN');assert.equal(s.primaryBefore19.coveredBranches,7);assert.equal(s.preservedImmediateWins.length,2);assert.deepEqual(s.parents.map(p=>p.replies.length),[10,9]);assert.ok(s.parents.every(p=>p.winner===null));assert.equal(s.initial.status,'UNKNOWN');
 const file=path.join(out,'proof-0-0.json.gz'),bytes=fs.readFileSync(file),r=S4.read(file);r.inputArchiveSha256='0'.repeat(64);assert.throws(()=>S.audit(r,0,0,m));r.inputArchiveSha256=I.SHA;r.pinnedInput.verifiedStates++;assert.throws(()=>S.audit(r,0,0,m));fs.unlinkSync(file);assert.throws(()=>S.job(out,0,0,m),/HOLD/);fs.writeFileSync(file,bytes);r.pinnedInput.verifiedStates--;r.result.status='PROVED';r.checksum=C.hash(r.result);assert.throws(()=>S.audit(r,0,0,m));
 }finally{fs.rmSync(out,{recursive:true,force:true});}
});
test('quantified synthesis of PN children retains every defender response and verifies with normal engine',()=>{
 const c=require('../v010-branch/inputs.cjs').load().find(r=>r.index===14&&r.target===1).result.certificate,input=I.prepare(),children=C.Q.moveVariants(c.start).map(m=>P.prove(C.Q.applyMove(c.start,m).state,1,{...input,maxDepth:78,maxNodes:1}).certificate);assert.ok(children.every(Boolean));const out=A.compose(c.start,children);V.verify(out);assert.equal(out.target,1);assert.equal(out.depth,18);children[0]=null;assert.equal(A.compose(c.start,children),null);
});

test("exploratory calibration and pilot records verify without new searches",()=>{const r=require("./verify-pilot.cjs").verify();assert.equal(r.newSearches,0);assert.ok(r.certificates>=6);});
