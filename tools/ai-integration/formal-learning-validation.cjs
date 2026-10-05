"use strict";
// MIT. Frozen validation gates on exported models. Never authorizes final opening.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),os=require('node:os');
const {performance}=require('node:perf_hooks'),D=require('./formal-learning-data.cjs'),M=require('./formal-learning-evaluator.cjs');
const A=require('./formal-collection.cjs'),spec=D.spec;
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
function metrics(rows,predictions){
 assert.ok(rows.length>0&&rows.length===predictions.length);assert.ok(predictions.every(p=>Number.isSafeInteger(p)&&Math.abs(p)<=spec.targetScale));
 const groups=new Map(),errors=rows.map((r,i)=>predictions[i]/spec.targetScale-r.target);
 rows.forEach((r,i)=>{if(!groups.has(r.group))groups.set(r.group,[]);groups.get(r.group).push(errors[i]**2);});
 const strata=Object.fromEntries(spec.selection.strata.map(tag=>{const e=errors.filter((_,i)=>rows[i].tags[tag]);
  return [tag,{rows:e.length,mae:e.length?mean(e.map(Math.abs)):null,mse:e.length?mean(e.map(x=>x*x)):null}];}));
 return {rows:rows.length,groups:groups.size,mae:mean(errors.map(Math.abs)),mse:mean(errors.map(x=>x*x)),groupMse:mean([...groups.values()].map(mean)),strata};
}
function gate(observed,baseline,{bytes,microseconds,mismatches}){
 const c=[],add=(metric,value,threshold)=>c.push({metric,observed:value,operator:'<=',threshold,
  passed:Number.isFinite(value)&&Number.isFinite(threshold)&&value<=threshold});
 add('opening-group-mean-mse',observed.groupMse,baseline.groupMse*spec.selection.maximumGroupMseRatioToBaseline);
 for(const phase of ['namua','mtaji'])add(phase+'-mse',observed.strata[phase].mse,baseline.strata[phase].mse*spec.selection.maximumPhaseMseRatioToBaseline);
 for(const tag of spec.selection.strata)add(tag+'-mae',observed.strata[tag].mae,baseline.strata[tag].mae+spec.selection.maximumStratumMaeIncrease);
 add('model-bytes',bytes,spec.selection.maximumBytes);add('median-microseconds',microseconds,spec.selection.maximumMedianMicroseconds);
 add('python-node-integer-mismatches',mismatches,spec.selection.maximumIntegerPredictionMismatch);
 return {passed:c.every(x=>x.passed),criteria:c};
}
function select(reports){
 assert.equal(reports.length,spec.models.length*spec.training.seeds.length,'Missing candidate');
 const names=reports.map(r=>r.kind+'-'+r.seed);assert.equal(new Set(names).size,names.length);
 const families=spec.models.map(kind=>{
  const seeds=spec.training.seeds.map(seed=>{const r=reports.find(r=>r.kind===kind&&r.seed===seed);assert.ok(r,'Missing frozen seed');return r;});
  assert.ok(seeds.every(r=>Number.isFinite(r.metrics.groupMse)));const sorted=seeds.map(r=>r.metrics.groupMse).sort((a,b)=>a-b);
  return {kind,passed:seeds.every(r=>r.gate.passed),medianGroupMse:sorted[1]};
 });
 const passing=families.filter(f=>f.passed).sort((a,b)=>a.medianGroupMse-b.medianGroupMse||spec.selection.modelTieOrder.indexOf(a.kind)-spec.selection.modelTieOrder.indexOf(b.kind));
 const chosen=passing.length?reports.find(r=>r.kind===passing[0].kind&&r.seed===spec.selection.deploymentSeed):null;
 return {status:chosen?'CANDIDATE-SELECTED-FINAL-STILL-SEALED':'HOLD',selectionFrozen:true,passed:!!chosen,
  authorizedToOpenOnce:false,finalOpened:false,families,selected:chosen?{kind:chosen.kind,seed:chosen.seed,modelSha256:chosen.modelSha256}:null};
}
function timing(model,rows){
 const cfg=spec.selection.timing,evaluate=i=>M.evaluateInputs(model,rows[i%rows.length].input,rows[i%rows.length].opponentInput);
 for(let i=0;i<cfg.warmup;i++)evaluate(i);const rounds=[];
 for(let r=0;r<cfg.rounds;r++){const before=performance.now();for(let i=0;i<cfg.evaluationsPerRound;i++)evaluate(i);
  rounds.push((performance.now()-before)*1000/cfg.evaluationsPerRound);}
 return rounds.sort((a,b)=>a-b)[Math.floor(rounds.length/2)];
}
function validate(validationFile,modelRoot,output){
 assert.ok(!fs.existsSync(output),'Validation output exists');const data=D.checkDataset(A.read(validationFile),'validation'),rows=data.rows;
 const baseline=metrics(rows,rows.map(r=>Math.trunc(r.baseline*spec.targetScale))),reports=[];
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'bao-learning-validation-'));
 try{
  const viewFile=path.join(temp,'views.json');A.atomic(viewFile,rows.map(r=>({input:r.input,opponentInput:r.opponentInput})));
  let trainDigest=null,origin=null;
  for(const kind of spec.models)for(const seed of spec.training.seeds){
   const file=path.join(modelRoot,'learning-'+kind+'-'+seed,'model.json'),trainingFile=path.join(path.dirname(file),'training.json');
   const bytes=fs.readFileSync(file),model=M.validateModel(JSON.parse(bytes)),training=A.read(trainingFile);
   assert.equal(model.kind,kind);assert.equal(model.seed,seed);assert.equal(model.learningFingerprint,data.learningFingerprint);
   assert.equal(training.status,'TRAINED-NOT-VALIDATED');assert.equal(training.modelSha256,A.shaBytes(bytes));
   assert.equal(training.kind,kind);assert.equal(training.seed,seed);assert.equal(training.binding.trainDigest,model.trainDigest);
   assert.equal(training.binding.learningFingerprint,data.learningFingerprint);
   assert.equal(training.environment.python,spec.training.python);assert.equal(training.environment.numpy,spec.training.numpy);
   if(process.env.GITHUB_RUN_ID){assert.equal(training.origin.repository,spec.collection.repository);assert.equal(training.origin.runId,Number(process.env.GITHUB_RUN_ID));
    assert.equal(training.origin.attempt,Number(process.env.GITHUB_RUN_ATTEMPT));assert.equal(training.origin.headSha,process.env.GITHUB_SHA);}
   if(origin===null)origin=training.origin;assert.deepEqual(training.origin,origin,'Candidate workflow origins differ');
   assert.equal(training.steps,kind==='linear'?0:spec.training.epochs*Math.ceil(spec.collection.train.rows*2/spec.training.batchSize));
   if(trainDigest===null)trainDigest=model.trainDigest;assert.equal(model.trainDigest,trainDigest,'Candidate train input differs');
   const predictions=rows.map(r=>M.evaluateInputs(model,r.input,r.opponentInput));
   const python=cp.spawnSync('python3',[path.join(__dirname,'formal-learning-predict.py'),file,viewFile],{encoding:'utf8',maxBuffer:8*1024*1024});
   assert.equal(python.status,0,'Python prediction failed');const expected=JSON.parse(python.stdout);assert.equal(expected.length,predictions.length);
   const mismatches=expected.filter((p,i)=>p!==predictions[i]).length;
   const evaluator=M.createEvaluator(model);
   rows.forEach((r,i)=>{assert.equal(evaluator.evaluate(r.state),predictions[i]);assert.equal(evaluator.evaluate(r.state,1-r.state.player),-predictions[i]);});
   const measured=metrics(rows,predictions),microseconds=timing(model,rows);
   reports.push({kind,seed,modelSha256:A.shaBytes(bytes),metrics:measured,microseconds,bytes:bytes.length,
    gate:gate(measured,baseline,{bytes:bytes.length,microseconds,mismatches})});
  }
  const selection=select(reports),result={schema:1,specId:spec.id,learningFingerprint:data.learningFingerprint,validationDigest:data.digest,
   trainDigest,origin,baseline,reports,...selection,environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model}};
  A.atomic(output,result);return {status:result.status,passed:result.passed,selected:result.selected,finalOpened:false,authorizedToOpenOnce:false};
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
if(require.main===module){try{console.log(JSON.stringify(validate(...process.argv.slice(2))));}
 catch{console.error('Frozen validation failed; no row payload logged');process.exitCode=1;}}
module.exports={metrics,gate,select,timing,validate};
