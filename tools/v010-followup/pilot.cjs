'use strict';
// MIT. Operational benchmark only; no policy weights or outcomes are selected.
const fs=require('node:fs'),path=require('node:path'),K=require('./core.cjs'),R=require('./registry.cjs');
const roots=R.roots().filter(r=>['initial','primary-8192-before-23','primary-8192-before-27','primary-8192-before-29','low-512-before-29','middle-2048-before-33'].includes(r.id));
const rows=[];
for(const p of K.P.POLICIES){const a=K.P.createPolicy(p);for(const r of roots){const t=performance.now(),result=a.analyzeMove(r.state,2026101201);
 const row={policy:p.id,root:r.id,nodes:result.stats.nodes,depth:result.stats.completedDepth,elapsedMs:performance.now()-t};rows.push(row);console.log(JSON.stringify(row));}}
const quantile=(a,p)=>[...a].sort((x,y)=>x-y)[Math.ceil(a.length*p)-1];
const reports=K.P.POLICIES.map(p=>{const r=rows.filter(x=>x.policy===p.id);return {policy:p.id,requests:r.length,depthZero:r.filter(x=>!x.depth).length,
 medianDepth:quantile(r.map(x=>x.depth),.5),p95Ms:quantile(r.map(x=>x.elapsedMs),.95),maxMs:Math.max(...r.map(x=>x.elapsedMs))};});
const out={id:'NAKAKAMADO-V010-FOLLOWUP-OPERATIONAL-BENCHMARK-001',policySelection:false,weightChanges:false,reports,rows,
 environment:{node:process.version,cpu:require('node:os').cpus()[0]?.model}};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({requests:rows.length,depthZero:rows.filter(x=>!x.depth).length}));
