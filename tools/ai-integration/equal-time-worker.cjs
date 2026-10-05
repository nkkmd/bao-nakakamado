"use strict";
// MIT. Durable formal-match session and sealed pair-boundary checkpoints. No final data or keys.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {Worker}=require('node:worker_threads'),{performance}=require('node:perf_hooks');
const M=require('./equal-time-match.cjs'),V=require('./equal-time-formal-v2.cjs');
const spec=require('./equal-time-worker-spec.json'),root=path.resolve(__dirname,'../..');
const hash=require('./equal-time-openings.cjs').hash;
const read=f=>JSON.parse(fs.readFileSync(f)),bytesHash=b=>crypto.createHash('sha256').update(b).digest('hex');
const sources=['tools/ai-integration/equal-time-worker.cjs','tools/ai-integration/equal-time-worker-artifact.cjs',
 'tools/ai-integration/equal-time-pair-thread.cjs','tools/ai-integration/equal-time-worker-unzip.py',
 'tools/ai-integration/equal-time-worker-spec.json','.github/workflows/equal-time-formal.yml'];
function fingerprint(){return hash({generator:V.preflight().fingerprint,sources:Object.fromEntries(sources.map(f=>[f,bytesHash(fs.readFileSync(path.join(root,f)))]))});}
function profile(){
 const directory=path.join(root,'doc/equal-time-formal-v2');
 const cbytes=fs.readFileSync(path.join(directory,'contract.json')),mbytes=fs.readFileSync(path.join(directory,'openings.json'));
 assert.equal(bytesHash(cbytes),spec.contractFileSha256);assert.equal(bytesHash(mbytes),spec.manifestFileSha256);
 const contract=JSON.parse(cbytes),manifest=JSON.parse(mbytes);assert.equal(hash(contract),spec.contractSha256);
 assert.equal(hash(manifest),spec.manifestSha256);assert.equal(V.preflight().fingerprint,spec.generatorFingerprint);
 return {binding:{schema:1,id:contract.id,contractSha256:hash(contract),manifestSha256:hash(manifest),runnerFingerprint:fingerprint(),
  shards:contract.design.shards,pairs:contract.design.pairs,budgetMs:contract.timeLimitMs,maximumPlies:contract.maximumPlies},
  openings:manifest.openings,runtime:contract.formalRuntime};
}
function origin(o){assert.deepEqual(Object.keys(o).sort(),['attempt','headSha','repository','runId']);
 assert.equal(o.repository,spec.repository);assert.match(o.runId,/^[1-9][0-9]*$/);assert.equal(o.attempt,'1');assert.match(o.headSha,/^[a-f0-9]{40}$/);return o;}
function context(env=process.env){const p=profile();
 assert.equal(env.GITHUB_EVENT_NAME,'workflow_dispatch');assert.equal(env.GITHUB_REF,'refs/heads/main');
 const o=origin({repository:env.GITHUB_REPOSITORY,runId:env.GITHUB_RUN_ID,attempt:env.GITHUB_RUN_ATTEMPT,headSha:env.GITHUB_SHA});
 assert.equal(env.BAO_STRENGTH_EXPECTED_HEAD,o.headSha);assert.equal(env.BAO_STRENGTH_EXPECTED_FINGERPRINT,p.binding.runnerFingerprint);
 assert.equal(env.BAO_STRENGTH_AUTHORIZATION,'RUN-FROZEN-EQUAL-TIME-v2');assert.ok(['start','resume'].includes(env.BAO_STRENGTH_MODE));
 return {p,o,mode:env.BAO_STRENGTH_MODE};}
function runtime(env,p){const r=p.runtime;
 assert.equal(env.node,r.node);assert.equal(env.platform,r.platform);assert.equal(env.arch,r.arch);
 assert.ok(r.allowedCpuModels.includes(env.cpu),'Unregistered CPU: HOLD');assert.equal(env.runnerImage,r.runnerImage,'Unregistered runner image: HOLD');return env;}
const sessionRef=p=>'refs/tags/nyakua-strength-v2-'+p.binding.contractSha256;
const leaseRef=(p,s,g)=>sessionRef(p)+'-shard-'+s+'-g'+g;
async function getTag(api,ref){const r=await api('/git/ref/'+ref.slice(5),'GET',undefined,true);if(!r)return null;
 assert.equal(r.ref,ref);assert.equal(r.object.type,'tag');const t=await api('/git/tags/'+r.object.sha);
 assert.equal(t.tag,ref.slice(10));assert.equal(t.object.type,'commit');return {ref,sha:r.object.sha,headSha:t.object.sha,payload:JSON.parse(t.message)};}
