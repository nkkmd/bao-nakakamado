"use strict";
// MIT. Restore a pinned Actions artifact; never prints a token, key or row payload.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),cp=require('node:child_process');
const A=require('./formal-collection.cjs');
function checkReceipt(receipt,run,artifact){
 assert.equal(receipt.repository,'nkkmd/bao-nakakamado');assert.ok(Number.isSafeInteger(receipt.runId)&&receipt.runId>0);
 assert.ok(Number.isSafeInteger(receipt.attempt)&&receipt.attempt>0);assert.ok(/^[a-f0-9]{40}$/.test(receipt.headSha));
 assert.ok(Number.isSafeInteger(receipt.artifactId)&&receipt.artifactId>0);assert.ok(/^formal-(dev-)?(shard-[0-9]+|plan)$/.test(receipt.name));
 assert.ok(/^sha256:[a-f0-9]{64}$/.test(receipt.digest));assert.equal(run.id,receipt.runId);assert.equal(run.run_attempt,receipt.attempt);
 assert.equal(run.head_sha,receipt.headSha);assert.equal(run.repository.full_name,receipt.repository);assert.equal(artifact.id,receipt.artifactId);
 assert.equal(artifact.name,receipt.name);assert.equal(artifact.digest,receipt.digest);assert.equal(artifact.expired,false);
 assert.equal(artifact.workflow_run.id,receipt.runId);assert.equal(artifact.workflow_run.head_sha,receipt.headSha);
 return receipt;
}
function inspectShard(directory,plan,registry,key,receipt){
 A.validatePlan(plan,registry);const m=A.read(path.join(directory,'manifest.json')),c=plan.config,shard=m.binding.shard;
 assert.equal(receipt.name,(A.isFormal(c)?'formal-shard-':'formal-dev-shard-')+shard);
 assert.deepEqual(m.binding,{schema:1,planDigest:plan.digest,sourceDigest:A.hash(plan.sources),registryDigest:registry.digest,shard,shards:c.shards});
 assert.deepEqual(m.origin,{repository:receipt.repository,runId:receipt.runId,attempt:receipt.attempt,headSha:receipt.headSha});
 const indexes=plan.rows.map((_,i)=>i).filter(i=>i%c.shards===shard);assert.deepEqual(m.indexes,indexes);
 assert.equal(new Set(m.completed).size,m.completed.length);assert.ok(m.completed.every(i=>indexes.includes(i)));
 const present=[];for(const name of fs.readdirSync(directory)){
  if(name==='manifest.json')continue;if(name==='restore-receipt.json'){const previous=A.read(path.join(directory,name));assert.equal(previous.repository,'nkkmd/bao-nakakamado');assert.ok(/^sha256:[a-f0-9]{64}$/.test(previous.digest));continue;}const match=/^request-([0-9]+)\.sealed\.json$/.exec(name);assert.ok(match,'Unexpected checkpoint file');
  const index=Number(match[1]);assert.ok(indexes.includes(index));
  const measurement=A.decrypt(A.read(path.join(directory,name)),key,A.measurementBinding(plan,index));A.checkMeasurement(measurement,plan.rows[index],c);present.push(index);
 }
 assert.ok(m.completed.every(i=>present.includes(i)),'Missing manifest checkpoint');return {shard,restored:present.length};
}
function restoreArchive(bytes,receipt,output,plan,registry,key){
 assert.equal('sha256:'+A.shaBytes(bytes),receipt.digest,'Artifact ZIP digest');assert.ok(!fs.existsSync(output),'Restore destination exists');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'bao-artifact-')),archive=path.join(temp,'artifact.zip'),stage=path.join(temp,'shard');
 try{fs.writeFileSync(archive,bytes,{mode:0o600});const proc=cp.spawnSync('python3',[path.join(__dirname,'safe-artifact-unzip.py'),archive,stage],{encoding:'utf8'});
  assert.equal(proc.status,0,'Unsafe artifact ZIP');const result=inspectShard(stage,plan,registry,key,receipt);
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.cpSync(stage,output,{recursive:true,errorOnExist:true,force:false});A.atomic(path.join(output,'restore-receipt.json'),receipt);
  return {...result,runId:receipt.runId,attempt:receipt.attempt,artifactId:receipt.artifactId,digest:receipt.digest};
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
async function downloadPinned(receipt,{fetchImpl=fetch,token=process.env.GITHUB_TOKEN}={}){
 assert.equal(receipt.repository,'nkkmd/bao-nakakamado');assert.ok(Number.isSafeInteger(receipt.runId)&&receipt.runId>0&&Number.isSafeInteger(receipt.artifactId)&&receipt.artifactId>0);
 const api='https://api.github.com/repos/'+receipt.repository,headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
 if(token)headers.Authorization='Bearer '+token;
 const json=async url=>{const r=await fetchImpl(url,{headers,signal:AbortSignal.timeout(25000)});assert.equal(r.status,200,'Actions metadata request failed');return r.json();};
 const [run,artifact]=await Promise.all([json(api+'/actions/runs/'+receipt.runId+'/attempts/'+receipt.attempt),json(api+'/actions/artifacts/'+receipt.artifactId)]);checkReceipt(receipt,run,artifact);
 const redirect=await fetchImpl(api+'/actions/artifacts/'+receipt.artifactId+'/zip',{headers,redirect:'manual',signal:AbortSignal.timeout(25000)});assert.equal(redirect.status,302,'Artifact redirect');
 const location=new URL(redirect.headers.get('location'));assert.equal(location.protocol,'https:');
 const response=await fetchImpl(location.toString(),{redirect:'error',signal:AbortSignal.timeout(25000)});assert.equal(response.status,200,'Artifact download failed');
 const bytes=Buffer.from(await response.arrayBuffer());assert.ok(bytes.length<=128*1024*1024);assert.equal('sha256:'+A.shaBytes(bytes),receipt.digest);
 return bytes;
}
if(require.main===module){(async()=>{try{const [receiptFile,output]=process.argv.slice(2),receipt=A.read(receiptFile),key=fs.readFileSync(process.env.BAO_COLLECTION_KEY_FILE||'');
 const registry=require('./formal-development-exclusions.json'),plan=A.loadPlan(process.env.BAO_COLLECTION_PLAN_FILE,key,registry);
 const bytes=await downloadPinned(receipt);console.log(JSON.stringify(restoreArchive(bytes,receipt,output,plan,registry,key)));
 }catch{console.error('Pinned artifact restore failed; no payload logged');process.exitCode=1;}})();}
module.exports={checkReceipt,inspectShard,restoreArchive,downloadPinned};
