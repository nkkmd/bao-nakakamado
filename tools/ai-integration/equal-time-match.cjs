"use strict";
// MIT. Paired, equal-budget matches. Pilot summaries deliberately omit strength scores.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks'),{execFileSync}=require('node:child_process');
const O=require('./equal-time-openings.cjs'),F=require('./frozen-model-search.cjs');
const Core=require('../../prototype/model-search-ai.js'),H=require('../../prototype/search-evaluator.js');
const P=require('./learning-pipeline.cjs'),R=require('./formal-registry.cjs');
const {spec,hash,clone,E,Q,S}=O,root=path.resolve(__dirname,'../..');
const IDs={model:F.spec.evaluatorId,baseline:H.ID};
function sources(){return {...R.sourceHashes(),...Object.fromEntries([
 'prototype/model-search-ai.js','tools/ai-integration/frozen-model-search.cjs',
 'tools/ai-integration/formal-learning-evaluator.cjs','tools/ai-integration/model-search-spec.json',
 'tools/ai-integration/equal-time-openings.cjs','tools/ai-integration/equal-time-match.cjs','tools/ai-integration/equal-time-spec.json',
 'tools/ai-integration/formal-development-exclusions.json','tools/ai-integration/frozen-models/formal-v1-linear-2026100401/model.json'
 ].map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')]))};}
function environment(){return {node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model||'unknown',
 runnerImage:process.env.ImageVersion||null};}
function origin(){return {repository:process.env.GITHUB_REPOSITORY||'local',runId:process.env.GITHUB_RUN_ID||null,
 attempt:process.env.GITHUB_RUN_ATTEMPT||null,headSha:process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()};}
function preflight(){const connection=F.preflight();O.registry();assert.equal(E.RULES_VERSION,spec.rulesVersion);
 const sourceHashes=sources();return {connection,sourceHashes,fingerprint:hash({connection,sourceHashes}),environment:environment()};}
function options(budget){assert.ok(spec.budgetsMs.includes(budget));return {...spec.search,timeLimitMs:budget};}
function createPlayers(){const started=performance.now(),model=F.createEvaluator(),baseline=H.createEvaluator(Q);
 return {players:{model:Core.createAI(Q,{evaluator:model}),baseline:Core.createAI(Q,{evaluator:baseline})},
  setupMs:performance.now()-started};}
function conservation(s){assert.equal([...s.pits.flat(2),...s.reserve,...s.nyakuaReserve,...s.pending].reduce((a,b)=>a+b,0),64,'KETE conservation');}
function validateStats(st,actor,budget){
 assert.equal(st.searchId,Core.SEARCH_ID);assert.equal(st.evaluatorId,IDs[actor]);assert.equal(st.allocatedTimeMs,budget);
 for(const k of ['completedDepth','nodes','quiescenceNodes','safetyStops'])assert.ok(Number.isSafeInteger(st[k])&&st[k]>=0);
 assert.ok(st.completedDepth<=spec.search.maxDepth);assert.equal(typeof st.timedOut,'boolean');
 assert.ok(Number.isFinite(st.elapsedMs)&&st.elapsedMs>=0);
 assert.ok(st.completedDepth===0?st.rootScore===null:Number.isSafeInteger(st.rootScore)&&Math.abs(st.rootScore)<=1000000);
}
function classify(b,seen,plies,maximumPlies){
 if(Q.outcome(b)==='safety-stop')return 'safety-stop';
 if(Q.outcome(b)==='normal-terminal')return 'normal-terminal';
 if(seen.has(O.physical(b)))return 'repetition';
 if(plies>=maximumPlies)return 'maximum-plies';return null;
}
function playGame(opening,pairIndex,modelSide,budget,{players,maximumPlies=spec.maximumPlies,now=()=>performance.now()}={}){
 assert.ok(players?.model&&players?.baseline);assert.ok([0,1].includes(modelSide));options(budget);
 assert.ok(Number.isSafeInteger(maximumPlies)&&maximumPlies>0&&maximumPlies<=spec.maximumPlies);
 let game=O.replayOpening(opening);const initial=clone(game.board),steps=[],seen=new Set([O.physical(initial)]),started=now();
 let status=null,failure=null;
 while(!status){
  const b=game.board,actor=b.player===modelSide?'model':'baseline',before=hash(b),t=now();let code='search-exception';
  try{
   const r=players[actor].analyzeMove(b,options(budget)),wallMs=now()-t;
   code='input-mutation';assert.equal(hash(b),before);
   code='invalid-search-result';assert.equal(r.outcome,'ongoing');validateStats(r.stats,actor,budget);
   assert.ok(Number.isFinite(wallMs)&&wallMs>=0);
   code='illegal-move';assert.ok(S.moveVariants(game).some(m=>Core.moveKey(m)===Core.moveKey(r.move)),'Illegal match move');
   code='transition-mismatch';const next=S.apply(game,r.move),fast=Q.applyMove(b,r.move).state;
   assert.deepEqual(next.board,fast);conservation(next.board);
   const step={actor,player:b.player,move:r.move,beforeSha256:before,afterSha256:hash(next.board),
    summary:next.history.at(-1),stats:r.stats,scoreMeaning:r.scoreMeaning,wallMs};
   game=next;steps.push(step);status=classify(game.board,seen,steps.length,maximumPlies);seen.add(O.physical(game.board));
  }catch{
   // Retain a technical failure as measured; do not rerun or award it as a normal loss.
   game.board=clone(steps.length?replaySteps(opening,steps).board:initial);
   failure={code,actor,player:game.board.player,beforeSha256:before,wallMs:Math.max(0,now()-t)};status='technical-failure';
  }
 }
 return {pairIndex,modelSide,budgetMs:budget,maximumPlies,opening,initialSha256:hash(initial),steps,
  finalState:game.board,finalSha256:hash(game.board),status,winner:status==='normal-terminal'?game.board.winner:null,
  failure,elapsedMs:Math.max(0,now()-started)};
}
function replaySteps(opening,steps){let g=O.replayOpening(opening);
 for(const x of steps){assert.equal(hash(g.board),x.beforeSha256);assert.equal(g.board.player,x.player);
  assert.ok(S.moveVariants(g).some(m=>Core.moveKey(m)===Core.moveKey(x.move)));
  g=S.apply(g,x.move);assert.equal(hash(g.board),x.afterSha256);assert.deepEqual(g.history.at(-1),x.summary);conservation(g.board);}
 return g;
}
function auditGame(record,expected){
 for(const k of ['pairIndex','modelSide','budgetMs','maximumPlies','opening'])assert.deepEqual(record[k],expected[k],'Match binding '+k);
 assert.ok(Array.isArray(record.steps)&&record.steps.length<=record.maximumPlies);
 let g=O.replayOpening(record.opening),seen=new Set([O.physical(g.board)]),derived=null;
 assert.equal(hash(g.board),record.initialSha256);
 for(let i=0;i<record.steps.length;i++){
  assert.equal(derived,null,'Moves after a stop');const s=record.steps[i];assert.equal(s.actor,s.player===record.modelSide?'model':'baseline');
  validateStats(s.stats,s.actor,record.budgetMs);assert.ok(Number.isFinite(s.wallMs)&&s.wallMs>=0);
  assert.equal(hash(g.board),s.beforeSha256);assert.equal(s.player,g.board.player);
  assert.ok(S.moveVariants(g).some(m=>Core.moveKey(m)===Core.moveKey(s.move)));const next=S.apply(g,s.move);
  assert.deepEqual(next.board,Q.applyMove(g.board,s.move).state);g=next;
  assert.equal(hash(g.board),s.afterSha256);assert.deepEqual(g.history.at(-1),s.summary);conservation(g.board);
  derived=classify(g.board,seen,i+1,record.maximumPlies);seen.add(O.physical(g.board));
 }
 assert.deepEqual(g.board,record.finalState);assert.equal(hash(g.board),record.finalSha256);
 assert.ok(Number.isFinite(record.elapsedMs)&&record.elapsedMs>=0);
 if(record.status==='technical-failure'){
  assert.equal(derived,null);const f=record.failure;assert.ok(['search-exception','input-mutation','invalid-search-result','illegal-move','transition-mismatch'].includes(f?.code));
  assert.equal(f.beforeSha256,hash(g.board));assert.equal(f.player,g.board.player);assert.equal(f.actor,f.player===record.modelSide?'model':'baseline');
  assert.ok(Number.isFinite(f.wallMs)&&f.wallMs>=0);assert.equal(record.winner,null);
 }else{assert.equal(record.status,derived,'Stop reason');assert.equal(record.failure,null);
  assert.equal(record.winner,derived==='normal-terminal'?g.board.winner:null);}
 return record;
}
function save(file,value){const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value)+'\n');fs.renameSync(tmp,file);}
function quantile(xs,q){if(!xs.length)return null;const sorted=[...xs].sort((a,b)=>a-b);return sorted[Math.max(0,Math.ceil(q*sorted.length)-1)];}
function operationalSummary(games,budget){
 const summaries=Object.fromEntries(['model','baseline'].map(actor=>{const s=games.flatMap(g=>g.steps.filter(x=>x.actor===actor));
  const times=s.map(x=>x.wallMs),overruns=times.map(t=>Math.max(0,t-budget));return [actor,{moves:s.length,
   fallbackMoves:s.filter(x=>x.stats.completedDepth===0).length,fallbackFraction:s.length?s.filter(x=>x.stats.completedDepth===0).length/s.length:1,
   wallP50Ms:quantile(times,.5),wallP95Ms:quantile(times,.95),wallP99Ms:quantile(times,.99),maximumWallMs:quantile(times,1),
   overrunP99Ms:quantile(overruns,.99),maximumOverrunMs:quantile(overruns,1),
   completedDepthP50:quantile(s.map(x=>x.stats.completedDepth),.5),searchSafetyStops:s.reduce((n,x)=>n+x.stats.safetyStops,0)}];}));
 const statuses=games.reduce((a,g)=>(a[g.status]=(a[g.status]||0)+1,a),{}),sel=spec.selection;
 const gates={allEightGames:games.length===8,technicalFailures:(statuses['technical-failure']||0)<=sel.maximumTechnicalFailures,
  gameCost:games.every(g=>g.elapsedMs<=sel.maximumGameSeconds*1000),
  fallback:Object.values(summaries).every(s=>s.fallbackFraction<=sel.maximumFallbackFraction),
  p99Overrun:Object.values(summaries).every(s=>s.overrunP99Ms!==null&&s.overrunP99Ms<=sel.p99OverrunAllowanceMs),
  singleOverrun:Object.values(summaries).every(s=>s.maximumOverrunMs!==null&&s.maximumOverrunMs<=sel.maximumSingleOverrunMs)};
 return {scope:spec.scope,budgetMs:budget,games:games.length,statuses,actors:summaries,
  gameP95Seconds:quantile(games.map(g=>g.elapsedMs/1000),.95),maximumGameSeconds:quantile(games.map(g=>g.elapsedMs/1000),1),
  gates,operationalPass:Object.values(gates).every(Boolean),strengthScoresComputed:false};
}
function validateOrigin(o){assert.ok(o&&/^[a-f0-9]{40}$/.test(o.headSha));assert.ok(typeof o.repository==='string'&&o.repository.length>0);
 if(o.repository!=='local'){assert.equal(o.repository,'nkkmd/bao-nakakamado');assert.match(o.runId,/^[1-9][0-9]*$/);assert.match(o.attempt,/^[1-9][0-9]*$/);}}
function runPilot(directory,budget,{players,progress=()=>{}}={}){
 const p=preflight(),openings=O.pilotOpenings(),binding={designId:spec.id,fingerprint:p.fingerprint,environment:p.environment,
  budgetMs:budget,search:options(budget),maximumPlies:spec.maximumPlies,openingSha256:hash(openings)};
 fs.mkdirSync(directory,{recursive:true});const bindingFile=path.join(directory,'binding.json');
 if(fs.existsSync(bindingFile))assert.deepEqual(JSON.parse(fs.readFileSync(bindingFile)),binding,'Resume binding or environment changed');else save(bindingFile,binding);
 const known=new Set(['binding.json','summary.json',...openings.flatMap((o,i)=>[0,1].map(s=>`pair-${i}-side-${s}.json`))]);
 for(const name of fs.readdirSync(directory))assert.ok(known.has(name)||known.has(name.replace(/\.tmp$/,'')),'Unexpected checkpoint file');
 let setupMs=0;
 const games=[],reuse={generated:0,reused:0},currentOrigin=origin();validateOrigin(currentOrigin);
 for(let i=0;i<openings.length;i++)for(const side of (i%2?[1,0]:[0,1])){
  const file=path.join(directory,`pair-${i}-side-${side}.json`),expected={pairIndex:i,modelSide:side,budgetMs:budget,maximumPlies:spec.maximumPlies,opening:openings[i]};
  let record;
  if(fs.existsSync(file)){
   const saved=JSON.parse(fs.readFileSync(file));assert.equal(saved.bindingSha256,hash(binding));assert.equal(saved.sha256,hash(saved.record));validateOrigin(saved.origin);
   record=auditGame(saved.record,expected);reuse.reused++;
  }else{
   if(!players){const made=createPlayers();players=made.players;setupMs=made.setupMs;}
   record=playGame(openings[i],i,side,budget,{players});auditGame(record,expected);
   save(file,{bindingSha256:hash(binding),origin:currentOrigin,sha256:hash(record),record});reuse.generated++;
  }
  games.push(record);progress({pairIndex:i,modelSide:side,budgetMs:budget,status:record.status,plies:record.steps.length});
 }
 const summary={...operationalSummary(games,budget),binding,origin:currentOrigin,setupMs,checkpointReuse:reuse,
  recordsSha256:hash([...games].sort((a,b)=>a.pairIndex-b.pairIndex||a.modelSide-b.modelSide)),formalRowsRead:0,publicAdopted:false};
 save(path.join(directory,'summary.json'),summary);return summary;
}
function selectBudget(summaries){
 assert.deepEqual(summaries.map(s=>s.budgetMs).sort((a,b)=>a-b),spec.budgetsMs);
 assert.ok(summaries.every(s=>s.scope===spec.scope&&s.strengthScoresComputed===false));
 const pass=summaries.filter(s=>s.operationalPass);assert.ok(pass.length,'No operational budget qualifies: HOLD');return Math.max(...pass.map(s=>s.budgetMs));
}
function auditPilot(directory,budget){
 const p=preflight(),openings=O.pilotOpenings(),binding=JSON.parse(fs.readFileSync(path.join(directory,'binding.json')));
 const env=binding.environment;assert.ok(env&&typeof env.node==='string'&&typeof env.platform==='string'&&typeof env.arch==='string'&&typeof env.cpu==='string');
 assert.deepEqual(binding,{designId:spec.id,fingerprint:p.fingerprint,environment:env,budgetMs:budget,search:options(budget),
  maximumPlies:spec.maximumPlies,openingSha256:hash(openings)},'Pilot binding changed');
 const files=['binding.json','summary.json',...openings.flatMap((o,i)=>[0,1].map(s=>`pair-${i}-side-${s}.json`))];
 assert.deepEqual(fs.readdirSync(directory).sort(),[...files].sort(),'Incomplete or unexpected pilot files');
 const games=[],origins=[];
 for(let i=0;i<openings.length;i++)for(const side of [0,1]){
  const saved=JSON.parse(fs.readFileSync(path.join(directory,`pair-${i}-side-${side}.json`)));
  assert.equal(saved.bindingSha256,hash(binding));assert.equal(saved.sha256,hash(saved.record));validateOrigin(saved.origin);origins.push(saved.origin);
  games.push(auditGame(saved.record,{pairIndex:i,modelSide:side,budgetMs:budget,maximumPlies:spec.maximumPlies,opening:openings[i]}));
 }
 const computed={...operationalSummary(games,budget),binding,recordsSha256:hash(games)};
 const saved=JSON.parse(fs.readFileSync(path.join(directory,'summary.json')));
 for(const k of Object.keys(computed))assert.deepEqual(saved[k],computed[k],'Pilot summary mismatch '+k);
 validateOrigin(saved.origin);assert.ok(Number.isFinite(saved.setupMs)&&saved.setupMs>=0);assert.equal(saved.formalRowsRead,0);assert.equal(saved.publicAdopted,false);
 return {...computed,origins,formalRowsRead:0,publicAdopted:false};
}
// This is a conditional concentration bound for independent opening-pair draws.
// Fixed pseudorandom schedules and this engine's incompleteness limit generalization.
function strengthSummary(pairs,{expectedPairs=spec.formalDesign.pairs}={}){
 const d=spec.formalDesign;assert.equal(pairs.length,expectedPairs);
 const ids=new Set(),groups=new Set(),roots=new Set();let low=0,high=0,normal=0,technical=0;
 for(const pair of pairs){assert.equal(pair.length,2);assert.equal(pair[0].pairIndex,pair[1].pairIndex);
  assert.equal(hash(pair[0].opening),hash(pair[1].opening));assert.deepEqual(pair.map(g=>g.modelSide).sort(),[0,1]);
  assert.ok(Number.isSafeInteger(pair[0].pairIndex)&&pair[0].pairIndex>=0&&pair[0].pairIndex<d.pairs);
  assert.ok(!ids.has(pair[0].pairIndex));ids.add(pair[0].pairIndex);
  assert.ok(!groups.has(pair[0].opening.group)&&!roots.has(pair[0].opening.rootSha256),'Duplicate opening pair');
  groups.add(pair[0].opening.group);roots.add(pair[0].opening.rootSha256);
  assert.equal(pair[0].budgetMs,pair[1].budgetMs);
  for(const g of pair){if(g.status==='normal-terminal'){assert.ok([0,1].includes(g.winner));normal++;const v=Number(g.winner===g.modelSide);low+=v/2;high+=v/2;}
   else{assert.ok(['repetition','maximum-plies','safety-stop','technical-failure'].includes(g.status));high+=.5;technical+=g.status==='technical-failure';}}
 }
 const mean=low/pairs.length,upper=high/pairs.length,margin=Math.sqrt(Math.log(1/d.alpha)/(2*pairs.length)),lower=Math.max(0,mean-margin),completion=normal/(2*pairs.length);
 const gates={completeFixedSchedule:pairs.length===d.pairs,technicalFailures:technical===0,normalCompletion:completion>=d.minimumNormalCompletionFraction,
  conservativeMean:mean>=d.minimumConservativePairMean,conditionalLowerBound:lower>d.lowerBoundMustExceed};
 return {pairs:pairs.length,games:pairs.length*2,normalGames:normal,technicalFailures:technical,normalCompletionFraction:completion,
  unresolvedUtilityMeanInterval:[mean,upper],conditionalHoeffdingLowerBound:lower,alpha:d.alpha,inferenceUnit:d.inferenceUnit,
  gates,status:Object.values(gates).every(Boolean)?'STRENGTH-GATE-PASS-NOT-PUBLIC-ADOPTION':'HOLD',publicAdopted:false};
}
function freezeFormal(pilotDirectories,outputDirectory,{progress=()=>{}}={}){
 assert.equal(pilotDirectories.length,spec.budgetsMs.length);
 for(const dir of pilotDirectories)for(let i=0;i<spec.pilotOpenings.length;i++)for(const side of [0,1])
  assert.ok(fs.existsSync(path.join(dir,`pair-${i}-side-${side}.json`)),'Pilot is incomplete: freeze cannot generate missing games');
 // Audit on another host without invoking search or pretending to resume under a different environment.
 const summaries=pilotDirectories.map((dir,i)=>auditPilot(dir,spec.budgetsMs[i]));
 const budget=selectBudget(summaries),p=preflight(),manifest=O.formalOpenings({progress});
 const contract={id:spec.formalDesign.id,dateJST:'2026-10-05',status:'conditions-frozen-formal-matches-not-started',
  modelSha256:p.connection.modelSha256,baselineEvaluatorId:H.ID,searchId:Core.SEARCH_ID,
  fingerprint:p.fingerprint,sourceHashes:p.sourceHashes,clock:'real-monotonic-per-move-cooperative-deadline',
  timeLimitMs:budget,search:options(budget),maximumPlies:spec.maximumPlies,openingManifestSha256:hash(manifest),
  pilotBindings:summaries.map(s=>({budgetMs:s.budgetMs,bindingSha256:hash(s.binding),recordsSha256:s.recordsSha256,
   environment:s.binding.environment,origins:s.origins,operationalPass:s.operationalPass})),
  design:spec.formalDesign,gameAssignment:'same-root-two-games-model-south-and-model-north',
  executionOrder:'alternate-model-side-order-by-pair-index',shardAssignment:'pair-index-modulo-32',
  resumePolicy:'reuse-only-audited-completed-games-same-contract-source-environment-origin-and-checksum',
  interruptedGamePolicy:'HOLD-until-recorded-recovery-policy-no-silent-restart',formalRowsRead:0,formalGamesPlayed:0,publicAdopted:false};
 assert.ok(!fs.existsSync(outputDirectory),'Freeze requires a new directory');fs.mkdirSync(outputDirectory,{recursive:true});
 save(path.join(outputDirectory,'openings.json'),manifest);save(path.join(outputDirectory,'contract.json'),contract);
 return {contractSha256:hash(contract),openingManifestSha256:hash(manifest),fingerprint:p.fingerprint,timeLimitMs:budget,
  pairs:manifest.openings.length,games:spec.formalDesign.games,exclusions:manifest.exclusions,formalRowsRead:0,formalGamesPlayed:0};
}
if(require.main===module){try{
 const [command,...args]=process.argv.slice(2),progress=x=>console.log(JSON.stringify(x));
 if(command==='pilot'&&args.length===2)console.log(JSON.stringify(runPilot(path.resolve(args[1]),Number(args[0]),{progress}),null,2));
 else if(command==='freeze'&&args.length===4)console.log(JSON.stringify(freezeFormal(args.slice(0,3).map(x=>path.resolve(x)),path.resolve(args[3]),{progress}),null,2));
 else throw Error('Usage: pilot BUDGET DIRECTORY | freeze PILOT25 PILOT75 PILOT150 NEW_DIRECTORY');
 }catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={spec,IDs,options,sources,environment,origin,preflight,createPlayers,conservation,validateStats,classify,playGame,replaySteps,auditGame,
 save,quantile,operationalSummary,runPilot,auditPilot,selectBudget,strengthSummary,freezeFormal};
