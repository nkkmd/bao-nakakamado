"use strict";
// MIT. Synthetic selection cases and already-known development states only.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const A=require('./formal-collection.cjs'),V=require('./formal-selection-v2.cjs'),T=require('./teacher-feasibility.cjs'),AR=require('./formal-artifact.cjs');
const clone=x=>JSON.parse(JSON.stringify(x)),empty={positionHashes:[],inputHashes:[],openingGroups:[]};
function row(i,split='train',type='namua'){
 const state={phase:type==='mtaji'?'mtaji':'namua',player:i%2,reserve:type==='mtaji'?[0,0]:[10,10],nyakuaReserve:[0,0]};
 if(type==='reservedOnly'){state.reserve[state.player]=0;state.nyakuaReserve[state.player]=1;}
 return {id:'position-'+i,inputHash:'input-'+i,unitId:'unit-'+String(i).padStart(4,'0'),ply:i,group:String(i%7).padStart(4,'0'),split,state};
}
function config(cap=30){const c=clone(A.formalV2);c.maximumTeacherRequests=cap;
 for(const split of c.selection.splitOrder){c.minimumCoverage[split]=Object.fromEntries(c.selection.coveragePriority.map(k=>[k,['mtaji','reservedOnly'].includes(k)?2:0]));c.minimumAcceptedRows[split]=5;c.minimumOpeningGroups[split]=2;}return c;}
