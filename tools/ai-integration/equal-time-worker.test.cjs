"use strict";
// MIT. Fake durable Git/Actions and known excluded roots only; no formal measurements.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const W=require('./equal-time-worker.cjs'),A=require('./equal-time-worker-artifact.cjs'),M=require('./equal-time-match.cjs'),O=require('./equal-time-openings.cjs');
const clone=x=>structuredClone(x),o={repository:W.spec.repository,runId:'100',attempt:'1',headSha:'a'.repeat(40)};
function fakeGit(){const refs=new Map(),objects=new Map(),trees=new Map(),commits=new Map([[o.headSha,{tree:{sha:'b'.repeat(40)}}]]),blobs=new Map();let n=1,writes=0;
 const sha=()=>String(n++).padStart(40,'0');
 const api=async(endpoint,method='GET',body,missing=false)=>{
  if(method==='GET'){
   let value;if(endpoint.startsWith('/git/ref/'))value=refs.get('refs/'+endpoint.slice(9));
   else if(endpoint.startsWith('/git/tags/'))value=objects.get(endpoint.slice(10));
   else if(endpoint.startsWith('/git/commits/'))value=commits.get(endpoint.slice(13));
   else if(endpoint.startsWith('/git/trees/'))value=trees.get(endpoint.slice(11).split('?')[0]);
   else throw Error('Unexpected GET '+endpoint);if(!value){if(missing)return null;throw Error('Missing '+endpoint);}return clone(value);
  }
  assert.equal(method,'POST');writes++;
  if(endpoint==='/git/tags'){const id=sha();objects.set(id,{tag:body.tag,message:body.message,object:{type:body.type,sha:body.object}});return {sha:id};}
  if(endpoint==='/git/refs'){assert.ok(!refs.has(body.ref),'Existing ref');const object={sha:body.sha,type:objects.has(body.sha)?'tag':'commit'};
   const r={ref:body.ref,object};refs.set(body.ref,r);return clone(r);}
  if(endpoint==='/git/blobs'){const bytes=Buffer.from(body.content,body.encoding==='base64'?'base64':'utf8'),id=A.blobSha(bytes);blobs.set(id,bytes);return {sha:id};}
  if(endpoint==='/git/trees'){const id=sha();trees.set(id,{tree:body.tree,truncated:false});return {sha:id};}
  if(endpoint==='/git/commits'){const id=sha();commits.set(id,{tree:{sha:body.tree}});return {sha:id};}
  throw Error('Unexpected POST '+endpoint);
 };return {api,refs,objects,trees,commits,blobs,get writes(){return writes;}};
}
function developmentProfile(){const e=M.environment(),openings=O.pilotOpenings();return {binding:{schema:1,id:'DEVELOPMENT-ONLY',
 contractSha256:W.hash(['development',openings]),manifestSha256:W.hash(openings),runnerFingerprint:W.fingerprint(),shards:2,pairs:4,budgetMs:150,maximumPlies:400},
 openings,runtime:{node:e.node,platform:e.platform,arch:e.arch,allowedCpuModels:[e.cpu],runnerImage:e.runnerImage}};}
function fakePlay(p,counter){return async({opening,pairIndex,budgetMs,maximumPlies},{onGame})=>{
 counter.calls++;const players={model:{analyzeMove(){throw Error('synthetic');}},baseline:{analyzeMove(){throw Error('synthetic');}}};
 const games=(pairIndex%2?[1,0]:[0,1]).map(modelSide=>M.playGame(opening,pairIndex,modelSide,budgetMs,{players,maximumPlies}));
 games.forEach(onGame);return {games,environment:M.environment(),setupMs:0};};}
