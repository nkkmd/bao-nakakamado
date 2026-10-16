'use strict';
// MIT. New ID and immutable source / budget contract. Old manifests are unchanged.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('../v010-balance/core.cjs'),I=require('./inputs.cjs'),S=require('./study.cjs'),Schedule=require('./schedule.cjs');
assert.equal(I.roots().length,8);assert.equal(I.heldRoots().length,18);const input=I.prepare();
async function main(){
 const receipt=path.join(C.root,'doc/v010-split013/preflight-reaudit.json'),began=Date.now();
 while(!fs.existsSync(receipt)){assert.ok(Date.now()-began<1200000,'HOLD waiting for completed preflight audits');await new Promise(r=>setTimeout(r,1000));}
 assert.equal(JSON.parse(fs.readFileSync(receipt)).status,'ALL-10-AUDITS-PASSED');
 const body={contract:{id:'NAKAKAMADO-V010-SPLIT-STUDY-013',baseline:'f605c5f2871641235eff1b9754617e4fd7e254fd',mainAtStart:'f605c5f2871641235eff1b9754617e4fd7e254fd',rulesVersion:'0.10.0',method:'complete-one-ply-legal-partition-of-three-response-roots',horizons:Schedule.SCHEDULE,maxDepth:77,rootMaxDepth:78,parentMaxDepth:79,wholeMaxDepth:80,maxNodes:10000000,wallMs:300000,phaseWallMs:50000,maxTableEntries:1000000,maxStoredNodes:500000,maxHeapBytes:1610612736,newGames:0,normalWinsOnly:true,unknownIsNotDraw:true},inputs:{oldGames:input.oldGames,verifiedStates:input.verifiedStates},sources:S.fingerprint(),whole:I.whole(),parents:I.parents(),allReplies:I.allReplies(),pinnedReplies:I.pinnedReplies(),knownParents:S.knownRows(),splitParents:I.splitParents(),roots:I.roots(),heldRoots:I.heldRoots(),totals:{jobs:16,allResponses:33,knownParentResponses:11,knownParentUnsearchedResponses:9,deferredUnresolvedRoots:18,maxVisits:160000000,searchWallMinutes:80,maxParallel:4,runnerJobTimeoutMinutes:30,allJobTimeoutMinutes:830}};
const m={...body,digest:C.hash(body)},file=path.join(__dirname,'manifest.json');if(fs.existsSync(file))assert.deepEqual(JSON.parse(fs.readFileSync(file)),m);else fs.writeFileSync(file,JSON.stringify(m,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({digest:m.digest,jobs:m.totals.jobs}));

}
main().catch(error=>{console.error(error);process.exitCode=1;});
