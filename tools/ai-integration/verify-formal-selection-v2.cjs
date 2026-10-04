"use strict";
// MIT. Full candidate preflight only; no teacher calls or final payload output.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const A=require('./formal-collection.cjs'),V=require('./formal-selection-v2.cjs'),R=require('./formal-registry.cjs'),T=require('./teacher-feasibility.cjs');
function verify(output,{onProgress}={}){
 assert.ok(!fs.existsSync(output),'Use a new report filename');const registry=R.validateRegistry(require('./formal-development-exclusions.json'));let checks;
 const old=require('./formal-candidate-preflight-results.json');
 const plan=A.prepare(registry,A.formalV2,{onProgress,onEligible:rows=>{
  const forward=V.select(rows,A.formalV2,A.roundRobin),reverse=V.select([...rows].reverse(),A.formalV2,A.roundRobin);
  assert.deepEqual(forward.map(r=>r.id),reverse.map(r=>r.id));assert.equal(new Set(forward.map(r=>r.id)).size,forward.length);assert.equal(new Set(forward.map(r=>r.inputHash)).size,forward.length);
  const v1=rows.slice(0,A.formal.maximumTeacherRequests);for(const split of ['train','validation']){const selected=v1.filter(r=>r.split===split);assert.equal(selected.length,old[split].rows);assert.deepEqual(T.coverage(selected),old[split].coverage);}
  checks={selectionPermutationInvariant:true,positionAndInputDuplicates:0,v1TrainValidationSelectionReproduced:true,splitAssignmentUnchanged:true};
 }});
 for(const k of ['candidates','eligible','crossSplitCopies','knownPositions','knownOpenings','withinSplitCopies','capOmitted','shortOpenings','cutoffs'])assert.deepEqual(plan.selection[k],old.selection[k],k);
 A.validatePlan(plan,registry);const gates=A.candidateGates(plan);
 const report={recordDateJST:'2026-10-05',verifiedAt:new Date().toISOString(),scope:'v2-candidate-preflight-only-no-teacher-no-training-no-final-opening',configId:plan.config.id,
  specFreezeCommit:'8a66cdf41a26ab91cb60c294ac8afb3cc76c7c96',...gates,sourceHashes:plan.sources,checks:{...checks,normalReplayChecked:plan.rows.length,currentSourcesAndRegistryVerified:true},
  formalCollectionStarted:false,trainingStarted:false,finalOpened:false};
 A.atomic(output,report);return report;
}
if(require.main===module){try{const report=verify(process.argv[2],{onProgress:p=>console.log(JSON.stringify({progress:p}))});console.log(JSON.stringify(report,null,2));}
 catch(error){console.error('V2 candidate verification failed; no payload logged: '+error.name);process.exitCode=1;}}
module.exports={verify};
