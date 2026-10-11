'use strict';
// MIT. Research controls, exact tie scores, mirrored seats and failure recovery.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const C=require('./core.cjs'),{run,pilotContract}=require('./run.cjs'),O=require('./oracle.cjs');
const A=C.Research.createAI(C.Q,{now:()=>0}),P=C.Public.createAI(C.Q,{now:()=>0});
const keyed=rows=>Object.fromEntries(rows.map(r=>[C.Public.moveKey(r.move),r.score]));
test('generated research core has no drift from the frozen public derivation',()=>{
  const before=fs.readFileSync(path.join(__dirname,'research-search.cjs'));
  require('node:child_process').execFileSync('python3',[path.join(__dirname,'generate-search.py')]);
  assert.deepEqual(fs.readFileSync(path.join(__dirname,'research-search.cjs')),before);
});
test('disabled research controls preserve the public scores, moves and node counts',()=>{
  for(const b of [C.E.initialState(),C.e30(),C.mirror(C.e30())])for(const depth of [1,2,3]){
    const x=A.analyzeMove(b,{maxDepth:depth}),y=P.analyzeMove(b,{maxDepth:depth});
    assert.deepEqual(x.move,y.move);for(const k of ['nodes','rootScore','completedDepth'])assert.equal(x.stats[k],y.stats[k]);
  }
});
test('ALL root scores are exact, with pruning, quiescence, tiny caches and seed choices',()=>{
  for(const b of [C.E.initialState(),C.e30(),C.mirror(C.e30())])for(const depth of [1,2,3])for(const q of [0,1]){
    const oracle=O.solve(b,depth,q),best=Math.max(...oracle.map(x=>x.score));
    for(const opt of [{},{pvs:false,transpositionTable:false,evaluationCache:false},
      {maxTableEntries:2,maxEvaluationCacheEntries:2,aspirationWindow:1,ttMoveFirst:true,historyHeuristic:true}])for(const seed of [0,11]){
      const r=A.analyzeMove(b,{...opt,maxDepth:depth,exactRoot:true,tieSeed:seed,quiescenceDepth:q});
      assert.deepEqual(keyed(r.stats.exactRootScores),keyed(oracle));assert.equal(r.stats.rootScore,best);
      assert.equal(keyed(oracle)[C.Public.moveKey(r.move)],best);
    }
  }
});
test('node limits never leak partial root scores and mirror uses same tie choices',()=>{
  for(const b of [C.E.initialState(),C.e30()])for(const budget of [1,10,50,200,512,2048]){
    const options={maxDepth:32,maxNodes:budget,exactRoot:true,tieSeed:17,quiescenceDepth:1};
    const r=A.analyzeMove(b,options),z=A.analyzeMove(C.mirror(b),options);
    assert.ok(r.stats.nodes<=budget);assert.deepEqual(r.move,z.move);
    for(const k of ['rootScore','completedDepth','nodes','exactRootScores'])assert.deepEqual(r.stats[k],z.stats[k]);
    const again=A.analyzeMove(b,options);assert.deepEqual(r,again);
    if(r.stats.completedDepth)assert.deepEqual(keyed(r.stats.exactRootScores),keyed(O.solve(b,r.stats.completedDepth,1)));
    else {assert.equal(r.stats.rootScore,null);assert.equal(r.stats.exactRootScores,null);}
  }
});
test('seeds choose several exact ties without selecting a weaker root move',()=>{
  const b=C.E.initialState(),moves=new Set();let tied=null;
  for(let depth=1;depth<=3;depth++){const rows=O.solve(b,depth,0),best=Math.max(...rows.map(x=>x.score));
    if(rows.filter(r=>r.score===best).length>1){tied={depth,best};break;}}
  // Use an explicitly symmetric toy Q with two equal legal outcomes if this
  // initial placement happens not to contain a tie at these depths.
  if(tied){for(let seed=0;seed<32;seed++)moves.add(C.Public.moveKey(A.chooseMove(b,{maxDepth:tied.depth,quiescenceDepth:0,exactRoot:true,tieSeed:seed})));assert.ok(moves.size>1);}
  const tiny={...C.Q,moveVariants:state=>state.turn===1?[{type:'pass',index:0},{type:'pass',index:1}]:[],
    applyMove:(state,m)=>({state:{...state,turn:2,winner:state.player,reason:'test-terminal'},events:[],summary:{}})};
  const ai=C.Research.createAI(tiny,{now:()=>0});const keys=new Set();
  for(let seed=0;seed<32;seed++){const r=ai.analyzeMove(b,{maxDepth:1,exactRoot:true,tieSeed:seed});keys.add(r.move.index);assert.equal(r.stats.rootScore,999999);}
  assert.equal(keys.size,2);
});
test('completed checkpoints resume with zero new games; tampering and interrupted pairs HOLD',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v010-balance-test-'));
  const contract={...pilotContract,profiles:[{id:'simple-test',kind:'simple'}],pairsPerProfile:1,maxPlies:100};
  const a=run(dir,contract);assert.equal(a.newPairs,1);
  const b=run(dir,contract);assert.equal(b.newPairs,0);assert.equal(b.reusedPairs,1);
  const file=path.join(dir,'simple-test-2026101100.json'),bytes=fs.readFileSync(file),row=JSON.parse(bytes);
  row.games[0].turns[0].summary.placed++;fs.writeFileSync(file,JSON.stringify(row));assert.throws(()=>run(dir,contract));
  fs.writeFileSync(file,bytes);const changed={...contract,maxPlies:101};assert.throws(()=>run(dir,changed));
  fs.unlinkSync(file);assert.throws(()=>run(dir,contract),/HOLD interrupted/);
  fs.rmSync(dir,{recursive:true});
});
test('both seats replay from explicit initial board; legal but falsified results are rejected',()=>{
  const profile={id:'test',kind:'research',nodes:512};
  const games=[0,1].map(first=>C.play(profile,2026101199,first,{maxPlies:100}));
  for(const g of games)C.auditGame(g,{profile,checkSearch:true});
  assert.deepEqual(games[1].final,C.mirror(games[0].final));assert.equal(games[0].trajectory,games[1].trajectory);
  const bad=C.E.clone(games[1]);bad.turns[0].after+='x';assert.throws(()=>C.auditGame(bad));
});
test('invalid budgets and seeds fail explicitly',()=>{
  for(const opt of [{maxNodes:-1},{maxNodes:1.5},{tieSeed:-1},{exactRoot:1}])assert.throws(()=>A.analyzeMove(C.E.initialState(),opt),/option/);
});
test('uncertainty uses seed-pairs, retains all unresolved games and cannot collapse to zero',()=>{
  const {summarize}=require('./stats.cjs');
  const balanced=summarize(Array.from({length:4096},()=>[{firstWin:1},{firstWin:0}]));
  assert.equal(balanced.normalFirstWinRate,.5);assert.equal(balanced.direction,'UNDETERMINED');assert.ok(balanced.practicalBalanceSupported);
  assert.ok(balanced.hoeffdingRadius>.02&&balanced.hoeffdingRadius<.03);
  const unresolved=summarize(Array.from({length:4096},()=>[{firstWin:null},{firstWin:null}]));
  assert.deepEqual(unresolved.conservativeInterval,[0,1]);assert.equal(unresolved.normalFirstWinRate,null);
  const win=summarize(Array.from({length:4096},()=>[{firstWin:1},{firstWin:1}]));assert.equal(win.direction,'FIRST');assert.ok(!win.practicalBalanceSupported);
  assert.ok(summarize(Array.from({length:512},()=>[{firstWin:1},{firstWin:0}]),.025).hoeffdingRadius>balanced.hoeffdingRadius);
});
test('formal shards reject missing, modified and interrupted data and aggregate without new games',()=>{
  const F=require('./formal.cjs'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'v010-formal-test-'));
  const m={digest:'test-only',contract:{seedDomain:'test-only',maxPlies:1,shards:2,
    profiles:[{id:'tiny',kind:'research',nodes:32,pairs:2,role:'primary'}]}};
  for(const i of [0,1]){assert.equal(F.shard(dir,i,m).newPairs,1);assert.equal(F.shard(dir,i,m).newPairs,0);}
  const r=F.aggregate(dir,m);assert.equal(r.profiles[0].games,4);assert.equal(r.profiles[0].unresolved,4);
  const file=path.join(dir,'tiny-0.json.gz'),bytes=fs.readFileSync(file);
  fs.writeFileSync(file,Buffer.from('bad'));assert.throws(()=>F.aggregate(dir,m));fs.writeFileSync(file,bytes);
  const row=JSON.parse(require('node:zlib').gunzipSync(bytes));row.games[0].turns=[];row.games[0].final=row.games[0].start;
  row.checksum=C.hash(row.games);assert.throws(()=>F.audit(row,m,F.tasks(m)[0]));
  fs.unlinkSync(file);assert.throws(()=>F.shard(dir,0,m),/HOLD interrupted/);assert.throws(()=>F.aggregate(dir,m));
  fs.rmSync(dir,{recursive:true});
});
