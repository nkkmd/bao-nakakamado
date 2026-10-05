"use strict";
// MIT. Pinned public match artifacts and immutable publication. No training/final artifacts.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process'),W=require('./equal-time-worker.cjs'),M=require('./equal-time-match.cjs');
function client({fetchImpl=fetch,token=process.env.GITHUB_TOKEN}={}){assert.ok(typeof token==='string'&&token.length);
 const base='https://api.github.com/repos/'+W.spec.repository;
 const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json',Authorization:'Bearer '+token};
 const api=async(endpoint,method='GET',body,missing=false)=>{const r=await fetchImpl(base+endpoint,{method,headers,redirect:'error',signal:AbortSignal.timeout(25000),
  ...(body===undefined?{}:{body:JSON.stringify(body)})});if(missing&&r.status===404)return null;
  assert.equal(r.status,method==='GET'?200:201,'GitHub API failed');return r.json();};return {api,headers,base,fetchImpl};}
function receipts(text,p){assert.ok(typeof text==='string'&&text.length<=20000);const a=JSON.parse(text);assert.ok(Array.isArray(a)&&a.length<=p.binding.shards);
 const seen=new Set();for(const r of a){assert.deepEqual(Object.keys(r).sort(),['artifactId','attempt','digest','headSha','name','repository','runId','shard']);
  W.origin({repository:r.repository,runId:r.runId,attempt:r.attempt,headSha:r.headSha});assert.match(r.artifactId,/^[1-9][0-9]*$/);
  assert.match(r.digest,/^sha256:[a-f0-9]{64}$/);assert.ok(Number.isSafeInteger(r.shard)&&r.shard>=0&&r.shard<p.binding.shards);
  assert.equal(r.name,'strength-v2-shard-'+r.shard);assert.ok(!seen.has(r.shard));seen.add(r.shard);}return a;}
function checkMetadata(run,a,r){assert.equal(String(run.id),r.runId);assert.equal(String(run.run_attempt),r.attempt);assert.equal(run.head_sha,r.headSha);
 assert.equal(run.event,'workflow_dispatch');assert.equal(run.head_branch,'main');assert.equal(run.path,'.github/workflows/equal-time-formal.yml');
 assert.equal(run.repository.full_name,r.repository);assert.equal(String(a.id),r.artifactId);assert.equal(a.name,r.name);assert.equal(a.expired,false);
 assert.equal(a.digest,r.digest);assert.equal(String(a.workflow_run.id),r.runId);assert.equal(a.workflow_run.head_sha,r.headSha);
 assert.ok(Number.isSafeInteger(a.size_in_bytes)&&a.size_in_bytes>0&&a.size_in_bytes<=W.spec.maximumArchiveBytes);return a;}
async function restore(r,directory,io){assert.ok(!fs.existsSync(directory));
 const run=await io.api('/actions/runs/'+r.runId+'/attempts/'+r.attempt),a=await io.api('/actions/artifacts/'+r.artifactId);checkMetadata(run,a,r);
 const redirect=await io.fetchImpl(io.base+'/actions/artifacts/'+r.artifactId+'/zip',{headers:io.headers,redirect:'manual',signal:AbortSignal.timeout(25000)});
 assert.equal(redirect.status,302);const url=new URL(redirect.headers.get('location'));assert.equal(url.protocol,'https:');assert.equal(url.username,'');assert.equal(url.password,'');
 // Signed storage download has no GitHub token. Bound actual streamed bytes, not just metadata.
 const response=await io.fetchImpl(url.toString(),{redirect:'error',signal:AbortSignal.timeout(60000)});assert.equal(response.status,200);
 const chunks=[];let length=0;assert.ok(response.body);for await(const part of response.body){length+=part.length;
  if(length>W.spec.maximumArchiveBytes){await response.body.cancel?.().catch(()=>{});throw Error('Archive limit');}chunks.push(Buffer.from(part));}
 const data=Buffer.concat(chunks);assert.equal(length,a.size_in_bytes);assert.equal('sha256:'+W.bytesHash(data),r.digest);
 const zip=directory+'.zip';assert.ok(!fs.existsSync(zip));fs.mkdirSync(path.dirname(directory),{recursive:true});fs.writeFileSync(zip,data);
 execFileSync('python3',[path.join(__dirname,'equal-time-worker-unzip.py'),zip,directory],{timeout:30000,stdio:'pipe'});
 return {directory,zip,receipt:r};}
const blobSha=b=>crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
async function publish(files,o,p,api,complete){W.origin(o);const ref='refs/heads/nyakua-strength-'+(complete?'result-':'progress-')+p.binding.contractSha256+(complete?'':'-run-'+o.runId);
 const entries=Object.entries(files).sort(([a],[b])=>a.localeCompare(b,'en')).map(([name,bytes])=>{
  assert.match(name,/^(report|receipts|session)\.json$|^shard-([0-9]|[12][0-9]|3[01])\.zip$/);assert.ok(Buffer.isBuffer(bytes));
  return {path:'doc/equal-time-strength-v2/'+name,mode:'100644',type:'blob',sha:blobSha(bytes),bytes};});
 const existing=async()=>{const r=await api('/git/ref/'+ref.slice(5),'GET',undefined,true);if(!r)return null;
  const c=await api('/git/commits/'+r.object.sha),t=await api('/git/trees/'+c.tree.sha+'?recursive=1');assert.equal(t.truncated,false);
  for(const e of entries)assert.equal(t.tree.find(x=>x.path===e.path)?.sha,e.sha,'Existing publication differs: never overwrite');
  const prefix=t.tree.filter(e=>e.path.startsWith('doc/equal-time-strength-v2/')&&e.type==='blob');assert.equal(prefix.length,entries.length);
  return {ref,commitSha:r.object.sha};};
 const old=await existing();if(old)return old;const base=await api('/git/commits/'+o.headSha);
 for(const e of entries){const b=await api('/git/blobs','POST',{content:e.bytes.toString('base64'),encoding:'base64'});assert.equal(b.sha,e.sha);}
 const tree=await api('/git/trees','POST',{base_tree:base.tree.sha,tree:entries.map(({bytes,...e})=>e)});
 const commit=await api('/git/commits','POST',{message:'Preserve fixed equal-time match evidence; no public AI adoption',tree:tree.sha,parents:[o.headSha]});
 try{const r=await api('/git/refs','POST',{ref,sha:commit.sha});assert.equal(r.object.sha,commit.sha);}
 catch{const saved=await existing();if(saved)return saved;throw Error('Publication unavailable; preserve public output');}
 return {ref,commitSha:commit.sha};}