async function verifyTag(api,tag){assert.match(tag.sha,/^[a-f0-9]{40}$/);assert.deepEqual(await getTag(api,tag.ref),tag);return tag;}
async function claim(api,ref,payload,o){origin(o);assert.equal(await getTag(api,ref),null,'Durable receipt exists: HOLD, do not remeasure');
 const t=await api('/git/tags','POST',{tag:ref.slice(10),message:JSON.stringify(payload),object:o.headSha,type:'commit'});
 assert.match(t.sha,/^[a-f0-9]{40}$/);
 // No claim retry on a lost response: the durable ref must be inspected by a later recovery step.
 const r=await api('/git/refs','POST',{ref,sha:t.sha});assert.equal(r.ref,ref);assert.equal(r.object.sha,t.sha);
 return verifyTag(api,{ref,sha:t.sha,headSha:o.headSha,payload});}
function checkSession(s,p){assert.equal(s.ref,sessionRef(p));assert.deepEqual(Object.keys(s.payload).sort(),['binding','origin']);
 assert.deepEqual(s.payload.binding,p.binding);origin(s.payload.origin);assert.equal(s.headSha,s.payload.origin.headSha);return s;}
async function session(api,p,o,mode){if(mode==='start')return claim(api,sessionRef(p),{binding:p.binding,origin:o},o);
 assert.equal(mode,'resume');const s=await getTag(api,sessionRef(p));assert.ok(s,'Missing original session');return checkSession(s,p);}
const ids=(p,shard)=>Array.from({length:p.binding.pairs},(_,i)=>i).filter(i=>i%p.binding.shards===shard);
function checkLease(l,s,p){const b=l.payload;assert.deepEqual(Object.keys(b).sort(),['environment','generation','hostId','origin','previousSealSha','sessionSha','shard']);
 origin(b.origin);runtime(b.environment,p);assert.match(b.hostId,/^[a-f0-9]{32}$/);assert.equal(b.sessionSha,s.sha);
 assert.ok(Number.isSafeInteger(b.shard)&&b.shard>=0&&b.shard<p.binding.shards);assert.ok(Number.isSafeInteger(b.generation)&&b.generation>=0);
 assert.equal(l.ref,leaseRef(p,b.shard,b.generation));assert.equal(l.headSha,b.origin.headSha);
 assert.ok(b.generation===0?b.previousSealSha===null:/^[a-f0-9]{40}$/.test(b.previousSealSha));return l;}
function auditPair(pair,s,p,shard){assert.deepEqual(Object.keys(pair).sort(),['games','lease','pairIndex','setupMs']);checkLease(pair.lease,s,p);
 assert.equal(pair.lease.payload.shard,shard);assert.ok(ids(p,shard).includes(pair.pairIndex));
 assert.ok(Number.isFinite(pair.setupMs)&&pair.setupMs>=0);assert.equal(pair.games.length,2);
 const sides=pair.pairIndex%2?[1,0]:[0,1];assert.deepEqual(pair.games.map(g=>g.modelSide),sides);
 pair.games.forEach(g=>M.auditGame(g,{pairIndex:pair.pairIndex,modelSide:g.modelSide,budgetMs:p.binding.budgetMs,
  maximumPlies:p.binding.maximumPlies,opening:p.openings[pair.pairIndex]}));return pair;}
