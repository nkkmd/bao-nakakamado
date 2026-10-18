'use strict';
// MIT. Run once after pilot and prior 14 audits; existing seal must match exactly.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const T=require('./study.cjs'),C=require('../v010-balance/core.cjs'),R=require('../v010-followup/registry.cjs');
const pilot=JSON.parse(fs.readFileSync('doc/v010-balance017/pilot/pilot.json'));
const checked=JSON.parse(fs.readFileSync('doc/v010-balance017/pilot-reaudit.json'));assert.equal(checked.pilotReceiptSha256,C.hash(fs.readFileSync('doc/v010-balance017/pilot/pilot.json')));assert.equal(checked.gamesVerified,12);assert.equal(checked.newGames,0);assert.equal(pilot.rows.length,6);assert.equal(pilot.newGames,12);
for(const r of pilot.rows){assert.equal(C.hash(fs.readFileSync('doc/v010-balance017/pilot/'+r.file)),r.sha256);assert.equal(r.operations.depthZero,0);assert.equal(r.operations.games,2);}
const prior=JSON.parse(fs.readFileSync('doc/v010-balance017/prior-14-reaudit.json'));assert.equal(prior.results.length,14);assert.equal(prior.newGames,0);assert.equal(prior.newProofSearches,0);
const perPair=pilot.rows.reduce((s,r)=>s+r.pairElapsedMs,0),estimate=perPair*(T.contract.naturalPairs+14*T.contract.forcedPairs),shardEstimate=perPair*5;
assert.ok(shardEstimate<.8*T.contract.shardTimeoutMinutes*60000,'HOLD pilot projects shard too close to wall limit');
const sealedPilot={receiptSha256:C.hash(fs.readFileSync('doc/v010-balance017/pilot/pilot.json')),recordHashes:Object.fromEntries(pilot.rows.map(r=>[r.file,r.sha256])),priorAuditSha256:C.hash(fs.readFileSync('doc/v010-balance017/prior-14-reaudit.json')),projectedRunnerMs:estimate,projectedShardMs:shardEstimate,projectionScope:'natural pilot only; forced openings and Actions host differ; hard job limit remains 90 minutes'};
const sources={...T.fingerprint(),'tools/v010-balance017/freeze.cjs':C.hash(fs.readFileSync(__filename))};
// freeze.cjs itself is included through fingerprint so the seal can be reproduced.
assert.deepEqual(sources,T.fingerprint());
const body={contract:T.contract,openings:R.openings(),sources,pilot:sealedPilot},m={...body,digest:C.hash(body)},file=path.join(__dirname,'manifest.json');
if(fs.existsSync(file))assert.deepEqual(JSON.parse(fs.readFileSync(file)),m);else fs.writeFileSync(file,JSON.stringify(m,null,2)+'\n');
console.log(JSON.stringify({digest:m.digest,pairs:T.tasks(m).length,projectedRunnerHours:estimate/3600000,projectedShardMinutes:shardEstimate/60000}));
