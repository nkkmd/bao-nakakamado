'use strict';
// MIT. Coverage, role, interruption, tamper and normal replay verification.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const T=require('./study.cjs'),K=require('../v010-followup/core.cjs'),{C}=K;
test('13 legal roots, distinct 2/11 groups, 156 cells, 4 paired shared seeds, 52 equal shards',()=>{
 const os=T.openings();assert.equal(os.length,13);assert.equal(os.filter(o=>o.group==='third-only').length,2);assert.equal(os.filter(o=>o.group==='fourth-forced').length,11);assert.equal(T.cells().length,156);assert.equal(T.cells().filter(c=>c.profiles[0].id===c.profiles[1].id).length,78);
 const ts=T.tasks({contract:T.contract,cells:T.cells()});assert.equal(ts.length,624);const inventory=require('../../doc/v010-balance019/task-inventory.json');assert.deepEqual(inventory.formalTasks,ts.map((t,i)=>({id:t.id,seedIndex:t.seedIndex,seed:t.seed,shard:i%T.contract.shards})));assert.equal(new Set(ts.map(t=>t.id)).size,624);const seeds=new Map();for(const t of ts){if(seeds.has(t.seedIndex))assert.equal(seeds.get(t.seedIndex),t.seed);seeds.set(t.seedIndex,t.seed);}assert.equal(new Set(seeds.values()).size,4);for(let i=0;i<52;i++)assert.equal(ts.filter((_,j)=>j%52===i).length,12);
 const historical=new Set(require('../../doc/v010-balance019/coverage-receipt.json').gameSeeds);assert.ok([...seeds.values()].every(s=>!historical.has(s)));
 const partition=require('../../doc/v010-balance019/pilot-partition.json');assert.equal(partition.shards.length,28);assert.deepEqual(partition.shards.flatMap(s=>s.cells).sort((a,b)=>a-b),Array.from({length:156},(_,i)=>i));assert.equal(require('../../doc/v010-balance019/pre-pilot-budget.json').decision,'READY-FOR-PILOT');
 const prior=new Set(['017','018'].flatMap(id=>{const old=require('../v010-balance'+id+'/study.cjs');return old.tasks(old.manifest()).map(t=>t.seed);}));assert.ok([...seeds.values()].every(s=>!prior.has(s)));
 const pilot=T.cells().map(c=>parseInt(C.hash(['BALANCE019-OPERATIONAL-PILOT-20261019-v1',c.id]).slice(0,8),16));assert.equal(new Set(pilot).size,156);assert.ok(pilot.every(s=>!prior.has(s)&&![...seeds.values()].includes(s)));
 assert.equal(T.bounds([null,null,null,null],.05/156).lower,0);assert.equal(T.bounds([null,null,null,null],.05/156).upper,1);assert.equal(T.bounds([1,1,1,1],.05/156).lower,0);
});
test('all forced prefixes replay with physical exchange and asymmetric roles',()=>{
 const ps=[{id:'base-16',evaluator:'base',nodes:16},{id:'mobility-16',evaluator:'mobility',nodes:16}];
 for(const o of T.openings())for(const side of [0,1]){const g=K.play(o,ps,11,side,{maxPlies:o.moves.length});assert.equal(g.turns.length,o.moves.length);assert.ok(g.turns.every(t=>t.forced&&t.stats===null));K.audit(g,o,ps,o.moves.length);assert.equal(g.firstWin,null);}
});
test('normal complete pair, budget and role tamper rejection, interruption HOLD, exact-byte reuse',()=>{
 const ps=[{id:'base-32',evaluator:'base',nodes:32},{id:'mobility-32',evaluator:'mobility',nodes:32}],cell={id:'test-cell',opening:T.openings()[0],profiles:ps},m={digest:'TEST',contract:{...T.contract,pairsPerCell:1,shards:1},cells:[cell]},t=T.tasks(m)[0],out=fs.mkdtempSync(path.join(os.tmpdir(),'balance019-test-'));
 try{fs.writeFileSync(path.join(out,t.id+'.json.gz.started'),'{}');assert.throws(()=>T.shard(out,0,m),/HOLD/);fs.unlinkSync(path.join(out,t.id+'.json.gz.started'));assert.equal(T.shard(out,0,m).newPairs,1);const original=fs.readFileSync(path.join(out,t.id+'.json.gz')),row=T.read(path.join(out,t.id+'.json.gz'));T.audit(row,t,m);assert.ok(row.games.every(g=>g.stop==='normal-terminal'));
 assert.equal(T.shard(out,0,m).newPairs,0);assert.deepEqual(fs.readFileSync(path.join(out,t.id+'.json.gz')),original);assert.equal(T.aggregate(out,m).newGamesDuringAggregation,0);
 const j=cell.opening.moves.length;
 for(const mutation of [r=>r.games[1].turns[j].policyId='wrong',r=>r.games[0].turns[j].stats.maxNodes=33,r=>r.games[1].turns.pop(),r=>r.games[0].seed++,r=>r.games[0].firstWin=9,r=>r.games[0].turns[0].forced=false]){const b=structuredClone(row);mutation(b);b.checksum=C.hash(b.games);assert.throws(()=>T.audit(b,t,m));}
 fs.appendFileSync(path.join(out,t.id+'.json.gz'),'bad');assert.throws(()=>T.aggregate(out,m));fs.writeFileSync(path.join(out,t.id+'.json.gz'),original);fs.unlinkSync(path.join(out,'receipt-0.json'));assert.throws(()=>T.aggregate(out,m));
 }finally{fs.rmSync(out,{recursive:true});}
});
