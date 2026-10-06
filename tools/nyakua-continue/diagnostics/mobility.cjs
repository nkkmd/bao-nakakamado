"use strict";
// MIT. Read-only explanation of a 160/160 policy-specific win result.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const c=require('../core.cjs'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function analyze(dir){
  const file=path.join(__dirname,'../../nyakua-end-pit/core.cjs');let source=fs.readFileSync(file,'utf8');const originalHash=hash(source);
  const target='  return options[Math.floor(random()*options.length)];';assert.equal(source.split(target).length,2);
  source=source.replace(target,'  const chosen=options[Math.floor(random()*options.length)]; return {...chosen,studyOptions:options.map(x=>x.m),studyValues:values};');
  const context={module:{exports:{}},require:Module.createRequire(file)};vm.runInNewContext(source,context);const I=context.module.exports;
  const examples=fs.readdirSync(dir).filter(f=>f.startsWith('example-B-early-')).sort().map(f=>({file:f,game:JSON.parse(fs.readFileSync(path.join(dir,f)))}));
  assert.equal(examples.length,4);const traces=[];
  for(const {file,game:g} of examples){
    const streams=[c.rng(g.seed^0xa341316c),c.rng(g.seed^0xc8013ea4)];if(g.swapStreams)streams.reverse();let b=c.R.engine(g.model).initialState();const decisions=[];
    for(const x of g.history){const stats={searchNodes:0,budgetStops:0,completedDepthSum:0,searchDecisions:0};const selected=I.choose(g.model,b,g.policies[b.player],streams[b.player],stats);
      assert.equal(JSON.stringify(selected.b),JSON.stringify(x.after));assert.equal(JSON.stringify(selected.m),JSON.stringify(x.move));
      decisions.push({ply:decisions.length+1,player:b.player,selected:selected.m,equalBestChoices:selected.studyOptions||[selected.m],values:selected.studyValues||null,budgetStops:stats.budgetStops});b=selected.b;
    }
    assert.equal(b.winner,0);traces.push({file,moveHash:hash(JSON.stringify(g.history.map(x=>x.move))),decisions});
  }
  const rows=fs.readdirSync(dir).filter(f=>/^B-early-\d+\.json$/.test(f)).sort().flatMap(f=>JSON.parse(fs.readFileSync(path.join(dir,f))).rows),games=rows.flatMap(x=>x.games);
  assert.equal(games.length,160);assert.ok(games.every(g=>g.winner===0&&g.plies===53));
  let prefix=0;while(prefix<53&&traces.every(t=>JSON.stringify(t.decisions[prefix].selected)===JSON.stringify(traces[0].decisions[prefix].selected)))prefix++;
  return {status:'PASS',studySource:'de32fb1c4712620e8598241d7894209c25f3a1cc',studyRunId:37401153919,originalPolicyHash:originalHash,instrumentedPolicyHash:hash(source),
    games:160,firstWins:160,plies:53,uniqueFinalHashes:new Set(games.map(x=>x.finalHash)).size,storedExamples:4,commonExamplePrefixPlies:prefix,
    tiedDecisionPlies:traces.map(t=>({file:t.file,plies:t.decisions.filter(d=>d.equalBestChoices.length>1).map(d=>d.ply)})),traces,
    interpretation:'A win against this depth-4 mobility policy. The four saved examples share a long prefix but differ in later choices; no assertion that all 160 complete histories are identical. This is not an all-defender-response proof from the initial state.'};
}
function run(dir=path.join(__dirname,'../results/mobility')){const r=analyze(dir);fs.writeFileSync(path.join(__dirname,'../results/mobility-diagnostic.json'),JSON.stringify(r,null,2)+'\n');return r;}
if(require.main===module){const r=run(process.argv[2]);console.log(JSON.stringify({...r,traces:undefined}));}
module.exports={analyze,run};