async function auditDirectory(directory,p,api){
 const s=checkSession(read(path.join(directory,'session.json')),p),l=checkLease(read(path.join(directory,'lease.json')),s,p);
 const ledger=read(path.join(directory,'ledger.json')),seal=read(path.join(directory,'seal.json')),shard=l.payload.shard;
 assert.deepEqual(Object.keys(ledger).sort(),['active','completed','leaseSha','pending','sessionSha','status']);
 assert.equal(ledger.sessionSha,s.sha);assert.equal(ledger.leaseSha,l.sha);assert.ok(['COMPLETE','PAUSED','HOLD'].includes(ledger.status));
 assert.equal(seal.ref,l.ref+'-seal');assert.equal(seal.headSha,l.headSha);
 assert.deepEqual(seal.payload,{leaseSha:l.sha,ledgerSha256:hash(ledger),origin:l.payload.origin});
 await verifyTag(api,s);await verifyTag(api,l);await verifyTag(api,seal);
 const pairIds=Object.keys(ledger.completed).map(Number).sort((a,b)=>a-b),pairs=[];
 assert.ok(pairIds.every(i=>ids(p,shard).includes(i)));assert.deepEqual(ledger.pending,ids(p,shard).filter(i=>!pairIds.includes(i)));
 assert.equal(ledger.status==='COMPLETE',ledger.pending.length===0&&ledger.active===null);
 const names=['session.json','lease.json','ledger.json','seal.json',...pairIds.map(i=>'pair-'+i+'.json')];
 if(ledger.active!==null){assert.equal(ledger.status,'HOLD');assert.ok(ledger.pending.includes(ledger.active));names.push('active.json');
  const a=read(path.join(directory,'active.json'));assert.deepEqual(Object.keys(a).sort(),['games','leaseSha','pairIndex']);
  assert.equal(a.leaseSha,l.sha);assert.equal(a.pairIndex,ledger.active);assert.ok(a.games.length<=2);
  a.games.forEach((g,k)=>M.auditGame(g,{pairIndex:a.pairIndex,modelSide:(a.pairIndex%2?[1,0]:[0,1])[k],budgetMs:p.binding.budgetMs,
   maximumPlies:p.binding.maximumPlies,opening:p.openings[a.pairIndex]}));
 }else assert.ok(ledger.status!=='HOLD','Unexplained HOLD');
 assert.deepEqual(fs.readdirSync(directory).sort(),names.sort(),'Unexpected or missing checkpoint files');
 for(const i of pairIds){assert.equal(String(i),Object.keys(ledger.completed).find(k=>Number(k)===i));
  const pair=read(path.join(directory,'pair-'+i+'.json'));assert.equal(hash(pair),ledger.completed[i]);auditPair(pair,s,p,shard);
  assert.ok(pair.lease.payload.generation<=l.payload.generation);await verifyTag(api,pair.lease);pairs.push(pair);}
 return {session:s,lease:l,ledger,seal,pairs};
}
function supervise(data,{onGame=()=>{},watchdogMs=spec.pairWatchdogMs}={}){return new Promise((resolve,reject)=>{
 const w=new Worker(path.join(__dirname,'equal-time-pair-thread.cjs'),{workerData:data});let result=null,failed=false,settled=false;
 const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);if(error)reject(error);else resolve(result);};
 const timer=setTimeout(()=>{failed=true;w.terminate().then(()=>finish(Error('Pair watchdog: HOLD')));},watchdogMs);
 w.on('message',m=>{try{if(m.type==='game')onGame(m.game);else if(m.type==='pair'){assert.equal(result,null);result=m;}
  else throw Error('Pair worker failed');}catch{failed=true;w.terminate().then(()=>finish(Error('Pair checkpoint failure: HOLD')));}});
 w.on('error',()=>{failed=true;finish(Error('Pair worker error: HOLD'));});
 w.on('exit',code=>finish(!failed&&code===0&&result?null:Error('Incomplete pair: HOLD')));
 });}
