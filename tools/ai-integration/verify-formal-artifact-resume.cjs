"use strict";
// MIT. Real Actions API/ZIP restore proof, development data and public test key only.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),assert=require('node:assert/strict');
const A=require('./formal-collection.cjs'),AR=require('./formal-artifact.cjs'),V=require('./verify-formal-infrastructure.cjs');
async function currentReceipts(){const origin=A.runOrigin(),api='https://api.github.com/repos/'+origin.repository,headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',Authorization:'Bearer '+process.env.GITHUB_TOKEN};
 const r=await fetch(api+'/actions/runs/'+origin.runId+'/artifacts?per_page=100',{headers,signal:AbortSignal.timeout(25000)});assert.equal(r.status,200);const list=(await r.json()).artifacts;
 return ['formal-dev-plan',...Array.from({length:4},(_,i)=>'formal-dev-shard-'+i)].map(name=>{const artifact=list.find(a=>a.name===name);assert.ok(artifact);return {repository:origin.repository,runId:origin.runId,attempt:origin.attempt,headSha:origin.headSha,artifactId:artifact.id,name,digest:artifact.digest};});}
async function verify(directory){assert.ok(!fs.existsSync(directory));const proof=require('./formal-resume-proof-spec.json');
 const receipts=proof.receipts.length?proof.receipts:await currentReceipts();assert.equal(receipts.length,5);assert.equal(new Set(receipts.map(r=>r.name)).size,5);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bao-plan-restore-'));let plan;
 try{const receipt=receipts.find(r=>r.name==='formal-dev-plan');assert.ok(receipt);const bytes=await AR.downloadPinned(receipt),zip=path.join(root,'plan.zip'),stage=path.join(root,'plan');
  assert.equal('sha256:'+A.shaBytes(bytes),receipt.digest);fs.writeFileSync(zip,bytes);const result=cp.spawnSync('python3',[path.join(__dirname,'safe-artifact-unzip.py'),zip,stage,'plan']);assert.equal(result.status,0);
  const registry=require('./formal-development-exclusions.json');plan=A.loadPlan(path.join(stage,'plan.sealed.json'),V.DEVELOPMENT_KEY,registry);assert.equal(plan.config.namespace,A.development.namespace);
  fs.mkdirSync(directory,{recursive:true});fs.copyFileSync(path.join(stage,'plan.sealed.json'),path.join(directory,'plan.sealed.json'));
  for(let shard=0;shard<4;shard++){const receipt=receipts.find(r=>r.name==='formal-dev-shard-'+shard);assert.ok(receipt);const bytes=await AR.downloadPinned(receipt);
   AR.restoreArchive(bytes,receipt,path.join(directory,'shard-'+shard),plan,registry,V.DEVELOPMENT_KEY);}
  const reused=V.verifyRestored(directory);assert.equal(reused.newTeacherRequests,0);const current=A.runOrigin();
  const report={...reused,proofScope:proof.receipts.length?'pinned-previous-run':'same-run-separate-worker',currentRunId:current.runId,currentAttempt:current.attempt,
   restoredRunIds:[...new Set(receipts.map(r=>r.runId))],receipts,planDigest:plan.digest};A.atomic(path.join(directory,'formal-artifact-resume-verification.json'),report);return report;
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
if(require.main===module)verify(process.argv[2]).then(r=>console.log(JSON.stringify(r,null,2))).catch(()=>{console.error('Development artifact resume proof failed; no payload logged');process.exitCode=1;});
module.exports={verify,currentReceipts};
