"use strict";
// MIT. Fixed collection, authenticated checkpoints, global audit and sealed final data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),os=require('node:os');
const P=require('./learning-pipeline.cjs'),I=require('./learning-input.cjs'),R=require('./formal-registry.cjs'),T=require('./teacher-feasibility.cjs');
const E=require('../../prototype/next-turn-engine.js'),Q=require('../../prototype/search-transition.js').createForEngine(E);
const S=require('../../prototype/steal.js').createForEngine(E),F=require('../../prototype/search-ai.js'),C=require('../nyakua-three/core.cjs');
const formal=require('./formal-collection-spec.json'),formalV2=require('./formal-collection-v2-spec.json'),development=require('./formal-development-spec.json'),hash=P.hash,clone=x=>JSON.parse(JSON.stringify(x));
const V2=require('./formal-selection-v2.cjs'),isFormal=c=>c.namespace!==development.namespace;
const shaBytes=b=>crypto.createHash('sha256').update(b).digest('hex');
function configCheck(c){
 assert.ok([formal,formalV2,development].some(registered=>JSON.stringify(c)===JSON.stringify(registered)),'Unregistered collection configuration');
 assert.equal(c.shards*c.maximumRequestsPerShard,c.maximumTeacherRequests);assert.equal(c.openingPlies,P.spec.pilot.openingPlies);
 assert.equal(c.maxTrajectoryPlies,P.spec.pilot.maxPlies);assert.equal(c.inputSize,I.INPUT_SIZE);assert.deepEqual(c.policies,P.spec.pilot.policies);return c;
}
function sources(){const extra=['formal-registry.cjs','formal-collection.cjs','formal-collection.test.cjs','formal-artifact.cjs',
 'formal-development-spec.json','formal-workflow.cjs','formal-collection-spec.json','verify-formal-infrastructure.cjs','safe-artifact-unzip.py',
 'formal-collection-v2-spec.json','formal-selection-v2.cjs','formal-selection-v2.test.cjs','verify-formal-selection-v2.cjs'];
 return {...T.sourceHashes(),...R.sourceHashes(),...Object.fromEntries(extra.map(p=>['tools/ai-integration/'+p,hash(fs.readFileSync(path.join(__dirname,p),'utf8'))]))};}
function splitFor(group,c){const n=parseInt(hash([c.split.salt,c.split.partitionNamespace||c.namespace,group]).slice(0,8),16)%100;return n<c.split.trainBelow?'train':n<c.split.validationBelow?'validation':'final';}
function replay(row,c){
 assert.ok(c.policies.includes(row.policy));assert.ok(Number.isSafeInteger(row.seedIndex)&&row.seedIndex>=c.seedStartIndex&&row.seedIndex<c.seedStartIndex+c.seedCount);
 assert.equal(row.seed,C.seedAt(row.seedIndex));assert.equal(row.unitId,row.policy+'-'+row.seedIndex);assert.equal(row.first,row.seedIndex%2);
 assert.equal(row.moves.length,row.ply);assert.ok(row.ply>=c.openingPlies&&row.ply<=c.maxTrajectoryPlies);
 let g=S.initialGame();g.board.player=row.first;const prefix=[g.board];
 for(const m of row.moves){g=S.apply({board:g.board,history:[]},m);if(prefix.length<=c.openingPlies)prefix.push(g.board);}
 assert.equal(prefix.length,c.openingPlies+1);assert.equal(row.group,hash(prefix.map(I.positionKey)));
 assert.deepEqual(g.board,row.state,'Normal replay');I.validate(row.state);assert.deepEqual(I.encode(row.state),row.input);
 assert.equal(row.id,hash(I.positionKey(row.state)));assert.equal(row.inputHash,hash(row.input));assert.equal(row.split,splitFor(row.group,c));return row;
}
function roundRobin(rows){const groups=new Map();for(const r of rows){if(!groups.has(r.group))groups.set(r.group,[]);groups.get(r.group).push(r);}
 const buckets=[...groups].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,v])=>v.sort((a,b)=>a.unitId<b.unitId?-1:a.unitId>b.unitId?1:a.ply-b.ply));
 const ordered=[];for(let i=0;buckets.some(v=>i<v.length);i++)for(const bucket of buckets)if(bucket[i])ordered.push(bucket[i]);return ordered;}
