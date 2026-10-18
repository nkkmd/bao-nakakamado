'use strict';
// MIT. Seal only after completed operational pilot and independent verification.
const fs=require('node:fs'),assert=require('node:assert/strict'),T=require('./study.cjs'),{C}=require('../v010-followup/core.cjs');
require('node:child_process').execFileSync(process.execPath,['tools/v010-balance018/pilot.cjs','verify','doc/v010-balance018/pilot'],{stdio:'pipe'});
const folder='doc/v010-balance018/pilot/',p=JSON.parse(fs.readFileSync(folder+'pilot.json'));
assert.equal(p.gamesVerified,48);assert.equal(p.newGames,0);assert.equal(p.rows.length,24);
assert.ok(p.projectedShardMs<=.7*90*60000,'HOLD shard budget');assert.ok(p.projectedRunnerMs<=.7*96*3600000,'HOLD total budget');
const pilot={sourceCommit:p.sourceCommit,runId:p.runId,files:Object.fromEntries(fs.readdirSync(folder).filter(f=>fs.statSync(folder+f).isFile()).map(f=>[f,C.hash(fs.readFileSync(folder+f))])),projectedRunnerMs:p.projectedRunnerMs,projectedShardMs:p.projectedShardMs};
const body={contract:T.contract,cells:T.cells(),sources:T.fingerprint(),pilot},m={...body,digest:C.hash(body)},f='tools/v010-balance018/manifest.json';if(fs.existsSync(f))assert.deepEqual(JSON.parse(fs.readFileSync(f)),m);else fs.writeFileSync(f,JSON.stringify(m,null,2)+'\n');console.log(JSON.stringify({digest:m.digest,pairs:T.tasks(m).length,projectedRunnerHours:p.projectedRunnerMs/3600000}));