function sealPlan(){const reg=require('./formal-development-exclusions.json'),payload={schema:1,config:A.formalV2,sources:A.sources(),registryDigest:reg.digest,selection:{},rows:[]};return {reg,plan:{...payload,digest:A.hash(payload)}};}
const origin={repository:'nkkmd/bao-nakakamado',runId:123,attempt:1,headSha:'a'.repeat(40)};
test('v2 changes selection only; seeds, candidate definition, minima, teacher and v1 opening partitions are preserved',()=>{
 A.configCheck(A.formalV2);for(const k of ['seedStartIndex','seedCount','policies','openingPlies','maxTrajectoryPlies','candidatePlies','additionalCandidates','teacher','shards','maximumTeacherRequests','maximumRequestsPerShard','minimumAcceptedFraction','minimumAcceptedRows','minimumOpeningGroups','minimumCoverage','maximumTerminalLineFractionPerSplit','timeoutRetryPolicy'])assert.deepEqual(A.formalV2[k],A.formal[k],k);
 for(let i=0;i<1000;i++)assert.equal(A.splitFor(A.hash(['test-opening',i]),A.formalV2),A.splitFor(A.hash(['test-opening',i]),A.formal));
 assert.notEqual(A.formalV2.namespace,A.formal.namespace);const changed=clone(A.formalV2);changed.minimumCoverage.train.mtaji--;assert.throws(()=>A.configCheck(changed));
});
test('late MTAJI and reserved-only strata survive the cap before common early NAMUA fills the remainder',()=>{
 const rows=Array.from({length:60},(_,i)=>row(i));let i=60;for(const split of ['train','validation','final'])for(const type of ['mtaji','reservedOnly'])for(let j=0;j<4;j++)rows.push(row(i++,split,type));
 const c=config(),selected=A.candidateAudit(rows,empty,c).rows;assert.equal(selected.length,30);assert.equal(new Set(selected.map(r=>r.id)).size,30);
 for(const split of c.selection.splitOrder){const coverage=T.coverage(selected.filter(r=>r.split===split));assert.ok(coverage.mtaji>=3);assert.ok(coverage.reservedOnly>=3);}
 assert.ok(T.coverage(A.candidateAudit(rows,empty,{...c,selection:undefined}).rows).mtaji<6);
});
test('v2 selection is permutation-invariant, ignores teacher labels, and preserves overlapping stratum accounting',()=>{
 const rows=Array.from({length:50},(_,i)=>row(i,['train','validation','final'][i%3],['namua','reservedOnly','mtaji'][Math.floor(i/3)%3])),c=config();
 const first=V.select(rows,c,A.roundRobin),reverse=V.select([...rows].reverse(),c,A.roundRobin);
 assert.deepEqual(first.map(r=>r.id),reverse.map(r=>r.id));for(const r of rows)r.measurement={label:{accepted:false,target:r.ply%3-1}};
 assert.deepEqual(V.select(rows,c,A.roundRobin).map(r=>r.id),first.map(r=>r.id));
 assert.ok(first.some(r=>T.tags(r.state).reservedOnly&&T.tags(r.state).ownReserved));
});
test('known opening/input exclusions and universe-wide quarantine apply before rare-stratum selection',()=>{
 const rows=[row(1,'validation','reservedOnly'),row(2,'validation','reservedOnly'),row(3,'train','reservedOnly'),row(4,'final','reservedOnly')];
 rows[3].inputHash=rows[2].inputHash;const reg={positionHashes:[],inputHashes:[rows[0].inputHash],openingGroups:[rows[1].group]};
 const result=A.candidateAudit(rows,reg,config(1));assert.equal(result.rows.length,0);assert.equal(result.counts.crossSplitCopies,2);assert.equal(result.counts.knownPositions+result.counts.knownOpenings,2);
});
test('unavailable strata stay unavailable; tiny caps never duplicate or invent rows and gates expose no final coverage',()=>{
 const rows=Array.from({length:9},(_,i)=>row(i)),c=config(2),a=A.candidateAudit(rows,empty,c);assert.equal(a.rows.length,2);assert.ok(a.rows.every(r=>rows.includes(r)));
 const gates=A.candidateGates({config:c,rows:a.rows,digest:'test',registryDigest:'test',sources:{},selection:a.counts});assert.equal(gates.status,'HOLD-BEFORE-TEACHER');assert.equal(gates.teacherRequestsExecuted,0);assert.deepEqual(Object.keys(gates.final),['requirementsPassed']);
});
test('v2 formal shards reject development clocks, local provenance and insufficient candidates before writing or evaluating',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bao-v2-guard-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const {plan,reg}=sealPlan();let calls=0;
 assert.throws(()=>A.runShard(root,plan,reg,Buffer.alloc(32,37),0,{analyze:()=>{calls++;},origin}),/real clock/);
 const localOrigin={repository:'local-development',runId:0,attempt:1,headSha:'local-development'};
 assert.throws(()=>A.runShard(root,plan,reg,Buffer.alloc(32,37),0,{origin:localOrigin}),/recorded Actions provenance|strictly equal/);
 assert.throws(()=>A.runShard(root,plan,reg,Buffer.alloc(32,37),0,{origin}),/HOLD/);assert.equal(calls,0);assert.deepEqual(fs.readdirSync(root),[]);
});
test('v2 uses formal artifact names and keeps aggregate metadata classified as formal',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bao-v2-origin-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const {plan,reg}=sealPlan();
 for(let shard=0;shard<16;shard++)A.atomic(path.join(root,'shard-'+shard,'manifest.json'),{binding:{schema:1,planDigest:plan.digest,sourceDigest:A.hash(plan.sources),registryDigest:reg.digest,shard,shards:16},indexes:[],completed:[],origin});
 assert.equal(AR.inspectShard(path.join(root,'shard-0'),plan,reg,Buffer.alloc(32,37),{...origin,name:'formal-shard-0'}).restored,0);
 assert.throws(()=>AR.inspectShard(path.join(root,'shard-0'),plan,reg,Buffer.alloc(32,37),{...origin,name:'formal-dev-shard-0'}));
 const summary=A.aggregate(root,plan,reg,Buffer.alloc(32,37));assert.equal(summary.development,false);assert.equal(summary.status,'HOLD');assert.equal('coverage' in summary.final,false);
});
test('manual workflow registers v1 and v2 explicitly and rejects unknown selection versions',()=>{
 const W=require('./formal-workflow.cjs');assert.equal(W.selectedConfig('v1').id,A.formal.id);assert.equal(W.selectedConfig('v2').id,A.formalV2.id);assert.throws(()=>W.selectedConfig('v3'));
});
