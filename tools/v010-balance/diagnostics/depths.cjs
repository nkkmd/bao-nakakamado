'use strict';
// MIT. Read-only initial-position depth sensitivity; no weights or rules changed.
const fs=require('node:fs'),C=require('../core.cjs'),a=C.Research.createAI(C.Q,{now:()=>0});
const out=process.argv[2],rows=[];
for(let depth=1;depth<=11;depth++){
const r=a.analyzeMove(C.E.initialState(),{maxDepth:depth,maxNodes:262144,timeLimitMs:60000,exactRoot:true,tieSeed:2623000706,quiescenceDepth:1});
rows.push({requestedDepth:depth,move:r.move,...r.stats});console.log(JSON.stringify({requestedDepth:depth,completed:r.stats.completedDepth,nodes:r.stats.nodes,move:r.move,score:r.stats.rootScore}));
if(r.stats.completedDepth<depth)break;
}
fs.writeFileSync(out,JSON.stringify({id:'NAKAKAMADO-V010-INITIAL-DEPTH-SENSITIVITY-001',posthoc:true,maxNodes:262144,quiescenceDepth:1,
 sourceSha256:C.fingerprint(),rows},null,2)+'\n');