async function fixture(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'bao-worker-test-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const p=developmentProfile(),git=fakeGit(),s=await W.session(git.api,p,o,'start');return {directory,p,git,s};}
test('fixed original contract and generator hashes pass without formal games',()=>{const p=W.profile();assert.equal(p.binding.pairs,256);assert.equal(p.binding.shards,32);assert.equal(p.binding.budgetMs,150);});
test('production context rejects reruns, PRs, branches, stale head/fingerprint and unregistered environment',()=>{
 const p=W.profile(),env={GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',GITHUB_REPOSITORY:o.repository,
  GITHUB_RUN_ID:o.runId,GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:o.headSha,BAO_STRENGTH_EXPECTED_HEAD:o.headSha,
  BAO_STRENGTH_EXPECTED_FINGERPRINT:p.binding.runnerFingerprint,BAO_STRENGTH_AUTHORIZATION:'RUN-FROZEN-EQUAL-TIME-v2',BAO_STRENGTH_MODE:'start'};
 assert.deepEqual(W.context(env).o,o);for(const [k,v] of Object.entries({GITHUB_RUN_ATTEMPT:'2',GITHUB_EVENT_NAME:'pull_request',GITHUB_REF:'refs/heads/other',
 BAO_STRENGTH_EXPECTED_HEAD:'b'.repeat(40),BAO_STRENGTH_EXPECTED_FINGERPRINT:'0'.repeat(64),BAO_STRENGTH_AUTHORIZATION:'OPEN-FROZEN-FINAL-ONCE'}))assert.throws(()=>W.context({...env,[k]:v}));
 assert.throws(()=>W.runtime({...M.environment(),cpu:'unknown'},p));
});
test('duplicate/racing session claims and lost ref response never create a second campaign',async t=>{
 const {p,git,s}=await fixture(t);await assert.rejects(W.session(git.api,p,o,'start'));assert.deepEqual(await W.session(git.api,p,o,'resume'),s);
 const p2={...p,binding:{...p.binding,contractSha256:'c'.repeat(64)}};
 const lost=async(...args)=>{const result=await git.api(...args);if(args[0]==='/git/refs'&&args[1]==='POST')throw Error('lost');return result;};
 await assert.rejects(W.session(lost,p2,o,'start'));await assert.rejects(W.session(git.api,p2,o,'start'));
 assert.equal((await W.session(git.api,p2,o,'resume')).payload.origin.runId,o.runId);
});
test('sealed pause resumes untouched pairs; completed shard reuses every byte with zero searches',async t=>{
 const {directory,p,git,s}=await fixture(t),counter={calls:0},play=fakePlay(p,counter),one=path.join(directory,'one');
 assert.equal((await W.runShard({directory:one,p,api:git.api,s,o,shard:0,maximumNewPairs:1,play})).status,'PAUSED');
 const original=fs.readFileSync(path.join(one,'pair-0.json')),two=path.join(directory,'two');
 assert.equal((await W.runShard({directory:two,p,api:git.api,s,o,shard:0,restored:one,play})).status,'COMPLETE');
 assert.deepEqual(fs.readFileSync(path.join(two,'pair-0.json')),original);assert.equal(counter.calls,2);
 const writes=git.writes,three=path.join(directory,'three');const result=await W.runShard({directory:three,p,api:git.api,s,o,shard:0,restored:two,play});
 assert.deepEqual(result,{status:'COMPLETE',generated:0,reused:2});assert.equal(counter.calls,2);assert.equal(git.writes,writes);
 assert.deepEqual(fs.readdirSync(three),fs.readdirSync(two));for(const f of fs.readdirSync(two))assert.deepEqual(fs.readFileSync(path.join(two,f)),fs.readFileSync(path.join(three,f)));
});
test('lease without seal/checkpoint prevents a fresh shard; stale paused checkpoint cannot restart generation',async t=>{
 const {directory,p,git,s}=await fixture(t),counter={calls:0},play=fakePlay(p,counter),one=path.join(directory,'one');
 await W.runShard({directory:one,p,api:git.api,s,o,shard:0,maximumNewPairs:1,play});
 await assert.rejects(W.runShard({directory:path.join(directory,'fresh'),p,api:git.api,s,o,shard:0,play}));
 await W.runShard({directory:path.join(directory,'two'),p,api:git.api,s,o,shard:0,restored:one,play});
 await assert.rejects(W.runShard({directory:path.join(directory,'stale'),p,api:git.api,s,o,shard:0,restored:one,play}));assert.equal(counter.calls,2);
});
test('interrupted pair retains first game and HOLD; no automatic replay',async t=>{
 const {directory,p,git,s}=await fixture(t),dest=path.join(directory,'held'),counter={calls:0};
 const play=async(data,{onGame})=>{counter.calls++;const r=await fakePlay(p,{calls:0})(data,{onGame:()=>{}});onGame(r.games[0]);throw Error('interrupted');};
 assert.equal((await W.runShard({directory:dest,p,api:git.api,s,o,shard:0,play})).status,'HOLD');
 assert.equal((await W.auditDirectory(dest,p,git.api)).ledger.active,0);assert.equal(W.read(path.join(dest,'active.json')).games.length,1);
 await assert.rejects(W.runShard({directory:path.join(directory,'retry'),p,api:git.api,s,o,shard:0,restored:dest,play}));assert.equal(counter.calls,1);
});
test('seal response loss preserves completed records but forbids remeasurement or unsealed resume',async t=>{
 const {directory,p,git,s}=await fixture(t),counter={calls:0},dest=path.join(directory,'lost');
 const lost=async(...args)=>{const value=await git.api(...args);if(args[0]==='/git/refs'&&args[1]==='POST'&&args[2].ref.endsWith('-seal'))throw Error('lost seal response');return value;};
 await assert.rejects(W.runShard({directory:dest,p,api:lost,s,o,shard:0,play:fakePlay(p,counter)}));
 assert.equal(W.read(path.join(dest,'ledger.json')).status,'COMPLETE');assert.equal(fs.existsSync(path.join(dest,'pair-0.json')),true);
 await assert.rejects(W.runShard({directory:path.join(directory,'fresh'),p,api:git.api,s,o,shard:0,play:fakePlay(p,counter)}));
 await assert.rejects(W.runShard({directory:path.join(directory,'resume'),p,api:git.api,s,o,shard:0,restored:dest,play:fakePlay(p,counter)}));assert.equal(counter.calls,2);
});
test('supervisor watchdog terminates an unfinished thread without a replacement search',async()=>{
 await assert.rejects(W.supervise({opening:O.pilotOpenings()[0],pairIndex:0,budgetMs:150,maximumPlies:400},{watchdogMs:1}),/watchdog|Incomplete/);
});
test('source, origin, checksum, order, unknown files and seal mutations fail before new search',async t=>{
 const {directory,p,git,s}=await fixture(t),dest=path.join(directory,'done');await W.runShard({directory:dest,p,api:git.api,s,o,shard:0,play:fakePlay(p,{calls:0})});
 for(const file of ['session.json','lease.json','ledger.json','seal.json','pair-0.json']){
  const original=fs.readFileSync(path.join(dest,file)),value=JSON.parse(original);value.corruption=true;M.save(path.join(dest,file),value);
  await assert.rejects(W.auditDirectory(dest,p,git.api));fs.writeFileSync(path.join(dest,file),original);}
 const file=path.join(dest,'pair-0.json'),original=fs.readFileSync(file),pair=JSON.parse(original);pair.games.reverse();M.save(file,pair);
 await assert.rejects(W.auditDirectory(dest,p,git.api));fs.writeFileSync(file,original);
 fs.writeFileSync(path.join(dest,'unknown.json'),'{}');await assert.rejects(W.auditDirectory(dest,p,git.api));
});
test('unregistered resume environment blocks search at a sealed boundary',async t=>{
 const {directory,p,git,s}=await fixture(t),counter={calls:0},dest=path.join(directory,'pause'),play=fakePlay(p,counter);
 await W.runShard({directory:dest,p,api:git.api,s,o,shard:0,maximumNewPairs:1,play});
 await assert.rejects(W.runShard({directory:path.join(directory,'next'),p,api:git.api,s,o,shard:0,restored:dest,play,environment:{...M.environment(),runnerImage:'different'}}));assert.equal(counter.calls,1);
});
test('partial schedule has no strength score; development roots never become a formal result',async t=>{
 const {directory,p,git,s}=await fixture(t),dirs=[];for(const shard of [0,1]){const dest=path.join(directory,'shard-'+shard);dirs.push(dest);
  await W.runShard({directory:dest,p,api:git.api,s,o,shard,maximumNewPairs:1,play:fakePlay(p,{calls:0})});}
 const report=await W.aggregate(dirs,p,git.api);assert.equal(report.status,'HOLD-INCOMPLETE');assert.equal(report.strengthScoresComputed,false);assert.equal(report.strength,undefined);
 const done=[];for(const shard of [0,1]){const dest=path.join(directory,'done-'+shard);done.push(dest);await W.runShard({directory:dest,p,api:git.api,s,o,shard,restored:dirs[shard],play:fakePlay(p,{calls:0})});}
 await assert.rejects(W.aggregate(done,p,git.api),/Development roots/);await assert.rejects(W.aggregate([dirs[0],dirs[0]],p,git.api));
});
test('pinned artifact receipt and metadata reject wrong attempt, origin, digest, expired and duplicate shards',()=>{
 const p=W.profile(),r={...o,artifactId:'200',name:'strength-v2-shard-0',shard:0,digest:'sha256:'+'c'.repeat(64)};
 const run={id:100,run_attempt:1,head_sha:o.headSha,event:'workflow_dispatch',head_branch:'main',path:'.github/workflows/equal-time-formal.yml',repository:{full_name:o.repository}};
 const a={id:200,name:r.name,expired:false,digest:r.digest,size_in_bytes:100,workflow_run:{id:100,head_sha:o.headSha}};
 assert.deepEqual(A.receipts(JSON.stringify([r]),p),[r]);A.checkMetadata(run,a,r);
 for(const change of [{expired:true},{digest:'sha256:'+'d'.repeat(64)},{size_in_bytes:33554433},{workflow_run:{id:101,head_sha:o.headSha}}])assert.throws(()=>A.checkMetadata(run,{...a,...change},r));
 assert.throws(()=>A.checkMetadata({...run,run_attempt:2},a,r));assert.throws(()=>A.receipts(JSON.stringify([r,r]),p));
 assert.throws(()=>A.receipts(JSON.stringify([{...r,attempt:'2'}]),p));
});
test('signed storage download has no authorization; wrong digest fails before extraction',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'bao-download-test-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const r={...o,artifactId:'200',name:'strength-v2-shard-0',shard:0,digest:'sha256:'+'c'.repeat(64)},data=Buffer.from('wrong zip');
 const run={id:100,run_attempt:1,head_sha:o.headSha,event:'workflow_dispatch',head_branch:'main',path:'.github/workflows/equal-time-formal.yml',repository:{full_name:o.repository}};
 const a={id:200,name:r.name,expired:false,digest:r.digest,size_in_bytes:data.length,workflow_run:{id:100,head_sha:o.headSha}};let downloaded=false;
 const io={api:async endpoint=>endpoint.includes('attempts')?run:a,headers:{Authorization:'Bearer private'},base:'https://api.github.com/repos/'+o.repository,
  fetchImpl:async(url,options)=>{if(url.includes('api.github.com'))return new Response(null,{status:302,headers:{location:'https://storage.example/signed'}});
   assert.equal(options.headers,undefined);downloaded=true;return new Response(data);}};
 await assert.rejects(A.restore(r,path.join(directory,'restore'),io));assert.equal(downloaded,true);assert.equal(fs.existsSync(path.join(directory,'restore')),false);
});
test('immutable publication is idempotent, recovers a lost ref response, and refuses changed evidence',async()=>{
 const git=fakeGit(),p=developmentProfile(),files={'report.json':Buffer.from('{"status":"HOLD"}\n'),'receipts.json':Buffer.from('[]\n'),'session.json':Buffer.from('{}\n')};
 const lost=async(...args)=>{const result=await git.api(...args);if(args[0]==='/git/refs'&&args[1]==='POST')throw Error('lost');return result;};
 const first=await A.publish(files,o,p,lost,false),writes=git.writes;assert.deepEqual(await A.publish(files,o,p,git.api,false),first);assert.equal(git.writes,writes);
 await assert.rejects(A.publish({...files,'report.json':Buffer.from('{}')},o,p,git.api,false));assert.equal(git.refs.has('refs/heads/main'),false);
});
test('formal workflow is manual only, pinned, serialized, no collection keys and read-only development checks',()=>{
 const workflow=fs.readFileSync(path.join(W.root,'.github/workflows/equal-time-formal.yml'),'utf8');
 assert.ok(!/pull_request:|push:|schedule:|BAO_COLLECTION_KEY|secrets\./.test(workflow));assert.match(workflow,/node-version: '24\.21\.0'/);
 assert.match(workflow,/cancel-in-progress: false/);assert.match(workflow,/max-parallel: 4/);assert.match(workflow,/github.run_attempt == 1/);
 const check=fs.readFileSync(path.join(W.root,'.github/workflows/equal-time-worker-check.yml'),'utf8');assert.ok(!/contents: write|secrets\./.test(check));
});
module.exports={fakeGit,developmentProfile,fakePlay,o};
