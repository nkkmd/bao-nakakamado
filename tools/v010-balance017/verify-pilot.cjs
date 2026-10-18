'use strict';
// MIT. Independent replay of already measured pilot bytes, no search invocation.
const fs=require('node:fs'),z=require('node:zlib'),assert=require('node:assert/strict');
const T=require('./study.cjs'),K=require('../v010-followup/core.cjs'),R=require('../v010-followup/registry.cjs'),{C}=K;
const folder='doc/v010-balance017/pilot/',receipt=JSON.parse(fs.readFileSync(folder+'pilot.json'));
assert.deepEqual(receipt.rows.map(r=>r.profile),T.profiles.map(p=>p.id));let games=0;
receipt.rows.forEach((r,i)=>{const bytes=fs.readFileSync(folder+r.file);assert.equal(C.hash(bytes),r.sha256);const row=JSON.parse(z.gunzipSync(bytes)),p=T.profiles[i];assert.deepEqual(row.profile,p);assert.equal(row.seed,parseInt(C.hash(['BALANCE017-OPERATIONAL-PILOT',p.id]).slice(0,8),16));assert.equal(row.games.length,2);row.games.forEach((g,side)=>{assert.equal(g.seed,row.seed);assert.equal(g.firstPlayer,side);K.audit(g,R.openings()[0],[p,p]);games++;});assert.deepEqual(row.games[1].final,C.mirror(row.games[0].final));assert.equal(row.games[0].trajectory,row.games[1].trajectory);assert.deepEqual(r.operations,C.operations(row.games));});
const out={status:'PILOT-12-NORMAL-REPLAYS-VERIFIED',gamesVerified:games,pilotReceiptSha256:C.hash(fs.readFileSync(folder+'pilot.json')),newGames:0,newProofSearches:0};fs.writeFileSync('doc/v010-balance017/pilot-reaudit.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));
