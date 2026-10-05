"use strict";
// MIT. Pinned formal dataset download, no key and no unsealed final extraction.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),os=require('node:os');
const A=require('./formal-collection.cjs'),D=require('./formal-learning-data.cjs'),receipt=D.spec.collection;
function checkMetadata(run,artifact){
 assert.equal(run.repository.full_name,receipt.repository);assert.equal(run.id,receipt.runId);assert.equal(run.run_attempt,receipt.attempt);
 assert.equal(run.head_sha,receipt.headSha);assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');
 for(const [k,v] of Object.entries({id:receipt.artifactId,name:receipt.name,digest:receipt.digest,expired:false}))assert.equal(artifact[k],v);
 assert.equal(artifact.workflow_run.id,receipt.runId);assert.equal(artifact.workflow_run.head_sha,receipt.headSha);
 assert.ok(artifact.size_in_bytes>0&&artifact.size_in_bytes<=128*1024*1024);return true;
}
async function restore(root,{fetchImpl=fetch,token=process.env.GITHUB_TOKEN}={}){
 assert.ok(!fs.existsSync(root),'Download destination exists');const api='https://api.github.com/repos/'+receipt.repository;
 const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};if(token)headers.Authorization='Bearer '+token;
 const json=async url=>{const r=await fetchImpl(url,{headers,signal:AbortSignal.timeout(25000)});assert.equal(r.status,200,'Actions metadata');return r.json();};
 const [run,artifact]=await Promise.all([json(api+'/actions/runs/'+receipt.runId+'/attempts/'+receipt.attempt),json(api+'/actions/artifacts/'+receipt.artifactId)]);
 checkMetadata(run,artifact);
 const redirect=await fetchImpl(api+'/actions/artifacts/'+receipt.artifactId+'/zip',{headers,redirect:'manual',signal:AbortSignal.timeout(25000)});
 assert.equal(redirect.status,302);const location=new URL(redirect.headers.get('location'));assert.equal(location.protocol,'https:');
 const response=await fetchImpl(location.toString(),{redirect:'error',signal:AbortSignal.timeout(25000)});assert.equal(response.status,200);
 const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,artifact.size_in_bytes);assert.equal('sha256:'+A.shaBytes(bytes),receipt.digest);
 fs.mkdirSync(root,{recursive:true,mode:0o700});const archive=path.join(root,'dataset.zip');fs.writeFileSync(archive,bytes,{mode:0o600});
 const destination=path.join(root,'visible'),proc=cp.spawnSync('python3',[path.join(__dirname,'formal-learning-unzip.py'),archive,destination],{encoding:'utf8'});
 assert.equal(proc.status,0,'Dataset ZIP contract');D.prepare(destination,path.join(root,'prepared'));
 A.atomic(path.join(root,'receipt.json'),{...receipt,restored:true,finalExtracted:false,finalOpened:false});
 return {restored:true,artifactId:receipt.artifactId,train:receipt.train.rows,validation:receipt.validation.rows,finalOpened:false};
}
function parseResume(text=process.env.BAO_LEARNING_RESUME_RECEIPTS||'[]'){
 assert.ok(text.length<=16384);const records=JSON.parse(text);assert.ok(Array.isArray(records)&&records.length<=6);const names=new Set();
 for(const r of records){assert.equal(r.repository,receipt.repository);assert.ok(/^learning-(mlp|logic)-202610040[123]$/.test(r.name));
  assert.ok(Number.isSafeInteger(r.runId)&&r.runId>0&&Number.isSafeInteger(r.attempt)&&r.attempt>0&&Number.isSafeInteger(r.artifactId)&&r.artifactId>0);
  assert.ok(/^[a-f0-9]{40}$/.test(r.headSha)&&/^sha256:[a-f0-9]{64}$/.test(r.digest));assert.ok(!names.has(r.name));names.add(r.name);}
 return records;
}
async function resumeModel(output,kind,seed,{fetchImpl=fetch,token=process.env.GITHUB_TOKEN,records=parseResume()}={}){
 assert.ok(D.spec.models.includes(kind)&&D.spec.training.seeds.includes(Number(seed)));
 const pinned=records.find(r=>r.name==='learning-'+kind+'-'+seed);if(!pinned)return {restored:false,kind,seed:Number(seed)};
 assert.ok(!fs.existsSync(output));const api='https://api.github.com/repos/'+pinned.repository,headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
 if(token)headers.Authorization='Bearer '+token;
 const json=async url=>{const r=await fetchImpl(url,{headers,signal:AbortSignal.timeout(25000)});assert.equal(r.status,200);return r.json();};
 const [run,artifact]=await Promise.all([json(api+'/actions/runs/'+pinned.runId+'/attempts/'+pinned.attempt),json(api+'/actions/artifacts/'+pinned.artifactId)]);
 assert.equal(run.repository.full_name,pinned.repository);assert.equal(run.id,pinned.runId);assert.equal(run.run_attempt,pinned.attempt);assert.equal(run.head_sha,pinned.headSha);
 assert.equal(run.status,'completed');assert.ok(['success','failure','cancelled','timed_out'].includes(run.conclusion));
 for(const [k,v] of Object.entries({id:pinned.artifactId,name:pinned.name,digest:pinned.digest,expired:false}))assert.equal(artifact[k],v);
 assert.equal(artifact.workflow_run.id,pinned.runId);assert.equal(artifact.workflow_run.head_sha,pinned.headSha);assert.ok(artifact.size_in_bytes<=128*1024*1024);
 const redirect=await fetchImpl(api+'/actions/artifacts/'+pinned.artifactId+'/zip',{headers,redirect:'manual',signal:AbortSignal.timeout(25000)});assert.equal(redirect.status,302);
 const location=new URL(redirect.headers.get('location'));assert.equal(location.protocol,'https:');
 const response=await fetchImpl(location.toString(),{redirect:'error',signal:AbortSignal.timeout(25000)});assert.equal(response.status,200);
 const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,artifact.size_in_bytes);assert.equal('sha256:'+A.shaBytes(bytes),pinned.digest);
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'bao-model-resume-'));
 try{const archive=path.join(temp,'checkpoint.zip'),receiptFile=path.join(temp,'receipt.json');fs.writeFileSync(archive,bytes,{mode:0o600});A.atomic(receiptFile,pinned);
  const proc=cp.spawnSync('python3',[path.join(__dirname,'formal-learning-unzip.py'),archive,output,receiptFile],{encoding:'utf8'});assert.equal(proc.status,0,'Checkpoint ZIP contract');
  return {restored:true,name:pinned.name,runId:pinned.runId,attempt:pinned.attempt,artifactId:pinned.artifactId,digest:pinned.digest};
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
if(require.main===module){const args=process.argv.slice(2);const task=args[0]==='resume'?resumeModel(...args.slice(1)):restore(args[0]);
 task.then(r=>console.log(JSON.stringify(r))).catch(()=>{console.error('Learning artifact restore failed; no payload logged');process.exitCode=1;});}
module.exports={checkMetadata,restore,parseResume,resumeModel};
