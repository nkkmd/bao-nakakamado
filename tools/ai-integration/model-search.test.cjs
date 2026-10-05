"use strict";
// MIT. Correctness of fixed-model search, separate ordinary-transition minimax and budget handling.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const F=require('./frozen-model-search.cjs'),Core=require('../../prototype/model-search-ai.js');
const Teacher=require('../../prototype/search-ai.js'),E=require('../../prototype/next-turn-engine.js');
const Q=require('../../prototype/search-transition.js').createForEngine(E),S=require('../../prototype/steal.js').createForEngine(E);
const M=require('./formal-learning-evaluator.cjs'),Oracle=require('./model-search-oracle.cjs');
const rows=require('./model-search-corpus.cjs').corpus(),AI=F.createAI({now:()=>0}),V=F.createEvaluator();
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const swapped=s=>({...structuredClone(s),pits:[s.pits[1],s.pits[0]],reserve:[s.reserve[1],s.reserve[0]],
 nyakuaReserve:[s.nyakuaReserve[1],s.nyakuaReserve[0]],pending:[s.pending[1],s.pending[0]],
 houseOwned:[s.houseOwned[1],s.houseOwned[0]],player:1-s.player,winner:s.winner===null?null:1-s.winner});
test('Original teacher algorithm stays byte-identical; fork only adds the evaluator seam and integer guard',()=>{
 const old=fs.readFileSync(require.resolve('../../prototype/search-ai.js'),'utf8'),fork=fs.readFileSync(require.resolve('../../prototype/model-search-ai.js'),'utf8');
 const section=s=>s.slice(s.indexOf('    function analyzeMove('),s.indexOf('    return Object.freeze({SEARCH_ID'));
 const normalized=section(fork).replace('        const value = V.evaluate(b, player, check);\n        const bound = Q.outcome(b) === "normal-terminal" ? WIN : 100_000;\n        if (!Number.isSafeInteger(value) || Math.abs(value) > bound) throw new Error("Invalid heuristic integer score");\n        stats.evaluations++; check();','        const value = V.evaluate(b, player, check); stats.evaluations++; check();');
 assert.equal(normalized,section(old));assert.deepEqual(Core.DEFAULTS,Teacher.DEFAULTS);F.preflight();
});
test('Fixed model bytes, successful final binding and model identity are mandatory',()=>{
 const bytes=fs.readFileSync(require.resolve('./frozen-models/formal-v1-linear-2026100401/model.json'));
 assert.equal(F.checkModelBytes(bytes).seed,2026100401);
 assert.throws(()=>F.checkModelBytes(Buffer.concat([bytes,Buffer.from(' ')])),/bytes changed/);
 assert.throws(()=>F.createAI({model:'other'}),/constructor option/);assert.throws(()=>F.createAI({now:1}));
 assert.equal(F.preflight().formalRowsRead,0);assert.equal(F.preflight().publicAdopted,false);
});
test('Ongoing encoding preserves every fixed integer output and side antisymmetry',()=>{
 const interpreter=M.createEvaluator(require('./frozen-models/formal-v1-linear-2026100401/model.json'));
 for(const {state} of rows){const s=freeze(structuredClone(state)),before=JSON.stringify(s),p=s.player,value=V.evaluate(s,p);
  assert.equal(value,interpreter.evaluate(s,p));assert.equal(V.evaluate(s,1-p),-value||0);
  assert.equal(V.evaluate(swapped(s),1-p),value);assert.ok(Math.abs(value)<=1024);assert.equal(JSON.stringify(s),before);}
 const bad=structuredClone(rows[0].state);bad.pending[0]=1;assert.throws(()=>V.evaluate(bad));
 assert.throws(()=>V.evaluate(rows[0].state,2));
});
test('The new core with handcrafted evaluation reproduces the frozen teacher search exactly',()=>{
 const handcrafted=require('../../prototype/search-evaluator.js').createEvaluator(Q);
 const fork=Core.createAI(Q,{now:()=>0,evaluator:handcrafted}),teacher=Teacher.createAI(Q,{now:()=>0});
 for(const row of [rows[0],rows.find(r=>r.tags.reservedOnly),rows.find(r=>r.tags.mtaji)]){
  const a=fork.analyzeMove(row.state,{maxDepth:3}),b=teacher.analyzeMove(row.state,{maxDepth:3});a.stats.searchId=b.stats.searchId;
  assert.deepEqual(a,b);}
});
test('Independent ordinary-transition minimax agrees at depth four including compulsory capture extension',()=>{
 for(const row of [rows[0],rows.find(r=>r.tags.reservedOnly),rows.find(r=>r.tags.twoPlacement)]){
  const before=JSON.stringify(row.state),expected=Oracle.solve(row.state,4,1);
  const r=AI.analyzeMove(freeze(structuredClone(row.state)),{maxDepth:4,quiescenceDepth:1});
  assert.equal(r.stats.rootScore,expected.score);assert.equal(r.stats.completedDepth,4);
  assert.ok(expected.bestMoves.some(m=>AI.moveKey(m)===AI.moveKey(r.move)));assert.equal(JSON.stringify(row.state),before);}
});
test('Normal terminal pending bypasses encoding and keeps mate distance above all model scores',()=>{
 const b=E.initialState(),removed=b.pits[1][0].reduce((a,n)=>a+n,0)-1;
 b.pits[1][0]=[0,0,0,1,0,0,0,0];b.pits[1][1][0]+=removed;
 const r=AI.analyzeMove(b,{maxDepth:3});assert.equal(r.stats.rootScore,999999);
 const after=S.apply({board:b,history:[]},r.move).board;assert.equal(after.winner,0);assert.ok(after.pending[0]>0);
 assert.equal(AI.analyzeMove(after).stats.rootScore,1000000);assert.equal(V.evaluate(after,0),1000000);
 assert.equal(V.evaluate(after,1),-1000000);assert.equal(AI.analyzeMove(after).move,null);
});
test('Known relay safety stop stays unresolved neutral at both a leaf and terminal root',()=>{
 const record=require('../nyakua-three/results/anomalies/self-random-three-3435580265-game.json');
 const entries=record.path.map(s=>s.entry),b=S.replay(entries.slice(0,-1)).board;
 const r=AI.analyzeMove(b,{maxDepth:1,quiescenceDepth:0}),expected=Oracle.solve(b,1,0);
 assert.equal(r.stats.rootScore,expected.score);assert.ok(r.stats.safetyStops>0);assert.match(r.scoreMeaning,/unresolved/);
 const stopped=S.apply({board:b,history:[]},entries.at(-1).move).board,result=AI.analyzeMove(stopped);
 assert.equal(result.move,null);assert.equal(result.stats.rootScore,0);assert.equal(V.evaluate(stopped,0),0);assert.equal(V.evaluate(stopped,1),0);
});
test('Fake deadlines, including aspiration re-search, return only a legal fallback or a fully completed depth',()=>{
 const b=rows.find(r=>r.tags.threePlacement).state;let completed=0,interrupted=0;
 for(const limit of [0,20,100,300,800,1600,4000,10000]){
  let ticks=0;const timed=F.createAI({now:()=>ticks++}),r=timed.analyzeMove(b,{maxDepth:4,timeLimitMs:limit,quiescenceDepth:0,aspirationWindow:1});
  assert.ok(Q.moveVariants(b).some(m=>AI.moveKey(m)===AI.moveKey(r.move)));interrupted+=r.stats.timedOut;
  if(r.stats.completedDepth){const ref=Oracle.solve(b,r.stats.completedDepth,0);completed++;
   assert.equal(r.stats.rootScore,ref.score);assert.ok(ref.bestMoves.some(m=>AI.moveKey(m)===AI.moveKey(r.move)));}
  else{assert.equal(r.stats.rootScore,null);assert.equal(r.scoreMeaning,'unscored-fallback');}
 }
 assert.ok(completed>0&&interrupted>0);
});
test('A check during model evaluation interrupts; evaluator or engine errors are never disguised as timeout',()=>{
 let expire=false;const timed=Core.createAI(Q,{now:()=>expire?100:0,evaluator:{...V,evaluate:(b,p,check)=>{expire=true;check();return V.evaluate(b,p);}}});
 const r=timed.analyzeMove(rows[0].state,{maxDepth:2,timeLimitMs:50});assert.equal(r.stats.timedOut,true);assert.equal(r.stats.completedDepth,0);assert.equal(r.stats.rootScore,null);
 const broken=Core.createAI(Q,{now:()=>0,evaluator:{...V,evaluate:()=>{throw Error('model-error');}}});
 assert.throws(()=>broken.analyzeMove(rows[0].state),/model-error/);
 const engine=Core.createAI({...Q,applyMove:()=>{throw Error('engine-error');}},{now:()=>0,evaluator:V});
 assert.throws(()=>engine.analyzeMove(rows[0].state),/engine-error/);
 for(const value of [NaN,0.5,100001]){const bad=Core.createAI(Q,{now:()=>0,evaluator:{...V,evaluate:()=>value}});assert.throws(()=>bad.analyzeMove(rows[0].state),/integer score/);}
 assert.throws(()=>Core.createAI(Q,{evaluator:{...V,WIN:1024}}),/terminal scale/);
});
test('Tables and evaluation caches are bounded and are reset between model searches',()=>{
 const options={maxDepth:3,maxTableEntries:2,maxEvaluationCacheEntries:2,historyHeuristic:true,aspirationWindow:1};
 const r=AI.analyzeMove(rows[0].state,options),again=AI.analyzeMove(rows[0].state,options);assert.deepEqual(r,again);
 assert.ok(r.stats.cachePeak<=2&&r.stats.evaluationCachePeak<=2);assert.ok(r.stats.evaluationCacheEvictions>0);
 const ref=Oracle.solve(rows[0].state,3,1);assert.equal(r.stats.rootScore,ref.score);
});
test('Side exchange preserves model-search score and membership of the exhaustive best-move set',()=>{
 for(const row of [rows[0],rows.find(r=>r.tags.twoPlacement),rows.find(r=>r.tags.mtaji)]){
  const b=swapped(row.state),a=AI.analyzeMove(row.state,{maxDepth:3}),r=AI.analyzeMove(b,{maxDepth:3}),ref=Oracle.solve(b,3,1);
  assert.equal(r.stats.rootScore,a.stats.rootScore);assert.equal(r.stats.rootScore,ref.score);
  assert.ok(ref.bestMoves.some(m=>AI.moveKey(m)===AI.moveKey(r.move)));}
});
test('Browser script core exposes the same evaluator-injected search; public index remains unchanged',()=>{
 const context={window:{},performance:{now:()=>0}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../../prototype/model-search-ai.js'),'utf8'),context);
 const r=context.window.NakakamadoModelSearchAI.createAI(Q,{now:()=>0,evaluator:V}).analyzeMove(rows[0].state,{maxDepth:2});
 assert.deepEqual(JSON.parse(JSON.stringify(r)),AI.analyzeMove(rows[0].state,{maxDepth:2}));
 assert.ok(!/model-search|frozen-models/.test(fs.readFileSync(require.resolve('../../prototype/index.html'),'utf8')));
});
