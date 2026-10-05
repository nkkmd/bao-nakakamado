"use strict";
// MIT. Protocol tests: failures, side pairing, replay, checkpoint reuse and selection isolation.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const O=require('./equal-time-openings.cjs'),M=require('./equal-time-match.cjs'),P=require('./learning-pipeline.cjs');
const {Q,S,hash,clone}=O,Core=require('../../prototype/model-search-ai.js');
function fake(actor,choose=s=>Q.moveVariants(s)[0]){return {analyzeMove(s,o){return {outcome:'ongoing',move:choose(s),scoreMeaning:'completed-depth-heuristic',
 stats:{searchId:Core.SEARCH_ID,evaluatorId:M.IDs[actor],allocatedTimeMs:o.timeLimitMs,completedDepth:1,nodes:1,quiescenceNodes:0,
  safetyStops:0,timedOut:false,rootScore:0,elapsedMs:0}};}};}
const players=()=>({model:fake('model'),baseline:fake('baseline')});
function expected(r){return Object.fromEntries(['pairIndex','modelSide','budgetMs','maximumPlies','opening'].map(k=>[k,r[k]]));}
const o=O.opening(O.prefix('random',700000));
test('Short generator matches frozen full generator for all policies and both initial sides',()=>{
 for(const policy of O.spec.formalDesign.policies)for(const index of [700000,700001,900017,1000018]){
  const t=O.prefix(policy,index),full=P.trajectory(policy,index);assert.deepEqual(t.states,full.states.slice(0,t.states.length));
  assert.equal(t.first,index%2);if(t.complete){assert.equal(t.group,hash(full.states.slice(0,13).map(require('./learning-input.cjs').positionKey)));
   assert.deepEqual(O.replayOpening(O.opening(t)).board,t.states.at(-1));}
 }
});
test('All pilot openings are excluded development groups; old collection range remains immutable',()=>{
 const r=O.registry();for(const x of O.pilotOpenings())assert.ok(r.openingGroups.includes(x.group));
 assert.equal(require('./formal-collection-spec.json').seedStartIndex,900000);assert.equal(require('./formal-collection-spec.json').seedCount,4096);
 assert.equal(O.spec.formalDesign.candidateSeedStart,1000000);
});
test('Actual candidates use identical core/options, distinct frozen evaluators, valid legal results',()=>{
 const p=M.preflight(),made=M.createPlayers(),s=O.replayOpening(o).board;assert.equal(p.connection.formalRowsRead,0);
 assert.equal(p.connection.modelSha256,'f74175fbaa6f2d6a82148cf5e106da7291f396b2b38cb79866dc641b2147254d');
 for(const actor of ['model','baseline']){const r=made.players[actor].analyzeMove(s,M.options(25));M.validateStats(r.stats,actor,25);
  assert.ok(Q.moveVariants(s).some(m=>Core.moveKey(m)===Core.moveKey(r.move)));}
 assert.throws(()=>M.options(26));
});
test('Normal-transition replay retains NYAKUA accounting and rejects altered moves/stats/stop reasons',()=>{
 const r=M.playGame(o,0,0,25,{players:players(),maximumPlies:8});assert.equal(r.status,'maximum-plies');assert.equal(r.winner,null);
 assert.equal(r.steps.length,8);M.auditGame(r,expected(r));M.conservation(r.finalState);
 for(const change of [x=>x.steps[0].move.index=99,x=>x.steps[0].summary.stolen++,x=>x.steps[0].stats.evaluatorId='wrong',
  x=>x.steps[0].actor='baseline',x=>x.status='normal-terminal',x=>x.finalState.reserve[0]++]){
  const bad=clone(r);change(bad);assert.throws(()=>M.auditGame(bad,expected(r)));}
});
test('Swapped assignments share exact root; physical repetition excludes bookkeeping turn',()=>{
 const a=M.playGame(o,2,0,25,{players:players(),maximumPlies:4}),b=M.playGame(o,2,1,25,{players:players(),maximumPlies:4});
 assert.equal(a.initialSha256,b.initialSha256);assert.equal(a.steps[0].actor,a.steps[0].player===0?'model':'baseline');
 assert.equal(b.steps[0].actor,b.steps[0].player===1?'model':'baseline');
 const s=O.replayOpening(o).board,t=clone(s);t.turn+=9;assert.equal(O.physical(s),O.physical(t));assert.notEqual(Q.stateKey(s),Q.stateKey(t));
 assert.equal(M.classify(t,new Set([O.physical(s)]),1,400),'repetition');
});
test('Search exception, mutation and illegal move are preserved technical failures, never normal losses',()=>{
 for(const [code,method] of [['search-exception',()=>{throw Error('expected');}],['input-mutation',s=>{s.reserve[0]++;return fake('model').analyzeMove(s,M.options(25));}],
  ['illegal-move',s=>({...fake('model').analyzeMove(s,M.options(25)),move:{type:'invalid'}})]]){
  const side=O.replayOpening(o).board.player,p=players();p.model={analyzeMove:method};
  const r=M.playGame(o,0,side,25,{players:p});assert.equal(r.status,'technical-failure');assert.equal(r.failure.code,code);
  assert.equal(r.steps.length,0);assert.equal(r.winner,null);assert.equal(hash(r.finalState),r.initialSha256);M.auditGame(r,expected(r));
 }
});
test('Known trajectory reaches a normal terminal with correct winner and full per-move audit',()=>{
 const t=P.trajectory('random',700000);assert.equal(Q.outcome(t.states.at(-1)),'normal-terminal');
 const choose=s=>{const i=t.states.findIndex(x=>Q.stateKey(x)===Q.stateKey(s));assert.ok(i>=12);
  return Q.moveVariants(s).find(m=>hash(Q.applyMove(s,m).state)===hash(t.states[i+1]));};
 const r=M.playGame(o,0,0,25,{players:{model:fake('model',choose),baseline:fake('baseline',choose)}});
 assert.equal(r.status,'normal-terminal');assert.equal(r.winner,t.states.at(-1).winner);M.auditGame(r,expected(r));
});
test('Safety stop outranks winner and repetition; pending is included in conservation/key',()=>{
 const s=clone(O.replayOpening(o).board);s.winner=0;s.reason='relay-limit';assert.equal(M.classify(s,new Set([O.physical(s)]),400,400),'safety-stop');
 const t=clone(s);t.reason='';assert.equal(M.classify(t,new Set([O.physical(t)]),400,400),'normal-terminal');
 const u=clone(O.replayOpening(o).board);u.reserve[0]--;u.pending[0]++;M.conservation(u);assert.notEqual(O.physical(u),O.physical(O.replayOpening(o).board));
});
test('Completed game checkpoints resume without any search, reject checksum/binding/environment/filename changes',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bao-equal-time-'));
 try{
  const a=M.runPilot(dir,25,{players:players()});assert.equal(a.checkpointReuse.generated,8);
  const never={analyzeMove(){throw Error('must not search');}},b=M.runPilot(dir,25,{players:{model:never,baseline:never}});
  assert.equal(b.checkpointReuse.generated,0);assert.equal(b.checkpointReuse.reused,8);assert.equal(a.recordsSha256,b.recordsSha256);
  assert.equal(M.auditPilot(dir,25).recordsSha256,a.recordsSha256);
  const file=path.join(dir,'pair-0-side-0.json'),original=fs.readFileSync(file,'utf8'),saved=JSON.parse(original);saved.record.steps[0].move.index=99;M.save(file,saved);
  assert.throws(()=>M.runPilot(dir,25,{players:players()}),/checksum|Expected values/);
  saved.sha256=hash(saved.record);M.save(file,saved);assert.throws(()=>M.runPilot(dir,25,{players:players()}));fs.writeFileSync(file,original);
  const bindingFile=path.join(dir,'binding.json'),binding=JSON.parse(fs.readFileSync(bindingFile));binding.environment.node='wrong';M.save(bindingFile,binding);
  assert.throws(()=>M.runPilot(dir,25,{players:players()}),/binding or environment/);
  binding.environment.node=M.environment().node;M.save(bindingFile,binding);
  const unknown=path.join(dir,'unexpected.json');M.save(unknown,{});assert.throws(()=>M.runPilot(dir,25,{players:players()}),/Unexpected/);fs.unlinkSync(unknown);
  fs.unlinkSync(file);const partial=M.runPilot(dir,25,{players:players()});assert.deepEqual(partial.checkpointReuse,{generated:1,reused:7});
 }finally{for(const f of fs.readdirSync(dir))fs.unlinkSync(path.join(dir,f));fs.rmdirSync(dir);}
});
test('Budget selection only uses operational gates; pilot summary never computes scores',()=>{
 const r=M.playGame(o,0,0,25,{players:players(),maximumPlies:1}),s=M.operationalSummary([r],25);
 assert.equal(s.strengthScoresComputed,false);assert.ok(!Object.hasOwn(s,'wins'));assert.equal(s.operationalPass,false);
 const summaries=O.spec.budgetsMs.map(b=>({scope:O.spec.scope,budgetMs:b,strengthScoresComputed:false,operationalPass:true,wins:b===25?999:0}));
 assert.equal(M.selectBudget(summaries),150);summaries[2].operationalPass=false;assert.equal(M.selectBudget(summaries),75);
 assert.throws(()=>M.selectBudget(summaries.slice(1)));summaries.forEach(x=>x.operationalPass=false);assert.throws(()=>M.selectBudget(summaries),/HOLD/);
});
test('Strength aggregation uses pairs and worst-case unresolved interval; missing/duplicate/unswapped pairs cannot pass',()=>{
 const make=(i,status='normal-terminal',win=true)=>[0,1].map(side=>({pairIndex:i,opening:{...o,group:hash(['test-group',i]),rootSha256:hash(['test-root',i])},
  budgetMs:150,modelSide:side,status,winner:status==='normal-terminal'?(win?side:1-side):null}));
 const pairs=Array.from({length:256},(_,i)=>make(i)),a=M.strengthSummary(pairs);assert.equal(a.status,'STRENGTH-GATE-PASS-NOT-PUBLIC-ADOPTION');
 assert.equal(a.inferenceUnit,'opening-pair-not-individual-game');assert.deepEqual(a.unresolvedUtilityMeanInterval,[1,1]);
 assert.ok(Math.abs(a.conditionalHoeffdingLowerBound-(1-Math.sqrt(Math.log(20)/512)))<1e-12);
 pairs[0]=make(0,'repetition');const b=M.strengthSummary(pairs);assert.deepEqual(b.unresolvedUtilityMeanInterval,[255/256,1]);
 assert.throws(()=>M.strengthSummary(pairs.slice(1)));pairs[1]=make(0);assert.throws(()=>M.strengthSummary(pairs));
 const bad=make(0);bad[1].modelSide=0;assert.throws(()=>M.strengthSummary([bad],{expectedPairs:1}));
 const duplicate=[make(0),make(1)];duplicate[1].forEach(g=>g.opening=duplicate[0][0].opening);assert.throws(()=>M.strengthSummary(duplicate,{expectedPairs:2}),/Duplicate/);
 const hold=M.strengthSummary(Array.from({length:256},(_,i)=>make(i,'safety-stop')));assert.equal(hold.status,'HOLD');assert.deepEqual(hold.unresolvedUtilityMeanInterval,[0,1]);
});
test('Freeze requires all pilot checkpoints and cannot run missing games',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bao-freeze-missing-'));
 try{assert.throws(()=>M.freezeFormal([dir,dir,dir],path.join(dir,'out')),/incomplete/);assert.equal(fs.readdirSync(dir).length,0);}
 finally{fs.rmdirSync(dir);}
});
