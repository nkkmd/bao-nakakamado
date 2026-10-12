'use strict';
// MIT. Re-audit existing records only; never call a game or proof search entry point.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const [source,out,expected]=process.argv.slice(2);
assert.ok(['tools/v010-balance/formal.cjs','tools/v010-followup/study.cjs',
 'tools/v010-certainty/study.cjs','tools/v010-gc/study.cjs'].includes(source));
const original=fs.readFileSync(expected);
const result=require(path.join(root,source)).aggregate(out);
assert.deepEqual(fs.readFileSync(path.join(out,'summary.json')),original);
console.log(JSON.stringify({source,summaryBytesMatch:true,status:result.status,
 games:result.games??result.profiles.reduce((n,p)=>n+p.operations.games,0),
 proofJobs:result.proofJobs??result.proofs?.length??0}));
