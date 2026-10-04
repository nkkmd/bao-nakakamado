"use strict";
// MIT. Manual formal collection only. All stdout is payload-free metadata.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const A=require('./formal-collection.cjs'),R=require('./formal-registry.cjs'),AR=require('./formal-artifact.cjs');
function selectedConfig(version=process.env.BAO_COLLECTION_VERSION||'v1'){assert.ok(['v1','v2'].includes(version),'Unregistered collection version');return version==='v2'?A.formalV2:A.formal;}
function receiptsCheck(receipts){assert.ok(Array.isArray(receipts));const seen=new Set();for(const r of receipts){
 const match=/^formal-shard-([0-9]+)$/.exec(r.name);assert.ok(match);const shard=Number(match[1]);assert.ok(shard>=0&&shard<A.formal.shards&&!seen.has(shard));seen.add(shard);
 assert.equal(r.repository,'nkkmd/bao-nakakamado');assert.ok(Number.isSafeInteger(r.runId)&&r.runId>0&&Number.isSafeInteger(r.attempt)&&r.attempt>0&&Number.isSafeInteger(r.artifactId)&&r.artifactId>0);
 assert.ok(/^[a-f0-9]{40}$/.test(r.headSha)&&/^sha256:[a-f0-9]{64}$/.test(r.digest));}return receipts;}
async function main(){const [command,root,arg]=process.argv.slice(2);
 if(command==='key'){const encoded=process.env.BAO_COLLECTION_KEY_BASE64||'';assert.ok(/^[A-Za-z0-9+/]+={0,2}$/.test(encoded));
  const key=Buffer.from(encoded,'base64');assert.equal(key.length,32);assert.equal(key.toString('base64'),encoded);assert.ok(!key.every(n=>n===key[0]),'Public test keys cannot seal formal data');
  fs.writeFileSync(process.env.BAO_COLLECTION_KEY_FILE,key,{mode:0o600,flag:'wx'});console.log(JSON.stringify({keyLoaded:true}));return;}
 const config=selectedConfig(),registry=R.validateRegistry(require('./formal-development-exclusions.json')),key=fs.readFileSync(process.env.BAO_COLLECTION_KEY_FILE||'');
 if(command==='prepare'){receiptsCheck(JSON.parse(process.env.BAO_RESUME_RECEIPTS||'[]'));assert.equal(R.makeRegistry().digest,registry.digest);
  const plan=A.prepare(registry,config),preflight=A.candidateGates(plan);A.atomic(path.join(root,'candidate-preflight.json'),preflight);
  if(preflight.status==='HOLD-BEFORE-TEACHER'){console.log(JSON.stringify(preflight));process.exitCode=2;return;}A.savePlan(path.join(root,'plan.sealed.json'),plan,key);
  A.atomic(path.join(root,'plan-summary.json'),{configId:plan.config.id,planDigest:plan.digest,registryDigest:registry.digest,sourceDigest:A.hash(plan.sources),requests:plan.rows.length});
  console.log(JSON.stringify({prepared:true,requests:plan.rows.length,planDigest:plan.digest}));return;}
 const plan=A.loadPlan(process.env.BAO_COLLECTION_PLAN_FILE,key,registry);
 assert.equal(plan.config.id,config.id,'Requested collection version differs from frozen plan');
 if(command==='restore'){const shard=Number(arg),receipt=receiptsCheck(JSON.parse(process.env.BAO_RESUME_RECEIPTS||'[]')).find(r=>r.name==='formal-shard-'+shard);
  if(!receipt){console.log(JSON.stringify({shard,restoreRequested:false}));return;}
  const bytes=await AR.downloadPinned(receipt);console.log(JSON.stringify(AR.restoreArchive(bytes,receipt,path.join(root,'shard-'+shard),plan,registry,key)));}
 else if(command==='shard')console.log(JSON.stringify(A.runShard(root,plan,registry,key,Number(arg))));
 else if(command==='aggregate'){const summary=A.aggregate(root,plan,registry,key,arg);console.log(JSON.stringify(summary));if(summary.status==='HOLD')process.exitCode=2;}
 else throw Error('Command');
}
if(require.main===module)main().catch(()=>{console.error('Formal workflow operation failed; no payload logged');process.exitCode=1;});
module.exports={receiptsCheck,selectedConfig};
