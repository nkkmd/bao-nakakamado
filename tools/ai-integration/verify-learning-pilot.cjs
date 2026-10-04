"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {spawnSync}=require("node:child_process"),P=require("./learning-pipeline.cjs"),I=require("./learning-input.cjs");
function verify(outputDirectory) {
  fs.mkdirSync(outputDirectory,{recursive:true});
  const checkpointDirectory=fs.mkdtempSync(path.join(outputDirectory,"checkpoints-"));
  const initial=P.runPilot(checkpointDirectory),dataset=JSON.parse(fs.readFileSync(path.join(checkpointDirectory,"pilot-dataset.json")));
  const rows=dataset.rows.flatMap(r=>[0,1].map(perspective=>({state:r.state,perspective})));
  const py=spawnSync("python3",[path.join(__dirname,"learning_input.py")],{input:JSON.stringify(rows),encoding:"utf8",maxBuffer:16*1024*1024});
  assert.equal(py.status,0,py.stderr);assert.deepEqual(JSON.parse(py.stdout),rows.map(r=>I.encode(r.state,r.perspective)));
  const one=path.join(checkpointDirectory,P.spec.pilot.policies[0]+"-"+P.spec.pilot.seedStartIndex+".json");
  fs.unlinkSync(one);fs.writeFileSync(one+".tmp","{interrupted-write");
  const resumed=P.runPilot(checkpointDirectory),again=P.runPilot(checkpointDirectory);
  assert.equal(resumed.checkpointReuse.generated,1);assert.equal(resumed.checkpointReuse.reused,initial.units-1);
  assert.equal(again.checkpointReuse.generated,0);assert.equal(again.checkpointReuse.reused,initial.units);
  assert.equal(initial.traceSha256,resumed.traceSha256);assert.equal(initial.traceSha256,again.traceSha256);
  for(const name of ["train","validation","final"])assert.ok(initial.splitCounts[name]>0);
  for(const name of ["namua","mtaji","north","south","ownReserved","opponentReserved","threePlacement","twoPlacement","lastOrdinary","nearTransition"])assert.ok(initial.coverage[name]>0);
  const result={...initial,pythonNodeEncodingComparisons:rows.length,resumeVerification:{
    partial:{generated:resumed.checkpointReuse.generated,reused:resumed.checkpointReuse.reused},
    complete:again.checkpointReuse,traceMatches:true},
    missingReachableCoverage:Object.entries(initial.coverage).filter(([k,v])=>v===0).map(([k])=>k)};
  fs.writeFileSync(path.join(outputDirectory,"learning-pilot-verification.json"),JSON.stringify(result,null,2)+"\n");
  return result;
}
if(require.main===module){if(process.argv.length!==3)throw Error("Usage: node tools/ai-integration/verify-learning-pilot.cjs OUTPUT_DIRECTORY");console.log(JSON.stringify(verify(path.resolve(process.argv[2])),null,2));}
module.exports={verify};
