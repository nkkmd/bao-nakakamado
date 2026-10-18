'use strict';
// MIT. Prospective matched-policy study; no production or historical modifications.
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),os=require('node:os'),assert=require('node:assert/strict');
const K=require('../v010-followup/core.cjs'),{C}=K,R=require('../v010-followup/registry.cjs');
const profiles=['base','mobility'].flatMap(evaluator=>[2048,8192,32768].map(nodes=>({id:`${evaluator}-${nodes}`,evaluator,nodes})));
const contract={id:'NAKAKAMADO-V010-BALANCE-018',baseline:'e5180b02cc18d560e602f978f9c2d82d2e0561e2',seedDomain:'BALANCE018-COUNTERPLAY-20261018-v1',rules:'0.10.0',profiles,pairsPerCell:64,shards:64,maxPlies:400,quiescenceDepth:1,maxDepth:32,alpha:.05,family:24,severe:[.25,.75],counterThreshold:.25,maxUnresolvedFraction:.01,depthZeroHoldFraction:.01,maxParallel:4,shardTimeoutMinutes:90,maxRunnerHours:96,noAutomaticRerun:true};
const own=['study.cjs','check.test.cjs','pilot.cjs','freeze.cjs','reaudit.py','README.md'].map(x=>'tools/v010-balance018/'+x).concat(['.github/workflows/v010-balance018-check.yml','.github/workflows/v010-balance018-study.yml','.github/workflows/v010-balance018-pilot.yml','doc/V010_BALANCE018_PLAN_20261018.md']);
function openings(){return R.openings().filter(o=>o.forced&&o.firstIndex===2);}
function cells(){return openings().flatMap(opening=>[2048,8192,32768].flatMap(nodes=>['base','mobility'].flatMap(a=>['base','mobility'].map(b=>({id:`${opening.id}-${a}-${b}-${nodes}`,opening,profiles:[a,b].map(e=>profiles.find(p=>p.id===`${e}-${nodes}`))})))));}
function fingerprint(){return {...K.fingerprint(),...Object.fromEntries(own.map(p=>[p,C.hash(fs.readFileSync(path.join(C.root,p)))]))};}
function manifest(){const m=JSON.parse(fs.readFileSync(path.join(__dirname,'manifest.json')));assert.deepEqual(m.contract,contract);assert.deepEqual(m.cells,cells());assert.deepEqual(m.sources,fingerprint());assert.equal(m.digest,C.hash({contract:m.contract,cells:m.cells,sources:m.sources,pilot:m.pilot}));for(const [f,h] of Object.entries(m.pilot.files))assert.equal(C.hash(fs.readFileSync('doc/v010-balance018/pilot/'+f)),h);return m;}
function tasks(m){return m.cells.flatMap(cell=>Array.from({length:m.contract.pairsPerCell},(_,i)=>({...cell,seedIndex:i,id:`${cell.id}-${i}`,seed:parseInt(C.hash([m.contract.seedDomain,cell.opening.id,i]).slice(0,8),16)})));}
const read=f=>JSON.parse(z.gunzipSync(fs.readFileSync(f)));
function audit(row,t,m){assert.equal(row.digest,m.digest);assert.equal(row.id,t.id);assert.equal(row.seed,t.seed);assert.equal(row.checksum,C.hash(row.games));assert.equal(row.games.length,2);
 row.games.forEach((g,side)=>{assert.equal(g.seed,t.seed);assert.equal(g.firstPlayer,side);assert.equal(g.profile,t.profiles.map(p=>p.id).join('/'));K.audit(g,t.opening,t.profiles,m.contract.maxPlies);for(const tr of g.turns)if(tr.stats){assert.equal(tr.stats.maxNodes,t.profiles[tr.player===g.firstPlayer?0:1].nodes);assert.ok(tr.stats.nodes<=t.profiles[tr.player===g.firstPlayer?0:1].nodes);if(tr.stats.completedDepth){assert.equal(Math.max(...tr.stats.exactRootScores.map(r=>r.score)),tr.stats.rootScore);}}});
 assert.equal(row.games[0].trajectory,row.games[1].trajectory);assert.equal(row.games[0].firstWin,row.games[1].firstWin);assert.deepEqual(row.games[1].final,C.mirror(row.games[0].final));}
