"use strict";
// MIT; see ../../LICENSE. Verify independent sowing against distinct known loops.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ring=require('./ring.cjs'), c=require('../nyakua-end-pit/core.cjs'), run=require('./run.cjs');
function read(p){return JSON.parse(fs.readFileSync(path.join(__dirname,p)));}
const original=read('../nyakua-end-pit/legacy-cycle.json');
const current=read('../nyakua-continue/results/search4/anomaly-current-44-1.json');
const B=read('../nyakua-continue/results/noisy/anomaly-B-early-311-1.json');
const cases=[{...original,period:100},
  {before:current.history.at(-2).after,move:current.history.at(-1).move,period:284},
  {before:B.history.at(-2).after,move:B.history.at(-1).move,period:32184}];
let snapshots=0;
for(const x of cases){
  const r=ring.simulate(ring.flatten(x.before.pits[x.before.player]),ring.index(x.move),x.move.direction,{trace:true});
  assert.equal(r.status,'cycle');assert.equal(r.period,x.period);
  const source=run.sourceTrace(x.before,x.move);
  for(let i=0;i<Math.min(source.trace.length,r.states.length);i++){
    assert.deepEqual(r.states[i].ring,ring.flatten(source.trace[i].state.pits[x.before.player]));
    assert.equal(r.states[i].cursor,ring.index(source.trace[i].cursor));snapshots++;
  }
}
// A genuinely finite seed distribution must be distinguished from a limit.
const a=Array(16).fill(0);a[0]=2;
assert.equal(ring.simulate(a,0,'right').status,'finite');
const s=read('results/structure.json');
assert.equal(s.independent.period,272);assert.equal(s.independent.dropsPerPeriod,816);
assert.equal(s.paths.uniqueMoveSequences,1);assert.equal(s.comparedSnapshots,272);
assert.equal(s.sensitivity.length,165);assert.ok(s.sensitivity.every(x=>x.status==='finite'));
assert.ok(s.sensitivity.filter(x=>x.legal).length===108);
assert.ok(s.fixedSearch4.openings.find(x=>x.move.direction==='right'&&x.move.index===2).value===0);
const proofs=read('results/alternatives.json');assert.equal(proofs.records.length,3);
for(const x of proofs.records){
  assert.equal(x.records.at(-1).result,'NODE_BUDGET');
  assert.equal(x.records.filter(x=>x.result==='UNKNOWN').at(-1).depth,9);assert.equal(x.certificate,null);
}
const follow=read('results/continuations.json');assert.equal(follow.records.length,3);
for(const x of follow.records){
  const i=s.alternatives.findIndex(a=>JSON.stringify(a.move)===JSON.stringify(x.move40));
  const saved=read('results/continuation-'+i+'.json');let b=s.alternatives[i].after;
  for(const h of saved.history){b=c.R.advance('A',b,h.move).b;assert.equal(JSON.stringify(b),JSON.stringify(h.after));c.validate(b);}
  assert.equal(b.winner,x.winner);assert.equal(b.reason,'front-empty');
}
assert.ok(follow.records.some(x=>x.winner===s.before.player));
const result={status:'PASS',additionalIndependentPeriods:[100,284,32184],comparedSnapshots:snapshots,
  knownAPeriod:272,perturbations:165,legalPerturbations:108,replayedContinuations:3};
fs.writeFileSync(path.join(__dirname,'results/checks.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
