'use strict';
// MIT. Meaningful contract, symmetry, interruption and tampering checks.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const T=require('./study.cjs'),K=require('../v010-followup/core.cjs'),R=require('../v010-followup/registry.cjs'),{C}=K;
test('complete legal 4-first / 14-reply registry and normal/light agreement',()=>{const xs=R.openings().slice(1);assert.equal(xs.length,14);const initial=C.S.initialGame(),first=C.S.moveVariants(initial);assert.equal(first.length,4);first.forEach((m,i)=>{const b=C.S.apply(initial,m),cs=xs.filter(x=>x.firstIndex===i);assert.deepEqual(cs.map(x=>x.moves[1]),C.S.moveVariants(b));for(const x of cs)assert.equal(C.Q.stateKey(C.S.apply(b,x.moves[1]).board),x.startKey);});});
test('prospective natural vs forced tasks disjoint, matched seed pairing, precise interval not fairness',()=>{const m={contract:T.contract,openings:R.openings()},ts=T.tasks(m);assert.equal(ts.length,1440);assert.equal(new Set(ts.map(t=>t.id)).size,ts.length);assert.equal(ts.filter(t=>!t.opening.forced).length,768);assert.ok(T.bounds(Array(512).fill(0),.05/6).upper<.25);assert.ok(T.bounds(Array.from({length:512},(_,i)=>i%2),.05/6).lower>=.4);assert.ok(T.bounds(Array(512).fill(null),.05/6).upper===1);});
test('normal replay, strict winner/checksum/profile/missing-turn rejection, interrupted pair HOLD',()=>{
 const p={id:'base-64',nodes:64,evaluator:'base'},opening=R.openings()[0],m={digest:'TEST',contract:{...T.contract,profiles:[p],naturalPairs:1,forcedPairs:0,shards:1},openings:[opening]},t=T.tasks(m)[0];
 const games=[0,1].map(side=>K.play(opening,[p,p],t.seed,side,{maxPlies:400})),r={id:t.id,seed:t.seed,digest:m.digest,games,checksum:C.hash(games)};T.audit(r,t,m);
 for(const mutate of [r=>r.games[0].firstWin=9,r=>r.games[0].turns.pop(),r=>r.games[0].profile='wrong']){const bad=structuredClone(r);mutate(bad);bad.checksum=C.hash(bad.games);assert.throws(()=>T.audit(bad,t,m));}
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'balance017-test-'));fs.writeFileSync(path.join(out,t.id+'.json.gz.started'),'{}');assert.throws(()=>T.shard(out,0,m),/HOLD/);fs.rmSync(out,{recursive:true});
});
test('completed pair reused without simulation; full aggregate rejects missing or corrupted receipt bytes',()=>{
 const p={id:'base-32',nodes:32,evaluator:'base'},opening=R.openings()[0],m={digest:'TEST-REUSE',contract:{...T.contract,profiles:[p],naturalPairs:1,forcedPairs:0,shards:1},openings:[opening]},out=fs.mkdtempSync(path.join(os.tmpdir(),'balance017-reuse-'));
 const first=T.shard(out,0,m);assert.equal(first.newPairs,1);const second=T.shard(out,0,m);assert.equal(second.newPairs,0);assert.equal(second.reusedPairs,1);const a=T.aggregate(out,m);assert.equal(a.games,2);assert.equal(a.newGamesDuringAggregation,0);
 const name=Object.keys(second.files)[0],raw=fs.readFileSync(path.join(out,name));fs.appendFileSync(path.join(out,name),'bad');assert.throws(()=>T.aggregate(out,m));fs.writeFileSync(path.join(out,name),raw);fs.unlinkSync(path.join(out,name));assert.throws(()=>T.aggregate(out,m));fs.rmSync(out,{recursive:true});
});
