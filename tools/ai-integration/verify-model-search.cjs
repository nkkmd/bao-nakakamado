"use strict";
// MIT. Read-only engineering verification on previously excluded development roots.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),os=require('node:os');
const F=require('./frozen-model-search.cjs'),A=require('./formal-collection.cjs'),I=require('./learning-input.cjs');
const C=require('./model-search-corpus.cjs'),Oracle=require('./model-search-oracle.cjs'),R=require('./formal-final-runner.cjs');
const E=require('../../prototype/next-turn-engine.js'),Q=require('../../prototype/search-transition.js').createForEngine(E);
const spec=F.spec,repo=path.resolve(__dirname,'../..');
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
function verify(directory){
 assert.ok(typeof directory==='string'&&!fs.existsSync(directory),'Fresh verification directory required');
 const binding=F.preflight(),rows=C.corpus(),ai=F.createAI({now:()=>0}),evaluations=[],views=[];
 for(const row of rows)for(const perspective of [0,1]){
  const state=freeze(row.state);views.push({input:I.encode(state,perspective),opponentInput:I.encode(state,1-perspective)});
  evaluations.push(ai.evaluate(state,perspective));assert.equal(ai.evaluate(state,1-perspective),-evaluations.at(-1)||0);
 }
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'bao-model-search-'));let pythonComparisons;
 try{
  const file=path.join(temp,'excluded-development-views.json');fs.writeFileSync(file,JSON.stringify(views),{mode:0o600});
  const proc=cp.spawnSync('python3',[path.join(__dirname,'formal-learning-predict.py'),path.join(repo,require('./formal-final-spec.json').candidate.directory,'model.json'),file],{encoding:'utf8',maxBuffer:8*1024*1024,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
  assert.equal(proc.status,0,'Independent Python prediction failed');const expected=JSON.parse(proc.stdout);assert.deepEqual(evaluations,expected);
  pythonComparisons=expected.length;
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
 const coverage=Object.fromEntries(spec.requiredCoverage.map(k=>[k,rows.filter(r=>r.tags[k]).length]));
 const trace=[],counters={comparisons:0,oracleNodes:0,candidateNodes:0,cacheHits:0,evaluationCacheHits:0,pvsResearches:0,aspirationResearches:0,safetyStopComparisons:0};
 for(const row of rows){const before=JSON.stringify(row.state);
  for(const depth of spec.depths)for(const quiescenceDepth of spec.quiescenceDepths){
   const expected=Oracle.solve(row.state,depth,quiescenceDepth);counters.oracleNodes+=expected.nodes;
   for(let preset=0;preset<spec.presets.length;preset++){
    const r=ai.analyzeMove(row.state,{...spec.presets[preset],maxDepth:depth,quiescenceDepth});
    assert.equal(r.stats.completedDepth,depth);assert.equal(r.stats.timedOut,false);assert.equal(r.stats.evaluatorId,spec.evaluatorId);
    assert.equal(r.stats.rootScore,expected.score,'Model search differs from exhaustive minimax');
    assert.ok(expected.bestMoves.some(m=>ai.moveKey(m)===ai.moveKey(r.move)),'Move outside exhaustive best set');
    assert.ok(Q.moveVariants(row.state).some(m=>ai.moveKey(m)===ai.moveKey(r.move)),'Illegal result');assert.equal(JSON.stringify(row.state),before);
    counters.comparisons++;counters.candidateNodes+=r.stats.nodes;
    for(const k of ['cacheHits','evaluationCacheHits','pvsResearches','aspirationResearches'])counters[k]+=r.stats[k];
    counters.safetyStopComparisons+=Number(r.stats.safetyStops>0);
    trace.push({id:row.id,depth,quiescenceDepth,preset,score:expected.score,selected:r.move,nodes:r.stats.nodes,safetyStops:r.stats.safetyStops});
   }
  }
 }
 for(const k of ['cacheHits','evaluationCacheHits','pvsResearches','aspirationResearches'])assert.ok(counters[k]>0,'Optimization unexercised: '+k);
 const timings=[],timed=F.createAI();
 for(const row of rows.slice(0,spec.timingSmoke.positions))for(const limit of spec.timingSmoke.timeLimitMs){
  const r=timed.analyzeMove(row.state,{maxDepth:spec.timingSmoke.maxDepth,timeLimitMs:limit});
  assert.ok(Q.moveVariants(row.state).some(m=>ai.moveKey(m)===ai.moveKey(r.move)));
  if(!r.stats.completedDepth)assert.equal(r.stats.rootScore,null);
  timings.push({id:row.id,timeLimitMs:limit,elapsedMs:r.stats.elapsedMs,completedDepth:r.stats.completedDepth,timedOut:r.stats.timedOut});
 }
 const files=['prototype/model-search-ai.js','tools/ai-integration/frozen-model-search.cjs','tools/ai-integration/model-search-spec.json',
  'tools/ai-integration/model-search-corpus.cjs','tools/ai-integration/model-search-oracle.cjs','tools/ai-integration/model-search.test.cjs','tools/ai-integration/verify-model-search.cjs'];
 const sources=Object.fromEntries(files.map(p=>[p,A.shaBytes(fs.readFileSync(path.join(repo,p)))]));
 const result={schema:1,status:'PASS-DEVELOPMENT-MODEL-SEARCH-NOT-PUBLIC-ADOPTION',...binding,rulesVersion:E.RULES_VERSION,
  runnerFingerprint:R.fingerprint(),sources,connectionFingerprint:A.hash({spec,sources,modelSha256:binding.modelSha256}),
  developmentRootPositions:rows.length,excludedRootPositions:rows.length,normalReplayRootPositions:rows.length,
  corpusDigest:A.hash(rows),coverage,...counters,pythonNodeIntegerComparisons:pythonComparisons,integerMismatches:0,
  antisymmetryComparisons:rows.length,scoreMismatches:0,nonOptimalMoves:0,illegalMoves:0,inputMutations:0,
  formalFinalReopened:false,retuning:false,alternativeCandidateEvaluation:false,strengthTested:false,deviceTested:false,
  traceSha256:A.shaBytes(Buffer.from(trace.map(r=>JSON.stringify(r)+'\n').join(''))),
  environment:{node:process.version,...R.pythonEnvironment()},samples:rows.map(({state,...meta})=>meta),timings};
 A.atomic(path.join(directory,'verification.json'),result);return result;
}
if(require.main===module){const r=verify(process.argv[2]);const {sources,samples,timings,...summary}=r;console.log(JSON.stringify({...summary,timingRuns:timings.length}));}
module.exports={verify};
