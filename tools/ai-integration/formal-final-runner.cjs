"use strict";
// MIT. Manual final worker. Fixed candidate only; no training or alternative evaluation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),os=require('node:os'),crypto=require('node:crypto');
const F=require('./formal-final.cjs'),A=require('./formal-collection.cjs'),D=require('./formal-learning-data.cjs');
const B=require('./formal-learning-artifact.cjs'),V=require('./formal-learning-validation.cjs'),M=require('./formal-learning-evaluator.cjs');
const spec=F.spec,root=path.resolve(__dirname,'../..'),resultRef='refs/heads/nyakua-final-result-'+spec.finalRowsDigest;
const sources=['tools/ai-integration/formal-final-runner.cjs','tools/ai-integration/formal-final-unzip.py','.github/workflows/formal-final.yml'];
function fingerprint(){return A.hash({preparation:F.fingerprint(),sources:Object.fromEntries(sources.map(p=>[p,A.shaBytes(fs.readFileSync(path.join(root,p)))]))});}
function apiClient({fetchImpl=fetch,token=process.env.GITHUB_TOKEN}={}){
 assert.ok(typeof token==='string'&&token.length>0);const base='https://api.github.com/repos/'+spec.opening.repository;
 const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json',Authorization:'Bearer '+token};
 return async(endpoint,method='GET',body,allowMissing=false)=>{const response=await fetchImpl(base+endpoint,{method,headers,redirect:'error',signal:AbortSignal.timeout(25000),
  ...(body===undefined?{}:{body:JSON.stringify(body)})});if(allowMissing&&response.status===404)return null;
  assert.equal(response.status,method==='GET'?200:201,'Git API operation failed');return response.json();};
}
function context(env=process.env){
 F.preflight();assert.equal(env.GITHUB_EVENT_NAME,'workflow_dispatch');assert.equal(env.GITHUB_REF,'refs/heads/main');
 assert.equal(env.GITHUB_REPOSITORY,spec.opening.repository);assert.equal(env.GITHUB_RUN_ATTEMPT,'1');
 assert.equal(env.BAO_FINAL_AUTHORIZATION,'OPEN-FROZEN-FINAL-ONCE');assert.ok(/^[a-f0-9]{40}$/.test(env.GITHUB_SHA));
 assert.equal(env.BAO_FINAL_EXPECTED_HEAD,env.GITHUB_SHA);assert.equal(env.BAO_FINAL_EXPECTED_FINGERPRINT,fingerprint());
 const origin={repository:env.GITHUB_REPOSITORY,runId:Number(env.GITHUB_RUN_ID),attempt:1,headSha:env.GITHUB_SHA};
 const authorization={schema:1,specId:spec.id,authorizedToOpenOnce:true,fingerprint:F.fingerprint(),runnerFingerprint:fingerprint(),
  modelSha256:spec.candidate.modelSha256,finalRowsDigest:spec.finalRowsDigest,headSha:origin.headSha,origin,
  frozenAtJST:new Date().toLocaleString('sv-SE',{timeZone:'Asia/Tokyo'}).replace(' ','T')+'+09:00'};
 F.checkAuthorization(authorization,origin);return {origin,authorization};
}
function checkKey(text){
 assert.ok(typeof text==='string'&&/^[A-Za-z0-9+/]{43}=$/.test(text),'Collection key missing or malformed');
 const key=Buffer.from(text,'base64');assert.equal(key.length,32);assert.equal(key.toString('base64'),text);return key;
}
function pythonEnvironment(){
 const proc=cp.spawnSync('python3',['-c','import platform,numpy,json;print(json.dumps({"python":platform.python_version(),"numpy":numpy.__version__}))'],{encoding:'utf8'});
 assert.equal(proc.status,0,'Python environment unavailable');return JSON.parse(proc.stdout);
}
async function restoreCiphertext(directory,{fetchImpl=fetch,token=process.env.GITHUB_TOKEN}={}){
 assert.ok(!fs.existsSync(directory));const r=spec.collection,api='https://api.github.com/repos/'+r.repository;
 const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};if(token)headers.Authorization='Bearer '+token;
 const get=async endpoint=>{const response=await fetchImpl(api+endpoint,{headers,redirect:'error',signal:AbortSignal.timeout(25000)});assert.equal(response.status,200);return response.json();};
 const [run,artifact]=await Promise.all([get('/actions/runs/'+r.runId+'/attempts/'+r.attempt),get('/actions/artifacts/'+r.artifactId)]);B.checkMetadata(run,artifact);
 const redirect=await fetchImpl(api+'/actions/artifacts/'+r.artifactId+'/zip',{headers,redirect:'manual',signal:AbortSignal.timeout(25000)});assert.equal(redirect.status,302);
 const url=new URL(redirect.headers.get('location'));assert.equal(url.protocol,'https:');
 const response=await fetchImpl(url.toString(),{redirect:'error',signal:AbortSignal.timeout(25000)});assert.equal(response.status,200);
 const data=Buffer.from(await response.arrayBuffer());assert.equal(data.length,artifact.size_in_bytes);assert.equal('sha256:'+A.shaBytes(data),r.digest);
 fs.mkdirSync(directory,{recursive:true,mode:0o700});const archive=path.join(directory,'dataset.zip');fs.writeFileSync(archive,data,{mode:0o600});
 const extracted=path.join(directory,'ciphertext'),proc=cp.spawnSync('python3',[path.join(__dirname,'formal-final-unzip.py'),archive,extracted],{encoding:'utf8'});
 assert.equal(proc.status,0,'Ciphertext archive restore failed');const summary=D.checkSummary(A.read(path.join(extracted,'collection-summary.json')));
 assert.equal(summary.final.digest,spec.finalRowsDigest);const sealed=fs.readFileSync(path.join(extracted,'final.sealed.json'));
 assert.equal(A.shaBytes(sealed),r.finalCiphertextSha256);return {envelope:JSON.parse(sealed),artifact};
}
function evaluateRows(rows,directory){
 const modelFile=path.join(root,spec.candidate.directory,'model.json'),modelBytes=fs.readFileSync(modelFile);
 assert.equal(A.shaBytes(modelBytes),spec.candidate.modelSha256);const model=M.validateModel(JSON.parse(modelBytes));
 const predictions=rows.map(r=>M.evaluateInputs(model,r.input,r.opponentInput)),viewsFile=path.join(directory,'views.json');
 A.atomic(viewsFile,rows.map(r=>({input:r.input,opponentInput:r.opponentInput})));
 let expected;try{const proc=cp.spawnSync('python3',[path.join(__dirname,'formal-learning-predict.py'),modelFile,viewsFile],{encoding:'utf8',maxBuffer:8*1024*1024});
  assert.equal(proc.status,0,'Independent Python inference failed');expected=JSON.parse(proc.stdout);
 }finally{fs.unlinkSync(viewsFile);}
 assert.equal(expected.length,predictions.length);assert.ok(expected.every(Number.isSafeInteger));
 const mismatches=expected.filter((p,i)=>p!==predictions[i]).length;
 V.checkStatePredictions(M.createEvaluator(model),rows,predictions);
 const baseline=V.metrics(rows,rows.map(r=>Math.trunc(r.baseline*D.spec.targetScale))),metrics=V.metrics(rows,predictions),microseconds=V.timing(model,rows);
 const gate=F.finalGate(metrics,baseline,{bytes:modelBytes.length,microseconds,mismatches});
 return {...gate,baseline,metrics,bytes:modelBytes.length,microseconds,pythonNodeIntegerComparisons:rows.length,integerMismatches:mismatches,
  antisymmetryComparisons:rows.length,environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,
   ...pythonEnvironment()}};
}
const keys=(object,expected)=>assert.deepEqual(Object.keys(object).sort(),[...expected].sort());
const reportBytes=report=>Buffer.from(JSON.stringify(report)+'\n');
const blobSha=value=>{const b=reportBytes(value);return crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');};
function checkPublicRecords(records){
 assert.deepEqual(Object.keys(records).sort(),['authorization','claim','report']);const {authorization,claim,report}=records;
 keys(authorization,['schema','specId','authorizedToOpenOnce','fingerprint','runnerFingerprint','modelSha256','finalRowsDigest','headSha','origin','frozenAtJST']);
 keys(authorization.origin,['repository','runId','attempt','headSha']);
 F.checkAuthorization(authorization,authorization.origin);assert.equal(authorization.runnerFingerprint,fingerprint());
 const expected=F.checkAuthorization(authorization,authorization.origin);for(const [k,v] of Object.entries(expected))assert.deepEqual(claim[k],v);
 keys(claim,[...Object.keys(expected),'claimRef','claimObjectSha']);
 assert.equal(claim.claimRef,spec.opening.claimRef);assert.ok(/^[a-f0-9]{40}$/.test(claim.claimObjectSha));
 assert.equal(report.schema,1);assert.equal(report.specId,spec.id);assert.equal(report.runnerFingerprint,fingerprint());
 assert.deepEqual(report.origin,authorization.origin);assert.equal(report.modelSha256,spec.candidate.modelSha256);
 assert.equal(report.finalRowsDigest,spec.finalRowsDigest);assert.equal(report.authorizationDigest,A.hash(authorization));
 assert.equal(report.claimObjectSha,claim.claimObjectSha);assert.equal(report.publicAdopted,false);
 assert.equal(report.preparationFingerprint,F.fingerprint());assert.equal(report.learningFingerprint,spec.learningFingerprint);
 assert.deepEqual(report.collectionArtifact,{id:spec.collection.artifactId,digest:spec.collection.digest});
 assert.equal(report.decryptionAttempted,true);assert.equal(typeof report.finalOpened,'boolean');
 assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/.test(report.completedAtJST));
 assert.ok([spec.decision.passed,spec.decision.failed,'HOLD-FINAL-EXECUTION-ERROR'].includes(report.status));
 // Strict public schema prevents state/input/target/prediction arrays or a key from escaping.
 const allowed=['schema','specId','runnerFingerprint','preparationFingerprint','learningFingerprint','origin','modelSha256','finalRowsDigest',
  'authorizationDigest','claimObjectSha','collectionArtifact','status','passed','criteria','baseline','metrics','bytes','microseconds',
  'pythonNodeIntegerComparisons','integerMismatches','antisymmetryComparisons','environment','alternativeCandidateEvaluation','retuning',
  'publicAdopted','finalOpened','decryptionAttempted','failureStage','completedAtJST'];
 assert.ok(Object.keys(report).every(k=>allowed.includes(k)));assert.equal(report.retuning,false);assert.equal(report.alternativeCandidateEvaluation,false);
 for(const metric of [report.baseline,report.metrics].filter(Boolean)){
  assert.deepEqual(Object.keys(metric).sort(),['groupMse','groups','mae','mse','rows','strata']);
  assert.deepEqual(Object.keys(metric.strata).sort(),[...spec.criteria.strata].sort());
  assert.ok(Number.isSafeInteger(metric.rows)&&metric.rows>0);assert.ok(Number.isSafeInteger(metric.groups)&&metric.groups>0);
  for(const name of ['mae','mse','groupMse'])assert.ok(Number.isFinite(metric[name]));
  for(const value of Object.values(metric.strata)){keys(value,['mae','mse','rows']);assert.ok(Number.isSafeInteger(value.rows)&&value.rows>=0);
   for(const name of ['mae','mse'])assert.ok(value[name]===null||Number.isFinite(value[name]));}
 }
 if(report.status==='HOLD-FINAL-EXECUTION-ERROR'){
  assert.equal(report.passed,false);assert.ok(['decrypt','normalize','evaluate'].includes(report.failureStage));
  for(const k of ['metrics','baseline','environment','criteria'])assert.equal(report[k],undefined);
 }else{
  assert.equal(report.finalOpened,true);assert.equal(report.failureStage,undefined);
  assert.equal(report.bytes,fs.statSync(path.join(root,spec.candidate.directory,'model.json')).size);
  assert.ok(Number.isFinite(report.microseconds)&&report.microseconds>=0);
  assert.ok(Number.isSafeInteger(report.integerMismatches)&&report.integerMismatches>=0);
  assert.equal(report.baseline.rows,report.metrics.rows);assert.equal(report.baseline.groups,report.metrics.groups);
  assert.ok(report.metrics.rows>=spec.minimumRows);assert.ok(report.metrics.groups>=spec.minimumOpeningGroups);
  const gate=F.finalGate(report.metrics,report.baseline,{bytes:report.bytes,microseconds:report.microseconds,mismatches:report.integerMismatches});
  for(const [k,v] of Object.entries(gate))assert.deepEqual(report[k],v);
  assert.equal(report.pythonNodeIntegerComparisons,report.metrics.rows);assert.equal(report.antisymmetryComparisons,report.metrics.rows);
  keys(report.environment,['node','platform','arch','cpu','python','numpy']);
  assert.equal(report.environment.python,D.spec.training.python);assert.equal(report.environment.numpy,D.spec.training.numpy);
  for(const value of Object.values(report.environment))assert.ok(typeof value==='string'&&value.length<=200);
 }
 return records;
}
async function publish(records,{fetchImpl=fetch,token=process.env.GITHUB_TOKEN}={}){
 checkPublicRecords(records);const api=apiClient({fetchImpl,token}),claim=await api('/git/ref/'+spec.opening.claimRef.slice(5));
 assert.equal(claim.object.sha,records.claim.claimObjectSha);assert.equal(claim.object.type,'tag');
 const object=await api('/git/tags/'+claim.object.sha);assert.deepEqual(JSON.parse(object.message),F.checkAuthorization(records.authorization,records.authorization.origin));
 assert.equal(object.object.sha,records.report.origin.headSha);assert.equal(object.object.type,'commit');
 const existing=async()=>{
  const ref=await api('/git/ref/'+resultRef.slice(5),'GET',undefined,true);if(!ref)return null;
  const commit=await api('/git/commits/'+ref.object.sha),tree=await api('/git/trees/'+commit.tree.sha+'?recursive=1');
  assert.equal(tree.truncated,false);for(const [name,value] of Object.entries(records)){
   const entry=tree.tree.find(e=>e.path==='doc/formal-final/'+name+'.json');assert.ok(entry);assert.equal(entry.sha,blobSha(value));}
  return {resultRef,resultCommitSha:ref.object.sha,reportSha256:A.shaBytes(reportBytes(records.report))};
 };
 const previous=await existing();if(previous)return previous;
 const base=await api('/git/commits/'+records.report.origin.headSha);const entries=[];
 for(const [name,value] of Object.entries(records)){
  const blob=await api('/git/blobs','POST',{content:JSON.stringify(value)+'\n',encoding:'utf-8'});
  assert.ok(/^[a-f0-9]{40}$/.test(blob.sha));entries.push({path:'doc/formal-final/'+name+'.json',mode:'100644',type:'blob',sha:blob.sha});
 }
 const tree=await api('/git/trees','POST',{base_tree:base.tree.sha,tree:entries});assert.ok(/^[a-f0-9]{40}$/.test(tree.sha));
 const commit=await api('/git/commits','POST',{message:'Record one-time final evaluation; no model or rule changes',tree:tree.sha,parents:[records.report.origin.headSha]});
 assert.ok(/^[a-f0-9]{40}$/.test(commit.sha));
 // New immutable result branch only. Never mutate main, claim or an existing result.
 let ref;try{ref=await api('/git/refs','POST',{ref:resultRef,sha:commit.sha});}
 catch{const saved=await existing();if(saved)return saved;throw Error('Result publication unavailable; preserve local public report');}
 assert.equal(ref.object.sha,commit.sha);assert.equal(ref.ref,resultRef);
 return {resultRef,resultCommitSha:commit.sha,reportSha256:A.shaBytes(Buffer.from(JSON.stringify(records.report)+'\n'))};
}
async function run(directory,{env=process.env,fetchImpl=fetch}={}){
 const {origin,authorization}=context(env),runtime=pythonEnvironment();assert.equal(runtime.python,D.spec.training.python);assert.equal(runtime.numpy,D.spec.training.numpy);
 assert.ok(process.version.startsWith('v24.'));const key=checkKey(env.BAO_COLLECTION_KEY_BASE64);assert.ok(!fs.existsSync(directory));
 let restored;try{restored=await restoreCiphertext(path.join(directory,'private'),{fetchImpl,token:env.GITHUB_TOKEN});}
 catch{key.fill(0);fs.rmSync(path.join(directory,'private'),{recursive:true,force:true});throw Error('Pinned restoration failed before final claim');}
 const publicDir=path.join(directory,'public');
 let claim,report,decryptionAttempted=false,finalOpened=false,stage='claim';
 try{
  stage='authorization';A.atomic(path.join(publicDir,'authorization.json'),authorization);stage='claim';
  claim=await F.reserveOpening(authorization,origin,{fetchImpl,token:env.GITHUB_TOKEN});A.atomic(path.join(publicDir,'claim.json'),claim);
  stage='decrypt';decryptionAttempted=true;
  const raw=A.decrypt(restored.envelope,key,{purpose:'final-holdout',planDigest:spec.collection.planDigest,auditDigest:spec.collection.auditDigest});finalOpened=true;
  stage='normalize';const rows=F.normalizeFinal(raw);stage='evaluate';report=evaluateRows(rows,path.join(directory,'private'));
 }catch{
  if(!claim)throw Error('Final claim unavailable; no authorized decryption');
  report={status:'HOLD-FINAL-EXECUTION-ERROR',passed:false,failureStage:stage,retuning:false,alternativeCandidateEvaluation:false,publicAdopted:false};
 }finally{key.fill(0);fs.rmSync(path.join(directory,'private'),{recursive:true,force:true});}
 report={schema:1,specId:spec.id,runnerFingerprint:fingerprint(),preparationFingerprint:F.fingerprint(),learningFingerprint:spec.learningFingerprint,
  origin,modelSha256:spec.candidate.modelSha256,finalRowsDigest:spec.finalRowsDigest,authorizationDigest:A.hash(authorization),claimObjectSha:claim.claimObjectSha,
  collectionArtifact:{id:spec.collection.artifactId,digest:spec.collection.digest},...report,finalOpened,decryptionAttempted,
  completedAtJST:new Date().toLocaleString('sv-SE',{timeZone:'Asia/Tokyo'}).replace(' ','T')+'+09:00'};
 A.atomic(path.join(publicDir,'report.json'),report);const persisted=await publish({authorization,claim,report},{fetchImpl,token:env.GITHUB_TOKEN});
 A.atomic(path.join(publicDir,'publication.json'),persisted);
 return {status:report.status,passed:report.passed,finalOpened,publicAdopted:false,...persisted};
}
if(require.main===module){const [command,directory]=process.argv.slice(2);
 const task=command==='run'?run(directory):command==='publish'?publish(Object.fromEntries(['authorization','claim','report'].map(k=>[k,A.read(path.join(directory,k+'.json'))]))):
  command==='preflight'?Promise.resolve({preparation:F.preflight(),runnerFingerprint:fingerprint(),resultRef}):Promise.reject(Error('Command'));
 task.then(result=>{console.log(JSON.stringify(result));if(result.status==='HOLD-FINAL-EXECUTION-ERROR')process.exitCode=1;})
 .catch(()=>{console.error('Final worker stopped; never reopen automatically; public records only');process.exitCode=1;});
}
module.exports={fingerprint,resultRef,context,checkKey,pythonEnvironment,restoreCiphertext,evaluateRows,checkPublicRecords,publish,run,blobSha};