async function currentReceipts(io,o,p){const run=await io.api('/actions/runs/'+o.runId+'/attempts/1');
 assert.equal(run.head_sha,o.headSha);assert.equal(run.run_attempt,1);const all=[];
 for(let page=1;page<=10;page++){const a=await io.api('/actions/runs/'+o.runId+'/artifacts?per_page=100&page='+page);all.push(...a.artifacts);
  if(all.length>=a.total_count)break;assert.ok(page<10,'Artifact pagination limit');}
 const a=all.filter(a=>/^strength-v2-shard-([0-9]|[12][0-9]|3[01])$/.test(a.name));
 return receipts(JSON.stringify(a.map(a=>({repository:o.repository,runId:o.runId,attempt:o.attempt,headSha:o.headSha,
  artifactId:String(a.id),name:a.name,digest:a.digest,shard:Number(a.name.split('-').at(-1))}))),p);}
async function cli([command,directory,shardText]){assert.ok(['preflight','prepare','shard','aggregate'].includes(command));
 if(command==='preflight'){const p=W.profile();console.log(JSON.stringify({binding:p.binding,formalRowsRead:0,formalGamesPlayed:0}));return;}
 assert.ok(directory);const {p,o,mode}=W.context(),io=client();const list=receipts(process.env.BAO_STRENGTH_RECEIPTS||'[]',p);
 assert.ok(mode==='resume'||list.length===0);assert.ok(!fs.existsSync(directory));
 if(command==='prepare'){
  const maximumNewPairs=Number(process.env.BAO_STRENGTH_MAXIMUM_NEW_PAIRS||8);assert.ok(Number.isSafeInteger(maximumNewPairs)&&maximumNewPairs>=1&&maximumNewPairs<=8);
  require('./verify-equal-time-formal-v2.cjs').verify(path.join(W.root,'doc/equal-time-formal-v2'));
  const s=await W.session(io.api,p,o,mode);fs.mkdirSync(directory,{recursive:true});M.save(path.join(directory,'session.json'),s);return;
 }
 const s=W.checkSession(W.read(process.env.BAO_STRENGTH_SESSION_FILE),p);await W.verifyTag(io.api,s);
 if(command==='shard'){
  const shard=Number(shardText);assert.ok(Number.isSafeInteger(shard)&&shard>=0&&shard<p.binding.shards);
  const r=list.find(r=>r.shard===shard),prior=r?await restore(r,directory+'-restore',io):null;
  const maximumNewPairs=Number(process.env.BAO_STRENGTH_MAXIMUM_NEW_PAIRS||8);
  const result=await W.runShard({directory,p,api:io.api,s,o,shard,restored:prior?.directory,maximumNewPairs});console.log(JSON.stringify(result));
  if(result.status==='HOLD')process.exitCode=1;return;
 }
 const current=await currentReceipts(io,o,p);fs.mkdirSync(directory,{recursive:true});const restored=[],errors=[];
 for(const r of current.sort((a,b)=>a.shard-b.shard)){
  try{const item=await restore(r,path.join(directory,'shard-'+r.shard),io);
   const audited=await W.auditDirectory(item.directory,p,io.api);assert.equal(audited.session.sha,s.sha);assert.equal(audited.lease.payload.shard,r.shard);
   // Reused COMPLETE artifacts retain their original lease origin; current artifact is just the carrier.
   restored.push(item);
  }catch{errors.push({shard:r.shard,status:'HOLD-ARTIFACT-OR-CHECKPOINT-AUDIT'});}}
 const report=restored.length===p.binding.shards?await W.aggregate(restored.map(r=>r.directory),p,io.api):{
  schema:1,binding:p.binding,sessionSha:s.sha,status:'HOLD-MISSING-OR-UNAUDITED-SHARDS',availableShards:current.map(r=>r.shard),errors,
  strengthScoresComputed:false,formalRowsRead:0,publicAdopted:false};
 M.save(path.join(directory,'report.json'),report);M.save(path.join(directory,'receipts.json'),current);M.save(path.join(directory,'session.json'),s);
 const files=Object.fromEntries(['report','receipts','session'].map(n=>[n+'.json',fs.readFileSync(path.join(directory,n+'.json'))]));
 // Preserve downloaded digest-verified original ZIPs even when a missing seal blocks replay/resume.
 for(const r of current){const zip=path.join(directory,'shard-'+r.shard+'.zip');if(fs.existsSync(zip))files['shard-'+r.shard+'.zip']=fs.readFileSync(zip);}
 const publication=await publish(files,o,p,io.api,report.status==='COMPLETE-FIXED-SCHEDULE');M.save(path.join(directory,'publication.json'),publication);
 console.log(JSON.stringify({status:report.status,publication}));if(report.status.startsWith('HOLD'))process.exitCode=1;
}
module.exports={client,receipts,checkMetadata,restore,blobSha,publish,currentReceipts,cli};
