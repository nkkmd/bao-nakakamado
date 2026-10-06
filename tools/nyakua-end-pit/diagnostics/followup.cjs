"use strict";
// MIT; see ../../../LICENSE. Read-only diagnostic after the frozen trials.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),c=require('../core.cjs');
function extended(before,move){
  let source=fs.readFileSync(c.R.sourcePath,'utf8');
  function once(a,b){assert.equal(source.split(a).length,2);source=source.replace(a,b);}
  once('const MAX_RELAY = 512;','const MAX_RELAY = 65536;');
  once('    let relays = 0;', '    const studySeen = new Map();\n    let relays = 0;');
  once('      relays += 1;', '      relays += 1;\n'
    + '      const studyKey = JSON.stringify([state.pits,state.reserve,state.nyakuaReserve,state.houseOwned,state.pending,state.player,state.phase,cursor,direction,captureTurn]);\n'
    + '      if (studySeen.has(studyKey)) {state.winner=null;state.reason="proven-cycle";\n'
    + '        events.push({kind:"proven-cycle",first:studySeen.get(studyKey),again:relays,period:relays-studySeen.get(studyKey)});return {state,events};}\n'
    + '      studySeen.set(studyKey,relays);');
  const context={module:{exports:{}}};vm.runInNewContext(source,context);
  const r=context.module.exports.applyMove(before,move,{snapshots:false});
  return {reason:r.state.reason,cycle:r.events.find(e=>e.kind==='proven-cycle')||null,relays:r.events.filter(e=>e.kind==='relay').length};
}
function analyzeCases(summary,cases){
  const groups=new Map();
  const anomalies=summary.audit.anomalies.map((a,i)=>{
    const {before,move}=cases[i];
    assert.equal(before.phase,'mtaji');assert.ok(before.reserve.every(n=>n===0)&&before.nyakuaReserve.every(n=>n===0));
    const A=c.R.advance('A',before,move).b,current=c.R.advance('current',before,move).b,none=c.R.advance('none',before,move).b;
    assert.equal(JSON.stringify(A),JSON.stringify(current));assert.equal(JSON.stringify(A),JSON.stringify(none));
    const k=c.key(before)+'|'+JSON.stringify(move);if(!groups.has(k))groups.set(k,{before,move,observed:0,models:new Set(),extended:extended(before,move)});
    const group=groups.get(k);group.observed++;group.models.add(a.model);
    return {...a,key:k};
  });
  const cycles=[...groups.values()].map(g=>({...g,models:[...g.models],alternatives:c.children('A',g.before).map(x=>({move:x.m,reason:x.b.reason,staticScoreForMover:c.score('A',x.b,g.before.player)}))}));
  const intervals=[];
  // Hoeffding reference intervals do not collapse when pair variance is zero.
  // This assumes independent seed-level [0,1] observations, not independent games.
  for(const t of summary.tasks)for(const model of ['A','current','none']){
    const s=t.models[model],h=100*Math.sqrt(Math.log(40)/(2*s.pairs));
    intervals.push({task:t.task,model,pairs:s.pairs,assumption:'Independent seed-level observations; exploratory unadjusted reference interval',
      hoeffding95AllGameBoundsPct:[Math.max(0,s.firstWinsAllGameBoundsPct[0]-h),Math.min(100,s.firstWinsAllGameBoundsPct[1]+h)],
      pairedVarianceZero:s.pairCluster95Pct?.[0]===s.pairCluster95Pct?.[1]});
  }
  const output={status:'PASS',comparisonSource:'6f91b5a1069fe9d54ca65d4a4fd988b0b5ffbf4f',comparisonRunId:37398350927,
    anomalies:anomalies.length,uniqueAnomalousMoves:cycles.length,cycles,intervals};
  return output;
}
function analyze(root){
  const summary=JSON.parse(fs.readFileSync(path.join(root,'summary.json')));
  const cases=summary.audit.anomalies.map(a=>{const g=JSON.parse(fs.readFileSync(path.join(root,a.task,a.file)));return {before:g.history.at(-2).after,move:g.history.at(-1).move};});
  const output=analyzeCases(summary,cases);fs.writeFileSync(path.join(root,'followup.json'),JSON.stringify(output,null,2)+'\n');return output;
}
if(require.main===module)console.log(JSON.stringify(analyze(process.argv[2]||path.join(__dirname,'../results'))));
module.exports={analyze,analyzeCases,extended};
