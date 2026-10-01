"use strict";
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createCore}=require('./core.cjs'),{config,standard}=require('./configs.cjs');
const a=createCore(config('threshold6',[12,12],standard,6)),b=createCore(config('threshold4',[12,12],standard,4));
const rows=[];
for(const policy of ['random','noisy','greedy','reply','search3','search4','search6','search4-mobility']){
 const n=policy==='random'?100:20;let eligibleStates=0;
 for(let i=0;i<n;i++){
  const x=a.play(null,[policy,policy],a.seedAt(1000+i),0,true),y=b.play(null,[policy,policy],b.seedAt(1000+i),0,true);
  assert.equal(JSON.stringify(x.path),JSON.stringify(y.path));
  for(const t of x.path)for(const p of [0,1])if(t.after.phase==='namua'&&t.after.houseOwned[p]&&[4,5].includes(t.after.pits[p][0][4]))eligibleStates++;
 }
 rows.push({policy,games:n,pairedTrajectoryMismatches:0,ownedHouseFourOrFiveAtTurnEnds:eligibleStates});
}
const result={status:'PASS',scope:'Sampled played trajectories only; not all branches or all reachable positions',rows};
fs.writeFileSync(process.argv[2]||'threshold-diagnostic.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
