"use strict";
// MIT. Audit new follow-up records without repeating the frozen 26,080 games.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),c=require('../core.cjs'),runner=require('../run.cjs'),P=require('../proof.cjs');
const read=p=>JSON.parse(fs.readFileSync(p)),hash=s=>crypto.createHash('sha256').update(s).digest('hex'),canonical=x=>JSON.parse(JSON.stringify(x));
function run(){
  const root=path.join(__dirname,'../results'),study=read(path.join(root,'summary.json')),opening=read(path.join(root,'opening-followup.json')),terminal=read(path.join(root,'mobility-terminal-proof.json'));
  assert.equal(study.audit.status,'PASS');assert.equal(study.audit.games,26080);assert.equal(study.audit.replayed,174);assert.deepEqual(runner.hashes(),study.sourceHashes);
  const controls=require('./controls.cjs').run();assert.equal(controls.status,'PASS');
  const pattern=require('./mobility.cjs').analyze(path.join(root,'mobility'));assert.deepEqual(canonical(pattern),read(path.join(root,'mobility-diagnostic.json')));
  assert.ok(pattern.traces.every(t=>t.decisions.slice(0,50).every(d=>d.equalBestChoices.length===1&&d.budgetStops===0)));
  assert.equal(opening.budgetPerDepth,1500000);assert.equal(opening.deadlineMs,120000);assert.equal(opening.originalProofHash,hash(fs.readFileSync(path.join(__dirname,'../proof.cjs'))));
  assert.deepEqual(opening.opening,canonical(pattern.traces[0].decisions[0].selected));assert.equal(opening.records.at(-2).depth,11);assert.equal(opening.records.at(-2).result,'UNKNOWN');assert.equal(opening.records.at(-1).depth,12);assert.equal(opening.records.at(-1).result,'NODE_BUDGET');assert.equal(opening.certificate,null);
  let replayedPlies=0;const counters=[];
  for(const item of opening.counters){
    assert.equal(item.maxGames,10);assert.ok(item.games.length<=10);assert.equal(item.stoppingRule,'Stop at first normal second-player win');
    if(!item.counterexample){assert.equal(item.games.length,10);continue;}
    const game=read(path.join(root,item.counterexample));assert.equal(game.model,'B-early');assert.deepEqual(game.policies,['search4-mobility',item.defender]);assert.equal(game.winner,1);assert.notEqual(game.reason,'relay-limit');
    let b=c.R.engine(game.model).initialState();for(const x of game.history){const r=c.R.advance(game.model,b,x.move);assert.deepEqual(canonical(r.b),x.after);assert.deepEqual(canonical(r.entry),x.entry);assert.deepEqual(canonical(c.B.oracle(game.model,b,x.move)),x.after);b=r.b;c.validate(b);replayedPlies++;}
    assert.deepEqual(canonical(b),game.final);assert.equal(b.winner,1);assert.equal(runner.hash(JSON.stringify(b)),item.games.at(-1).finalHash);
    counters.push({file:item.counterexample,plies:game.plies,seed:game.seed,winner:game.winner,reason:game.reason});
  }
  assert.equal(counters.length,3);assert.equal(opening.counters.reduce((n,x)=>n+x.games.length,0),22);
  const g=read(path.join(root,terminal.source));assert.deepEqual(terminal.certificate.nodes[terminal.certificate.root].board,g.history[49].after);assert.equal(terminal.rootAfterPly,50);const certificate=P.verify(terminal.certificate);assert.equal(certificate.nodes,4);
  const sourceHashes=Object.fromEntries(fs.readdirSync(__dirname).filter(f=>f.endsWith('.cjs')).sort().map(f=>[f,hash(fs.readFileSync(path.join(__dirname,f)))]));
  const records=['control-audit.json','mobility-diagnostic.json','opening-followup.json','mobility-terminal-proof.json',...counters.map(x=>x.file)];
  const recordHashes=Object.fromEntries(records.map(f=>[f,hash(fs.readFileSync(path.join(root,f)))]));
  const result={status:'PASS',comparisonSource:'de32fb1c4712620e8598241d7894209c25f3a1cc',comparisonRunId:37401153919,frozenTrialHashesUnchanged:true,controlSummaries:controls.checks.length,controlProofSearches:controls.proof.length,
    deterministicPolicyPrefixPlies:50,storedPolicyExamples:4,counterSearchGames:22,counterexamples:counters,replayedCounterPlies:replayedPlies,referenceCounterChecks:replayedPlies,terminalCertificate:certificate,followupSourceHashes:sourceHashes,followupRecordHashes:recordHashes};
  fs.writeFileSync(path.join(root,'followup-audit.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));return result;
}
if(require.main===module)run();
module.exports={run};
