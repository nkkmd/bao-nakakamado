"use strict";
// MIT. Real worker-thread smoke on excluded pilot openings and an in-memory Git registry only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const W=require('./equal-time-worker.cjs'),M=require('./equal-time-match.cjs'),O=require('./equal-time-openings.cjs');
const A=require('./equal-time-worker-artifact.cjs'),{execFileSync}=require('node:child_process');
async function verify(directory){assert.ok(!fs.existsSync(directory));fs.mkdirSync(directory,{recursive:true});
 const environment=M.environment(),openings=O.pilotOpenings(),p={binding:{schema:1,id:'DEVELOPMENT-ONLY',contractSha256:W.hash(['worker-smoke',openings]),
  manifestSha256:W.hash(openings),runnerFingerprint:W.fingerprint(),shards:2,pairs:4,budgetMs:150,maximumPlies:400},openings,
  runtime:{node:environment.node,platform:environment.platform,arch:environment.arch,allowedCpuModels:[environment.cpu],runnerImage:environment.runnerImage}};
 const objects=new Map(),refs=new Map();let serial=1;
 const api=async(endpoint,method='GET',body,missing=false)=>{
  if(method==='GET'){if(endpoint.startsWith('/git/ref/')){const r=refs.get('refs/'+endpoint.slice(9));if(!r&&!missing)throw Error('Missing');return r||null;}
   assert.ok(endpoint.startsWith('/git/tags/'));return objects.get(endpoint.slice(10));}
  assert.equal(method,'POST');if(endpoint==='/git/tags'){const sha=String(serial++).padStart(40,'0');
   objects.set(sha,{tag:body.tag,message:body.message,object:{type:body.type,sha:body.object}});return {sha};}
  assert.equal(endpoint,'/git/refs');assert.ok(!refs.has(body.ref));const r={ref:body.ref,object:{type:'tag',sha:body.sha}};refs.set(body.ref,r);return r;
 };
 const origin={repository:W.spec.repository,runId:'1',attempt:'1',headSha:'d'.repeat(40)},s=await W.session(api,p,origin,'start');let calls=0;
 const play=async(...args)=>{calls++;return W.supervise(...args);};const summaries=[];
 for(const shard of [0,1]){
  const one=path.join(directory,'pause-'+shard),two=path.join(directory,'complete-'+shard),three=path.join(directory,'reuse-'+shard);
  const first=await W.runShard({directory:one,p,api,s,o:origin,shard,maximumNewPairs:1,play});assert.equal(first.status,'PAUSED');
  const next=await W.runShard({directory:two,p,api,s,o:origin,shard,restored:one,play});assert.equal(next.status,'COMPLETE');
  const before=calls,reused=await W.runShard({directory:three,p,api,s,o:origin,shard,restored:two,play});assert.equal(calls,before);assert.equal(reused.generated,0);
  for(const file of fs.readdirSync(two))assert.deepEqual(fs.readFileSync(path.join(two,file)),fs.readFileSync(path.join(three,file)));
  // Exercise the production ZIP, pinned Actions metadata, token-free download and replay audit path.
  const zip=path.join(directory,'development-'+shard+'.zip');
  execFileSync('python3',['-c','import pathlib,sys,zipfile\np=pathlib.Path(sys.argv[1])\nwith zipfile.ZipFile(sys.argv[2],"w",zipfile.ZIP_DEFLATED) as z:\n for f in sorted(p.iterdir()): z.write(f,f.name)',three,zip]);
  const bytes=fs.readFileSync(zip),receipt={...origin,artifactId:String(10+shard),name:'strength-v2-shard-'+shard,shard,digest:'sha256:'+W.bytesHash(bytes)};
  const io={base:'https://api.github.com/repos/'+origin.repository,headers:{Authorization:'Bearer development-only'},
   api:async endpoint=>endpoint.includes('/attempts/')?{id:1,run_attempt:1,head_sha:origin.headSha,event:'workflow_dispatch',head_branch:'main',
    path:'.github/workflows/equal-time-formal.yml',repository:{full_name:origin.repository}}:
    {id:10+shard,name:receipt.name,expired:false,digest:receipt.digest,size_in_bytes:bytes.length,workflow_run:{id:1,head_sha:origin.headSha}},
   fetchImpl:async(url,options)=>{if(url.includes('api.github.com'))return new Response(null,{status:302,headers:{location:'https://storage.example/smoke'}});
    assert.equal(options.headers,undefined);return new Response(bytes);}};
  A.receipts(JSON.stringify([receipt]),p);const restored=await A.restore(receipt,path.join(directory,'artifact-'+shard),io);
  const audit=await W.auditDirectory(restored.directory,p,api);summaries.push(...audit.pairs.flatMap(pair=>pair.games).map(game=>({pairIndex:game.pairIndex,modelSide:game.modelSide,status:game.status,plies:game.steps.length})));
 }
 assert.equal(calls,4);assert.equal(summaries.length,8);
 const report={schema:1,status:'DEVELOPMENT-WORKER-SMOKE-PASS',runnerFingerprint:W.fingerprint(),frozenBinding:W.profile().binding,
  environment,excludedOpeningPairs:4,developmentGames:8,pairThreadExecutions:calls,completedShardReuseSearches:0,
  sealedBoundaryResumeVerified:true,byteExactReuseVerified:true,pinnedArchiveRestoreVerified:true,tokenFreeStorageDownloadVerified:true,games:summaries,
  formalRowsRead:0,formalGamesPlayed:0,strengthScoresComputed:false,liveGitHubWrites:0,publicAdopted:false};
 M.save(path.join(directory,'report.json'),report);return report;
}
if(require.main===module)verify(path.resolve(process.argv[2])).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={verify};
