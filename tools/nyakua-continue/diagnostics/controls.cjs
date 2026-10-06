"use strict";
// MIT. Read-only cross-study check; preserve both frozen studies as recorded.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
function compare(B,A){
  assert.equal(B.study,'NYAKUA-CONTINUE-B-20261006');assert.equal(A.study,'NYAKUA-END-PIT-A-20261006');assert.equal(B.pilot,false);
  assert.equal(B.audit.status,'PASS');assert.equal(A.audit.status,'PASS');assert.equal(B.tasks.length,10);assert.equal(A.tasks.length,10);
  const checks=[];
  for(const task of B.tasks){
    const original=A.tasks.find(x=>x.task===task.task);assert.ok(original);assert.deepEqual(task.config,original.config);
    for(const model of ['A','current']){assert.deepEqual(task.models[model],original.models[model]);checks.push({task:task.task,model,games:task.models[model].n,status:'IDENTICAL'});}
  }
  const strip=x=>JSON.parse(JSON.stringify(x,(k,v)=>k==='elapsedMs'?undefined:v));
  const proof=[];
  for(const model of ['A','current']){
    const before=A.proof.initial.find(x=>x.model===model),after=B.proof.initial.find(x=>x.model===model);
    assert.deepEqual(strip(after),strip(before));proof.push({model,status:'IDENTICAL_EXCEPT_TIMING'});
  }
  return {status:'PASS',BReference:B.reference,AReference:A.reference,BSourceCommits:[...new Set(B.tasks.map(x=>x.sourceCommit))],BRunIds:[...new Set(B.tasks.map(x=>x.runId))],checks,proof,
    scope:'All 20 comparison summaries and both control proof searches; aggregated trial statistics, not a claim of independent game implementations.'};
}
function run(){
  const root=path.join(__dirname,'../results');const r=compare(JSON.parse(fs.readFileSync(path.join(root,'summary.json'))),JSON.parse(fs.readFileSync(path.join(__dirname,'../../nyakua-end-pit/results/summary.json'))));
  fs.writeFileSync(path.join(root,'control-audit.json'),JSON.stringify(r,null,2)+'\n');return r;
}
if(require.main===module)console.log(JSON.stringify(run()));
module.exports={compare,run};