function candidateAudit(rows,registry,c,{onEligible}={}){
 const groups=new Set(registry.openingGroups),known=new Set(registry.positionHashes),knownInputs=new Set(registry.inputHashes);
 // Quarantine across the entire candidate universe before exclusion and request cap.
 const partitions=new Map();for(const r of rows)for(const k of [r.id,r.inputHash]){if(!partitions.has(k))partitions.set(k,new Set());partitions.get(k).add(r.split);}
 const seen=new Set(),kept=[],counts={crossSplitCopies:0,knownPositions:0,knownOpenings:0,withinSplitCopies:0};
 for(const r of roundRobin(rows)){
  if(partitions.get(r.id).size>1||partitions.get(r.inputHash).size>1){counts.crossSplitCopies++;continue;}
  if(c.namespace!==development.namespace&&r.split!=='train'&&groups.has(r.group)){counts.knownOpenings++;continue;}
  if(c.namespace!==development.namespace&&r.split!=='train'&&(known.has(r.id)||knownInputs.has(r.inputHash))){counts.knownPositions++;continue;}
  if(seen.has(r.id)||seen.has(r.inputHash)){counts.withinSplitCopies++;continue;}seen.add(r.id);seen.add(r.inputHash);kept.push(r);
 }
 if(onEligible)onEligible(kept);
 const selected=c.selection?.version===2?V2.select(kept,c,roundRobin):kept.slice(0,c.maximumTeacherRequests);
 return {rows:selected,counts:{...counts,candidates:rows.length,eligible:kept.length,capOmitted:kept.length-selected.length}};
}
function prepare(registry,c=formal,{onProgress,onEligible}={}){
 configCheck(c);R.validateRegistry(registry);const candidates=[];let shortOpenings=0;const cutoffs={};
 for(const policy of c.policies)for(let i=0;i<c.seedCount;i++){
  const seedIndex=c.seedStartIndex+i,t=P.trajectory(policy,seedIndex),prefix=t.states.slice(0,c.openingPlies+1);
  cutoffs[t.cutoff||'normal-terminal']=(cutoffs[t.cutoff||'normal-terminal']||0)+1;
  if(prefix.length!==c.openingPlies+1||prefix.some(s=>Q.outcome(s)!=='ongoing')){shortOpenings++;continue;}
  const group=hash(prefix.map(I.positionKey)),plies=new Set(c.candidatePlies);
  plies.add(t.states.findLastIndex(s=>Q.outcome(s)==='ongoing'));
  for(const tag of ['reservedOnly','twoPlacement','threePlacement','lastOrdinary','nearTransition']){
   const ply=t.states.findIndex((s,p)=>p>=c.openingPlies&&Q.outcome(s)==='ongoing'&&T.tags(s)[tag]);if(ply>=0)plies.add(ply);
  }
  const valid=[...plies].filter(p=>p>=c.openingPlies&&t.states[p]&&Q.outcome(t.states[p])==='ongoing').sort((a,b)=>a-b);
  const moves=[];for(let p=0;p<(valid.at(-1)||0);p++){
   const next=Q.stateKey(t.states[p+1]),m=Q.moveVariants(t.states[p]).find(m=>Q.stateKey(Q.applyMove(t.states[p],m).state)===next);
   assert.ok(m,'Missing trajectory move');moves.push(m);
  }
  for(const ply of valid){const state=t.states[ply],input=I.encode(state);
   candidates.push({id:hash(I.positionKey(state)),inputHash:hash(input),unitId:policy+'-'+seedIndex,policy,seedIndex,seed:t.seed,first:seedIndex%2,ply,
    group,split:splitFor(group,c),state:clone(state),input,moves:moves.slice(0,ply)});
  }
  if(onProgress&&(i%256===255||i===c.seedCount-1))onProgress({policy,pathsCompleted:i+1,pathsPerPolicy:c.seedCount});
 }
 const a=candidateAudit(candidates,registry,c,{onEligible});for(const r of a.rows)replay(r,c);
 const payload={schema:1,config:c,sources:sources(),registryDigest:registry.digest,selection:{...a.counts,shortOpenings,cutoffs},rows:a.rows};
 return {...payload,digest:hash(payload)};
}
function candidateGates(plan){const c=plan.config,result={};
 for(const split of ['train','validation','final']){const rows=plan.rows.filter(r=>r.split===split),coverage=T.coverage(rows),groups=new Set(rows.map(r=>r.group)).size;
  const missing=Object.keys(c.minimumCoverage[split]).filter(k=>coverage[k]<c.minimumCoverage[split][k]);
  result[split]={rows:rows.length,groups,coverage,missingCoverage:missing,passed:rows.length>=c.minimumAcceptedRows[split]&&groups>=c.minimumOpeningGroups[split]&&missing.length===0};}
 return {status:Object.values(result).every(v=>v.passed)?'CANDIDATES-SUFFICIENT-FOR-TEACHER':'HOLD-BEFORE-TEACHER',
  requested:plan.rows.length,planDigest:plan.digest,registryDigest:plan.registryDigest,sourceDigest:hash(plan.sources),selection:plan.selection,
  train:result.train,validation:result.validation,final:{requirementsPassed:result.final.passed},teacherRequestsExecuted:0};
}
function validatePlan(plan,registry){const {digest,...payload}=plan;assert.equal(digest,hash(payload),'Plan checksum');configCheck(plan.config);
 assert.deepEqual(plan.sources,sources(),'Plan sources');R.validateRegistry(registry);assert.equal(plan.registryDigest,registry.digest);
 assert.ok(plan.rows.length<=plan.config.maximumTeacherRequests);for(const row of plan.rows)replay(row,plan.config);
 const a=candidateAudit(plan.rows,registry,plan.config);assert.equal(a.rows.length,plan.rows.length,'Plan leakage or duplicate');return plan;
}
function keyCheck(key){assert.ok(Buffer.isBuffer(key)&&key.length===32,'A separate 32-byte collection key is required');return key;}
function encrypt(value,key,binding){keyCheck(key);const iv=crypto.randomBytes(12),aad=Buffer.from(JSON.stringify(binding));
 const cipher=crypto.createCipheriv('aes-256-gcm',key,iv,{authTagLength:16});cipher.setAAD(aad);
 const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
 return {schema:1,algorithm:'aes-256-gcm',binding,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')};}
function decrypt(envelope,key,binding){keyCheck(key);assert.equal(envelope.schema,1);assert.equal(envelope.algorithm,'aes-256-gcm');assert.deepEqual(envelope.binding,binding);
 const iv=Buffer.from(envelope.iv,'base64'),tag=Buffer.from(envelope.tag,'base64');assert.equal(iv.length,12);assert.equal(tag.length,16);
 const decipher=crypto.createDecipheriv('aes-256-gcm',key,iv,{authTagLength:16});decipher.setAAD(Buffer.from(JSON.stringify(binding)));decipher.setAuthTag(tag);
 const data=Buffer.concat([decipher.update(Buffer.from(envelope.data,'base64')),decipher.final()]);return JSON.parse(data.toString('utf8'));}
function atomic(file,value){fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});const temp=file+'.tmp';
 fs.writeFileSync(temp,JSON.stringify(value)+'\n',{mode:0o600});fs.renameSync(temp,file);}