function shard(out,n,m=manifest()){
 assert.ok(Number.isInteger(n)&&n>=0&&n<m.contract.shards);fs.mkdirSync(out,{recursive:true});const ts=tasks(m).filter((_,i)=>i%m.contract.shards===n);let newPairs=0,reusedPairs=0;
 for(const t of ts){const f=path.join(out,t.id+'.json.gz');if(fs.existsSync(f)){audit(read(f),t,m);reusedPairs++;continue;}
  assert.ok(!fs.existsSync(f+'.started'),'HOLD interrupted pair '+t.id);fs.writeFileSync(f+'.started',JSON.stringify({digest:m.digest,id:t.id}),{flag:'wx'});
  const games=[0,1].map(side=>K.play(t.opening,t.profiles,t.seed,side,{maxPlies:m.contract.maxPlies}));
  const row={id:t.id,seed:t.seed,digest:m.digest,games,checksum:C.hash(games)};audit(row,t,m);
  fs.writeFileSync(f+'.tmp',z.gzipSync(JSON.stringify(row),{level:9}),{flag:'wx'});fs.renameSync(f+'.tmp',f);newPairs++;
 }
 const r={shard:n,digest:m.digest,sourceCommit:process.env.GITHUB_SHA||null,runId:process.env.GITHUB_RUN_ID||null,newPairs,reusedPairs,expectedPairs:ts.length,environment:{node:process.version,cpu:os.cpus()[0]?.model},files:Object.fromEntries(ts.map(t=>[t.id+'.json.gz',C.hash(fs.readFileSync(path.join(out,t.id+'.json.gz')))]))};
 const receiptFile=path.join(out,`receipt-${n}.json`);if(fs.existsSync(receiptFile)){const old=JSON.parse(fs.readFileSync(receiptFile));assert.deepEqual(old.files,r.files);assert.equal(old.digest,r.digest);assert.equal(newPairs,0);fs.writeFileSync(path.join(out,`reuse-receipt-${n}.json`),JSON.stringify(r,null,2)+'\n');}else fs.writeFileSync(receiptFile,JSON.stringify(r,null,2)+'\n',{flag:'wx'});return r;
}
function bounds(scores,alpha){const n=scores.length,w=Math.sqrt(Math.log(2/alpha)/(2*n));return {pairs:n,halfWidth:w,lower:Math.max(0,scores.reduce((s,g)=>s+(g===null?0:g),0)/n-w),upper:Math.min(1,scores.reduce((s,g)=>s+(g===null?1:g),0)/n+w)};}
function aggregate(out,m=manifest()){
 const ts=tasks(m);const receiptSources=new Set(),receiptRuns=new Set();assert.equal(fs.readdirSync(out).filter(f=>f.endsWith('.json.gz')).length,ts.length);
 for(let i=0;i<m.contract.shards;i++){const r=JSON.parse(fs.readFileSync(path.join(out,`receipt-${i}.json`)));receiptSources.add(r.sourceCommit);receiptRuns.add(r.runId);assert.equal(r.shard,i);assert.equal(r.digest,m.digest);const xs=ts.filter((_,j)=>j%m.contract.shards===i);assert.equal(r.expectedPairs,xs.length);assert.equal(Object.keys(r.files).length,xs.length);for(const t of xs)assert.equal(r.files[t.id+'.json.gz'],C.hash(fs.readFileSync(path.join(out,t.id+'.json.gz'))));}
 assert.equal(receiptSources.size,1);assert.equal(receiptRuns.size,1);
 const results=[];
 for(const cell of m.cells){const rows=ts.filter(t=>t.id.startsWith(cell.id+'-'));let first=0,second=0,zero=0,searched=0;const stops={},lengths={},depths={},seq=new Set(),prefix=new Set(),scores=[];let nodes=0,elapsed=0;
 for(const t of rows){const row=read(path.join(out,t.id+'.json.gz'));audit(row,t,m);const gs=row.games;scores.push(gs.some(g=>g.firstWin===null)?null:gs.reduce((v,g)=>v+g.firstWin,0)/2);for(const g of gs){stops[g.stop]=(stops[g.stop]||0)+1;lengths[g.turns.length]=(lengths[g.turns.length]||0)+1;if(g.firstWin!==null)g.firstWin?first++:second++;seq.add(g.trajectory);prefix.add(C.hash(g.turns.slice(0,12).map(t=>t.move)));for(const tr of g.turns)if(tr.stats){searched++;depths[tr.stats.completedDepth]=(depths[tr.stats.completedDepth]||0)+1;zero+=Number(!tr.stats.completedDepth);nodes+=tr.stats.nodes;elapsed+=tr.elapsedMs;}}}
 const unresolved=rows.length*2-first-second,ci=bounds(scores,m.contract.alpha/m.contract.family),hold=zero/Math.max(1,searched)>m.contract.depthZeroHoldFraction||unresolved/(rows.length*2)>m.contract.maxUnresolvedFraction;
 results.push({cellId:cell.id,openingId:cell.opening.id,profiles:cell.profiles.map(p=>p.id),matched:cell.profiles[0].id===cell.profiles[1].id,pairs:rows.length,games:rows.length*2,firstWins:first,secondWins:second,unresolved,stops,plyDistribution:lengths,completedDepthDistribution:depths,uniqueTrajectories:seq.size,unique12PlyPrefixes:prefix.size,searchTurns:searched,depthZero:zero,actualNodes:nodes,actualElapsedMs:elapsed,interval:ci,hold,severeSide:hold?null:ci.lower>.75?'first':ci.upper<.25?'second':null,counterCandidate:!hold&&ci.lower>.25});
 }
 const result={status:'AUDITED-COMPLETE',digest:m.digest,sourceCommit:[...receiptSources][0],runId:[...receiptRuns][0],pairs:ts.length,games:ts.length*2,cells:results,newGamesDuringAggregation:0,newProofSearches:0,assessment:'REQUIRES-COUNTERPLAY-AND-ROBUSTNESS-REVIEW',initialTheoreticalValue:'UNKNOWN'};
 fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(result,null,2)+'\n');return result;
}
if(require.main===module){const [cmd,out,id]=process.argv.slice(2);if(cmd==='manifest')console.log(JSON.stringify({digest:manifest().digest,pairs:tasks(manifest()).length}));else if(cmd==='shard')console.log(JSON.stringify(shard(out,Number(id))));else if(cmd==='aggregate'){const r=aggregate(out);if(process.env.GITHUB_SHA)assert.equal(r.sourceCommit,process.env.GITHUB_SHA);if(process.env.GITHUB_RUN_ID)assert.equal(r.runId,process.env.GITHUB_RUN_ID);console.log(JSON.stringify(r));}else throw Error('manifest|shard|aggregate');}
module.exports={contract,profiles,openings,cells,fingerprint,manifest,tasks,audit,read,shard,aggregate,bounds};
