'use strict';
// MIT. Read-only verification of exploratory bytes; no prover invocation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('../v010-balance/core.cjs'),V=require('../v010-balance/diagnostics/proof.cjs'),S4=require('../v010-branch/study.cjs');
function verify(){let count=0,certificates=0;for(const name of ['calibration','pilot']){const index=JSON.parse(fs.readFileSync(path.join(C.root,'doc/v010-pn007',name+'.json')));assert.equal(index.formalJobs,0);assert.equal(index.newGames,0);for(const [file,sha] of Object.entries(index.sources))assert.equal(C.hash(fs.readFileSync(path.join(C.root,file))),sha);
 for(const row of index.rows){const file=path.join(C.root,'doc/v010-pn007',row.file);assert.equal(C.hash(fs.readFileSync(file)),row.sha256);const record=S4.read(file),r=record.result;assert.equal(r.status,row.status);assert.equal(r.winner,row.winner);assert.equal(r.visits,row.visits);if(r.certificate){V.verify(r.certificate);assert.deepEqual(r.certificate.start,record.state);assert.equal(r.certificate.target,r.winner);assert.equal(r.certificate.target,record.expectedWinner??record.target);certificates++;}else assert.equal(r.winner,null);count++;}}
 return {status:'VERIFIED-PILOT-BYTES',files:count,certificates,newSearches:0};}
if(require.main===module)console.log(JSON.stringify(verify()));module.exports={verify};