function read(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function planBinding(){return {purpose:'collection-plan',schema:1};}
function savePlan(file,plan,key){if(fs.existsSync(file)){const old=decrypt(read(file),key,planBinding());assert.equal(old.digest,plan.digest,'Existing frozen plan differs');return;}atomic(file,encrypt(plan,key,planBinding()));}
function loadPlan(file,key,registry){return validatePlan(decrypt(read(file),key,planBinding()),registry);}
function runOrigin(){return process.env.GITHUB_RUN_ID?{repository:process.env.GITHUB_REPOSITORY,runId:Number(process.env.GITHUB_RUN_ID),attempt:Number(process.env.GITHUB_RUN_ATTEMPT),headSha:process.env.BAO_COLLECTION_HEAD_SHA||process.env.GITHUB_SHA}
 :{repository:'local-development',runId:0,attempt:1,headSha:'local-development'};}
function originCheck(o,c){assert.ok(o&&Number.isSafeInteger(o.runId)&&o.runId>=0&&Number.isSafeInteger(o.attempt)&&o.attempt>=1);
 if(isFormal(c)){assert.equal(o.repository,'nkkmd/bao-nakakamado');assert.ok(o.runId>0&&/^[a-f0-9]{40}$/.test(o.headSha),'Formal collection needs recorded Actions provenance');}}
function measurementBinding(plan,index){return {purpose:'teacher-checkpoint',planDigest:plan.digest,index};}
function checkMeasurement(m,row,c){assert.equal(m.id,row.id);assert.deepEqual(m.label,P.labelFor(row.state,m.result,c.teacher));
 assert.ok(Q.moveVariants(row.state).some(move=>F.moveKey(move)===F.moveKey(m.result.move)),'Illegal teacher move');
 assert.ok(Number.isFinite(m.result.stats.elapsedMs)&&m.result.stats.elapsedMs>=0);originCheck(m.origin,c);}
function runShard(root,plan,registry,key,shard,{analyze,origin=runOrigin(),maximumNew=Infinity}={}){
 validatePlan(plan,registry);keyCheck(key);const c=plan.config;originCheck(origin,c);assert.ok(Number.isInteger(shard)&&shard>=0&&shard<c.shards);
 if(isFormal(c)){assert.equal(analyze,undefined,'Formal teacher must use the real clock');assert.equal(candidateGates(plan).status,'CANDIDATES-SUFFICIENT-FOR-TEACHER','Candidate plan is on HOLD');}
 const directory=path.join(root,'shard-'+shard),manifestFile=path.join(directory,'manifest.json');
 const binding={schema:1,planDigest:plan.digest,sourceDigest:hash(plan.sources),registryDigest:registry.digest,shard,shards:c.shards};
 const indexes=plan.rows.map((_,i)=>i).filter(i=>i%c.shards===shard);assert.ok(indexes.length<=c.maximumRequestsPerShard);
 if(fs.existsSync(manifestFile)){const old=read(manifestFile);assert.deepEqual(old.binding,binding);assert.deepEqual(old.indexes,indexes);}
 for(const index of indexes){const saved=path.join(directory,'request-'+index+'.sealed.json');if(fs.existsSync(saved))checkMeasurement(decrypt(read(saved),key,measurementBinding(plan,index)),plan.rows[index],c);}
 let reused=0,generated=0;const complete=[];const ai=analyze||F.createAI(Q).analyzeMove;
 const manifest=()=>({binding,indexes,completed:complete,origin,reused,generated});atomic(manifestFile,manifest());
 for(const index of indexes){const row=plan.rows[index],file=path.join(directory,'request-'+index+'.sealed.json');let m;
  if(fs.existsSync(file)){m=decrypt(read(file),key,measurementBinding(plan,index));checkMeasurement(m,row,c);reused++;}
  else{if(generated>=maximumNew)break;const before=JSON.stringify(row.state),result=ai(row.state,c.teacher);
   assert.equal(JSON.stringify(row.state),before,'Teacher input changed');m={id:row.id,label:P.labelFor(row.state,result,c.teacher),result,environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model||'unrecorded',logicalCPUs:os.cpus().length},origin};
   checkMeasurement(m,row,c);atomic(file,encrypt(m,key,measurementBinding(plan,index)));generated++;
  }
  complete.push(index);atomic(manifestFile,manifest());
 }
 return {shard,requested:indexes.length,completed:complete.length,reused,generated,planDigest:plan.digest};
}
function capTerminal(rows,fraction){const ordinary=rows.filter(r=>r.measurement.label.kind!=='finite-depth-terminal-line').length;
 const limit=Math.floor(ordinary*fraction/(1-fraction));let terminal=0;return rows.filter(r=>r.measurement.label.kind!=='finite-depth-terminal-line'||terminal++<limit);}
