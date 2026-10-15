'use strict';
// MIT. Equal-budget exploratory probes: six candidate roots versus all 14 openings.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('../v010-balance/core.cjs'),I=require('./inputs.cjs'),V=require('../v010-balance/diagnostics/proof.cjs'),P=require('./schedule.cjs'),S4=require('../v010-branch/study.cjs');
const sources=['tools/v010-deepen012/pilot.cjs','tools/v010-deepen012/inputs.cjs','tools/v010-deepen012/schedule.cjs','tools/v010-pn007/schedule.cjs','tools/v010-pn007/prover.cjs'];
const snapshot=()=>Object.fromEntries(sources.map(p=>[p,C.hash(fs.readFileSync(path.join(C.root,p)))]));
const sourceSnapshot=snapshot(),out=process.argv[2];fs.mkdirSync(out,{recursive:true});assert.ok(!fs.existsSync(path.join(out,'pilot.json')));
const input=I.prepare(),rows=[],candidates=[...I.roots().map(r=>({...r,group:'local-13'})),...I.initialRoots().map(r=>({...r,group:'initial'}))];
for(const root of candidates)for(const target of [0,1]){
 const result=P.prove(root.state,target,{...input,maxNodes:50000,wallMs:5000,phaseWallMs:1000});
 if(result.certificate)V.verify(result.certificate);
 const file=`${root.group}-${root.id}-${target}.json.gz`;
 S4.write(path.join(out,file),{classification:'EXPLORATORY-NOT-FORMAL',group:root.group,rootId:root.id,state:root.state,target,result});
 const row={group:root.group,rootId:root.id,target,status:result.status,winner:result.winner,depth:result.certificate?.depth??null,visits:result.visits,elapsedMs:result.elapsedMs,file,sha256:C.hash(fs.readFileSync(path.join(out,file)))};rows.push(row);console.log(JSON.stringify(row));
}
assert.deepEqual(snapshot(),sourceSnapshot);
fs.writeFileSync(path.join(out,'pilot.json'),JSON.stringify({classification:'EXPLORATORY-NOT-FORMAL',inputArchiveSha256:I.SHA,sources:sourceSnapshot,verifiedStates:input.verifiedStates,rows,newGames:0,formalJobs:0,interpretation:'Equal per-goal 50k visits / 5 seconds; 12 local and 28 initial goals. Budget stops never decide a winner or fairness. These records do not enter formal results or the formal proof book.'},null,2)+'\n',{flag:'wx'});