async function runShard({directory,p,api,s,o,shard,restored=null,maximumNewPairs=8,environment=M.environment(),play=supervise}){
 checkSession(s,p);await verifyTag(api,s);origin(o);runtime(environment,p);assert.ok(ids(p,shard).length===8||p.binding.id==='DEVELOPMENT-ONLY');
 assert.ok(Number.isSafeInteger(maximumNewPairs)&&maximumNewPairs>=1&&maximumNewPairs<=8);assert.ok(!fs.existsSync(directory));
 let previous=null;if(restored){previous=await auditDirectory(restored,p,api);assert.equal(previous.lease.payload.shard,shard);
  assert.equal(previous.session.sha,s.sha);assert.notEqual(previous.ledger.status,'HOLD','Interrupted pair: explicit recovery review required');
  if(previous.ledger.status==='PAUSED')assert.deepEqual(environment,previous.lease.payload.environment,'Resume environment changed');}
 const generation=previous?previous.lease.payload.generation+1:0;
 if(previous?.ledger.status==='COMPLETE'){fs.cpSync(restored,directory,{recursive:true});return {status:'COMPLETE',generated:0,reused:previous.pairs.length};}
 const lease=await claim(api,leaseRef(p,shard,generation),{sessionSha:s.sha,shard,generation,previousSealSha:previous?.seal.sha||null,
  origin:o,environment,hostId:crypto.randomBytes(16).toString('hex')},o);
 fs.mkdirSync(directory,{recursive:true});M.save(path.join(directory,'session.json'),s);M.save(path.join(directory,'lease.json'),lease);
 const completed={...previous?.ledger.completed};if(previous)for(const pair of previous.pairs)fs.copyFileSync(path.join(restored,'pair-'+pair.pairIndex+'.json'),path.join(directory,'pair-'+pair.pairIndex+'.json'));
 const ledger={sessionSha:s.sha,leaseSha:lease.sha,completed,pending:ids(p,shard).filter(i=>!Object.hasOwn(completed,i)),active:null,status:'PAUSED'};
 const started=performance.now();let generated=0;M.save(path.join(directory,'ledger.json'),ledger);
 for(const pairIndex of [...ledger.pending]){
  if(generated===maximumNewPairs||performance.now()-started+spec.pairWatchdogMs>=spec.workerSoftLimitMs)break;
  ledger.active=pairIndex;ledger.status='HOLD';const active={pairIndex,leaseSha:lease.sha,games:[]};
  M.save(path.join(directory,'active.json'),active);M.save(path.join(directory,'ledger.json'),ledger);
  try{
   const result=await play({opening:p.openings[pairIndex],pairIndex,budgetMs:p.binding.budgetMs,maximumPlies:p.binding.maximumPlies},
    {onGame:g=>{active.games.push(g);assert.ok(active.games.length<=2);M.save(path.join(directory,'active.json'),active);}});
   assert.deepEqual(result.environment,environment);const pair={pairIndex,lease,games:result.games,setupMs:result.setupMs};auditPair(pair,s,p,shard);
   assert.deepEqual(active.games,pair.games,'Worker event/result discrepancy');
   M.save(path.join(directory,'pair-'+pairIndex+'.json'),pair);completed[pairIndex]=hash(pair);
   ledger.pending=ledger.pending.filter(i=>i!==pairIndex);ledger.active=null;ledger.status=ledger.pending.length?'PAUSED':'COMPLETE';
   M.save(path.join(directory,'ledger.json'),ledger);fs.unlinkSync(path.join(directory,'active.json'));generated++;
  }catch{break;}
 }
 const seal=await claim(api,lease.ref+'-seal',{leaseSha:lease.sha,ledgerSha256:hash(ledger),origin:o},o);
 M.save(path.join(directory,'seal.json'),seal);await auditDirectory(directory,p,api);
 return {status:ledger.status,generated,reused:previous?.pairs.length||0};
}
async function aggregate(directories,p,api){assert.equal(directories.length,p.binding.shards);const shards=[];
 for(const directory of directories)shards.push(await auditDirectory(directory,p,api));
 assert.deepEqual(shards.map(s=>s.lease.payload.shard).sort((a,b)=>a-b),Array.from({length:p.binding.shards},(_,i)=>i));
 assert.equal(new Set(shards.map(s=>s.session.sha)).size,1);const pairs=shards.flatMap(s=>s.pairs).sort((a,b)=>a.pairIndex-b.pairIndex);
 const base={schema:1,binding:p.binding,sessionSha:shards[0].session.sha,completedPairs:pairs.length,
  shardStatuses:shards.map(s=>({shard:s.lease.payload.shard,status:s.ledger.status,sealSha:s.seal.sha})).sort((a,b)=>a.shard-b.shard),
  recordsSha256:hash(pairs),formalRowsRead:0,publicAdopted:false};
 if(shards.some(s=>s.ledger.status!=='COMPLETE'))return {...base,status:'HOLD-INCOMPLETE',strengthScoresComputed:false};
 assert.equal(pairs.length,p.binding.pairs);assert.equal(p.binding.id,V.spec.id,'Development roots cannot produce formal strength scores');
 const games=pairs.flatMap(p=>p.games),operational=M.operationalSummary(games,p.binding.budgetMs);
 return {...base,status:'COMPLETE-FIXED-SCHEDULE',strengthScoresComputed:true,strength:M.strengthSummary(pairs.map(p=>p.games)),
  operational:{statuses:operational.statuses,actors:operational.actors,gameP95Seconds:operational.gameP95Seconds,maximumGameSeconds:operational.maximumGameSeconds},
  inferenceScope:'conditional-independent-opening-pairs; fixed-generated-distribution-only; no-public-adoption'};
}
module.exports={spec,root,hash,read,bytesHash,fingerprint,profile,origin,context,runtime,sessionRef,leaseRef,getTag,verifyTag,claim,
 checkSession,session,ids,checkLease,auditPair,auditDirectory,supervise,runShard,aggregate};
if(require.main===module)require('./equal-time-worker-artifact.cjs').cli(process.argv.slice(2)).catch(e=>{console.error('Strength worker HOLD: '+e.message);process.exitCode=1;});