function labelAudit(plan,measurements){const c=plan.config;assert.equal(measurements.length,plan.rows.length);
 const splits={},summary={},rejected={};let accepted=0;const inputOwners=new Map(),positionOwners=new Map();
 for(let i=0;i<plan.rows.length;i++){const row=plan.rows[i],m=measurements[i];checkMeasurement(m,row,c);if(m.label.accepted)accepted++;else rejected[m.label.reason]=(rejected[m.label.reason]||0)+1;}
 for(const split of ['train','validation','final']){
  const before=plan.rows.map((row,i)=>({...row,measurement:measurements[i]})).filter(r=>r.split===split&&r.measurement.label.accepted);
  const rows=capTerminal(before,c.maximumTerminalLineFractionPerSplit),coverage=T.coverage(rows),groups=new Set(rows.map(r=>r.group)).size;
  const missing=Object.keys(c.minimumCoverage[split]).filter(k=>coverage[k]<c.minimumCoverage[split][k]);
  for(const r of rows)for(const [owners,key] of [[inputOwners,r.inputHash],[positionOwners,r.id]]){assert.ok(!owners.has(key),'Post-audit duplicate input or position');owners.set(key,split);}
  const terminal=rows.filter(r=>r.measurement.label.kind==='finite-depth-terminal-line').length;assert.ok(terminal<=rows.length*c.maximumTerminalLineFractionPerSplit);
  splits[split]=rows;summary[split]={rows:rows.length,groups,coverage,terminalLines:terminal,capRemoved:before.length-rows.length,missingCoverage:missing,
   passed:rows.length>=c.minimumAcceptedRows[split]&&groups>=c.minimumOpeningGroups[split]&&missing.length===0,digest:hash(rows)};
 }
 const passed=plan.rows.length>0&&accepted/plan.rows.length>=c.minimumAcceptedFraction&&Object.values(summary).every(x=>x.passed);
 return {status:passed?'READY-FOR-TRAINING-DESIGN':'HOLD',splits,summary,accepted,requested:plan.rows.length,rejected,postAuditLeaks:0};
}
function aggregate(root,plan,registry,key,output){validatePlan(plan,registry);keyCheck(key);const measurements=Array(plan.rows.length),provenance=[];
 for(let shard=0;shard<plan.config.shards;shard++){
  const dir=path.join(root,'shard-'+shard),m=read(path.join(dir,'manifest.json')),indexes=plan.rows.map((_,i)=>i).filter(i=>i%plan.config.shards===shard);
  assert.deepEqual(m.binding,{schema:1,planDigest:plan.digest,sourceDigest:hash(plan.sources),registryDigest:registry.digest,shard,shards:plan.config.shards});
  assert.deepEqual(m.indexes,indexes);assert.deepEqual(m.completed,indexes,'Missing completed measurements');originCheck(m.origin,plan.config);provenance.push(m.origin);
  for(const index of indexes){measurements[index]=decrypt(read(path.join(dir,'request-'+index+'.sealed.json')),key,measurementBinding(plan,index));checkMeasurement(measurements[index],plan.rows[index],plan.config);}
 }
 const a=labelAudit(plan,measurements),auditDigest=hash({planDigest:plan.digest,summary:a.summary,accepted:a.accepted,rejected:a.rejected});
 const publicSummary={schema:1,configId:plan.config.id,namespace:plan.config.namespace,planDigest:plan.digest,registryDigest:registry.digest,sourceDigest:hash(plan.sources),
  status:a.status,requested:a.requested,accepted:a.accepted,rejected:a.rejected,postAuditLeaks:0,development:!isFormal(plan.config),
  train:a.summary.train,validation:a.summary.validation,final:{sealed:true,digest:a.summary.final.digest,requirementsPassed:a.summary.final.passed},auditDigest,provenance};
 if(output){fs.mkdirSync(output,{recursive:true});const sealFile=path.join(output,'final.sealed.json'),summaryFile=path.join(output,'collection-summary.json');
  if(fs.existsSync(summaryFile)){const old=read(summaryFile);assert.equal(old.auditDigest,auditDigest,'Existing sealed audit differs');assert.equal(old.planDigest,plan.digest);
   assert.equal(shaBytes(fs.readFileSync(sealFile)),old.final.ciphertextSha256);assert.deepEqual(decrypt(read(sealFile),key,{purpose:'final-holdout',planDigest:plan.digest,auditDigest}),a.splits.final);return old;}
  atomic(path.join(output,'audit.sealed.json'),encrypt(a.summary,key,{purpose:'private-audit',planDigest:plan.digest,auditDigest}));
  atomic(path.join(output,'train.json'),{planDigest:plan.digest,rows:a.splits.train});atomic(path.join(output,'validation.json'),{planDigest:plan.digest,rows:a.splits.validation});
  atomic(sealFile,encrypt(a.splits.final,key,{purpose:'final-holdout',planDigest:plan.digest,auditDigest}));
  publicSummary.final.ciphertextSha256=shaBytes(fs.readFileSync(sealFile));atomic(summaryFile,publicSummary);
 }
 return publicSummary;
}
function openFinal(directory,key,gate,modelFile,validationGateFile,output){
 const summary=read(path.join(directory,'collection-summary.json'));assert.equal(summary.status,'READY-FOR-TRAINING-DESIGN','Collection is on HOLD');
 assert.equal(gate.schema,1);assert.equal(gate.planDigest,summary.planDigest);assert.equal(gate.auditDigest,summary.auditDigest);
 assert.equal(gate.finalDigest,summary.final.digest);assert.equal(gate.modelSha256,shaBytes(fs.readFileSync(modelFile)),'Frozen model mismatch');
 assert.equal(gate.validationGateSha256,shaBytes(fs.readFileSync(validationGateFile)),'Validation gate mismatch');
 const criteria=read(validationGateFile);assert.equal(criteria.selectionFrozen,true);assert.equal(criteria.passed,true);
 assert.ok(Array.isArray(criteria.criteria)&&criteria.criteria.length>0&&criteria.criteria.every(c=>typeof c.metric==='string'&&Number.isFinite(c.threshold)&&Number.isFinite(c.observed)&&['<=','>='].includes(c.operator)
  &&(c.operator==='<='?c.observed<=c.threshold:c.observed>=c.threshold)),'Invalid validation criteria');
 assert.equal(gate.authorizedToOpenOnce,true);assert.ok(typeof gate.frozenAtJST==='string'&&/\+09:00$/.test(gate.frozenAtJST));
 const file=path.join(directory,'final.sealed.json');assert.equal(shaBytes(fs.readFileSync(file)),summary.final.ciphertextSha256);
 const rows=decrypt(read(file),key,{purpose:'final-holdout',planDigest:summary.planDigest,auditDigest:summary.auditDigest});assert.equal(hash(rows),summary.final.digest);
 assert.ok(!fs.existsSync(output),'Final output already exists');
 fs.writeFileSync(path.join(directory,'final-opened.json'),JSON.stringify({planDigest:summary.planDigest,gateDigest:hash(gate),openedAtJST:new Date().toLocaleString('sv-SE',{timeZone:'Asia/Tokyo'})+'+09:00'})+'\n',{flag:'wx',mode:0o600});
 fs.writeFileSync(output,JSON.stringify({planDigest:summary.planDigest,rows})+'\n',{flag:'wx',mode:0o600});return {opened:true,planDigest:summary.planDigest};
}
if(require.main===module){try{
 const [command,root,arg]=process.argv.slice(2),registry=R.validateRegistry(require('./formal-development-exclusions.json'));
 const key=keyCheck(fs.readFileSync(process.env.BAO_COLLECTION_KEY_FILE||''));
 if(command==='prepare'){const plan=prepare(registry);savePlan(root,plan,key);console.log(JSON.stringify({planDigest:plan.digest,requests:plan.rows.length,registryDigest:registry.digest}));}
 else if(command==='shard'){const plan=loadPlan(process.env.BAO_COLLECTION_PLAN_FILE,key,registry);console.log(JSON.stringify(runShard(root,plan,registry,key,Number(arg))));}
 else if(command==='aggregate'){const plan=loadPlan(process.env.BAO_COLLECTION_PLAN_FILE,key,registry);console.log(JSON.stringify(aggregate(root,plan,registry,key,arg)));}
 else if(command==='open'){console.log(JSON.stringify(openFinal(root,key,read(arg),process.env.BAO_FROZEN_MODEL_FILE,process.env.BAO_VALIDATION_GATE_FILE,process.env.BAO_FINAL_OUTPUT_FILE)));}
 else throw Error('Command');
}catch{console.error('Collection operation failed; no payload logged');process.exitCode=1;}}
module.exports={formal,formalV2,development,isFormal,hash,shaBytes,sources,configCheck,splitFor,replay,roundRobin,candidateAudit,prepare,candidateGates,validatePlan,encrypt,decrypt,atomic,read,savePlan,loadPlan,planBinding,runOrigin,measurementBinding,checkMeasurement,runShard,capTerminal,labelAudit,aggregate,openFinal};
