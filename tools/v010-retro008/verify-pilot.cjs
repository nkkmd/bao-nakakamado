'use strict';
// MIT. Read-only verification of six exploratory records and the retained parent.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('../v010-balance/core.cjs'),V=require('../v010-balance/diagnostics/proof.cjs'),I=require('./inputs.cjs'),S4=require('../v010-branch/study.cjs');
function verify(){const p=JSON.parse(fs.readFileSync(path.join(C.root,'doc/v010-retro008/pilot.json')));assert.equal(p.formalJobs,0);assert.equal(p.newGames,0);assert.equal(p.rows.length,6);assert.equal(p.inputArchiveSha256,I.SHA);for(const [file,sha]of Object.entries(p.sources))assert.equal(C.hash(fs.readFileSync(path.join(C.root,file))),sha);
 for(const row of p.rows){const file=path.join(C.root,'doc/v010-retro008',row.file);assert.equal(C.hash(fs.readFileSync(file)),row.sha256);const data=S4.read(file),r=data.result;assert.deepEqual(data.state,I.roots().find(x=>x.id===row.rootId).state);assert.equal(r.status,row.status);assert.equal(r.winner,row.winner);assert.equal(r.visits,row.visits);if(r.certificate){V.verify(r.certificate);assert.deepEqual(r.certificate.start,data.state);}else assert.equal(r.winner,null);}
 assert.deepEqual(p.known,I.knownParents().map(k=>({id:k.id,target:k.certificate.target,depth:k.certificate.depth,certificateSha256:C.hash(k.certificate),newSearches:0})));return {status:'VERIFIED-PILOT-BYTES',files:p.rows.length,knownParents:p.known.length,newSearches:0};}
if(require.main===module)console.log(JSON.stringify(verify()));module.exports={verify};
