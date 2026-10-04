"use strict";
// MIT. Every partition is development-only and may be read in this correctness pilot.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const A=require('./formal-collection.cjs'),R=require('./formal-registry.cjs'),F=require('../../prototype/search-ai.js');
const Q=require('../../prototype/search-transition.js').createForEngine(require('../../prototype/next-turn-engine.js'));
const DEVELOPMENT_KEY=Buffer.alloc(32,37); // Public test key. Never used for formal data.
function verify(directory){
 assert.ok(!fs.existsSync(directory),'Use a fresh verification directory');fs.mkdirSync(directory,{recursive:true});
 const registry=R.validateRegistry(require('./formal-development-exclusions.json')),recreated=R.makeRegistry();assert.equal(recreated.digest,registry.digest);
 const plan=A.prepare(registry,A.development),again=A.prepare(registry,A.development);assert.equal(plan.digest,again.digest);
 A.savePlan(path.join(directory,'plan.sealed.json'),plan,DEVELOPMENT_KEY);A.loadPlan(path.join(directory,'plan.sealed.json'),DEVELOPMENT_KEY,registry);
 const analyze=F.createAI(Q,{now:()=>0}).analyzeMove,origin=A.runOrigin(),partial=A.runShard(directory,plan,registry,DEVELOPMENT_KEY,0,{analyze,origin,maximumNew:2});
 const resume=[];for(let shard=0;shard<plan.config.shards;shard++)resume.push(A.runShard(directory,plan,registry,DEVELOPMENT_KEY,shard,{analyze,origin}));
 const complete=[];for(let shard=0;shard<plan.config.shards;shard++)complete.push(A.runShard(directory,plan,registry,DEVELOPMENT_KEY,shard,{analyze:()=>{throw Error('Completed teacher was rerun');},origin}));
 const summary=A.aggregate(directory,plan,registry,DEVELOPMENT_KEY,path.join(directory,'dataset'));
 assert.equal(summary.status,'READY-FOR-TRAINING-DESIGN');assert.equal(summary.postAuditLeaks,0);
 const seal=fs.readFileSync(path.join(directory,'dataset','final.sealed.json'));assert.deepEqual(A.aggregate(directory,plan,registry,DEVELOPMENT_KEY,path.join(directory,'dataset')),summary);
 assert.deepEqual(fs.readFileSync(path.join(directory,'dataset','final.sealed.json')),seal);
 const privateAudit=A.decrypt(A.read(path.join(directory,'dataset','audit.sealed.json')),DEVELOPMENT_KEY,{purpose:'private-audit',planDigest:plan.digest,auditDigest:summary.auditDigest});
 const result={status:'PASS',scope:A.development.scope,encodingId:'NAKAKAMADO-BINARY-v1',registryDigest:registry.digest,
  registryPositions:registry.positionHashes.length,registryInputs:registry.inputHashes.length,registryOpeningGroups:registry.openingGroups.length,
  configId:plan.config.id,planDigest:plan.digest,sourceDigest:A.hash(plan.sources),sourceHashes:plan.sources,selection:plan.selection,
  teacherRequests:plan.rows.length,accepted:summary.accepted,splitCounts:Object.fromEntries(Object.entries(privateAudit).map(([k,v])=>[k,v.rows])),
  groups:Object.fromEntries(Object.entries(privateAudit).map(([k,v])=>[k,v.groups])),capRemoved:Object.fromEntries(Object.entries(privateAudit).map(([k,v])=>[k,v.capRemoved])),
  postAuditLeaks:summary.postAuditLeaks,partial,partialResume:resume[0],completedResume:complete,
  sealedFinalDigest:summary.final.digest,allPartitionsDevelopmentAndReadable:true,formalDataGenerated:false,trainingStarted:false};
 A.atomic(path.join(directory,'formal-infrastructure-verification.json'),result);return result;
}
function verifyRestored(directory){
 const registry=require('./formal-development-exclusions.json'),plan=A.loadPlan(path.join(directory,'plan.sealed.json'),DEVELOPMENT_KEY,registry),resume=[];
 for(let shard=0;shard<plan.config.shards;shard++)resume.push(A.runShard(directory,plan,registry,DEVELOPMENT_KEY,shard,{analyze:()=>{throw Error('Restored completed teacher reran');}}));
 const summary=A.aggregate(directory,plan,registry,DEVELOPMENT_KEY,path.join(directory,'restored-dataset'));
 return {status:'PASS',scope:A.development.scope,restoredRequests:resume.reduce((n,r)=>n+r.reused,0),newTeacherRequests:resume.reduce((n,r)=>n+r.generated,0),planDigest:plan.digest,finalDigest:summary.final.digest};
}
if(require.main===module){try{const [directory,command]=process.argv.slice(2);console.log(JSON.stringify(command==='restored'?verifyRestored(directory):verify(directory),null,2));}
 catch{console.error('Development infrastructure verification failed; no payload logged');process.exitCode=1;}}
module.exports={verify,verifyRestored,DEVELOPMENT_KEY};
