"use strict";
// MIT. Resumable operational pilot. These development openings and outcomes
// are excluded from the later independent adoption comparison.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const E=require('../prototype/end-pit-engine.js'),S=require('../prototype/end-pit-rules.js');
const Q=require('../prototype/end-pit-search-transition.js').createForEngine(E);
const F=require('../prototype/end-pit-search-ai.js'),A=F.createAI(Q);
const Simple=require('../prototype/end-pit-simple-ai.js').createAI(Q);
const root=path.resolve(__dirname,'..'),out=process.argv[2]||'/tmp/v010-search-pilot';fs.mkdirSync(out,{recursive:true});
const hash=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const sources=['prototype/end-pit-engine.js','prototype/end-pit-rules.js','prototype/end-pit-search-transition.js','prototype/end-pit-search-ai.js','prototype/end-pit-search-evaluator.js','prototype/end-pit-simple-ai.js','tools/end-pit-search-pilot.cjs'];
const sourceSha256=Object.fromEntries(sources.map(p=>[p,hash(fs.readFileSync(path.join(root,p),'utf8'))]));
const contract={id:'NAKAKAMADO-V010-OPERATIONAL-PILOT-v1',rulesVersion:E.RULES_VERSION,developmentOnly:true,
  seedStart:2026100920,budgets:[25,75,150],pairsPerBudget:4,maxPlies:200,maxDepth:32,quiescenceDepth:1,sourceSha256};
const fingerprint=hash(contract),quantile=(a,p)=>a.length?[...a].sort((x,y)=>x-y)[Math.ceil(a.length*p)-1]:null;
function opening(seed,steps) {
  let game=S.initialGame(),n=seed>>>0;
  for(let ply=0;ply<steps&&game.board.winner===null;ply++) {
    n=(Math.imul(n,1664525)+1013904223)>>>0;const moves=Q.moveVariants(game.board);
    game=S.apply(game,moves[Math.floor(n/4294967296*moves.length)]);
  }
  return game;
}
function play(start,searchPlayer,budgetMs) {
  let game=E.clone(start);const turns=[];
  for(let ply=0;ply<contract.maxPlies&&Q.outcome(game.board)==='ongoing';ply++) {
    const b=game.board,before=JSON.stringify(b),started=performance.now();
    const r=b.player===searchPlayer?A.analyzeMove(b,{timeLimitMs:budgetMs,maxDepth:32}):{move:Simple.chooseMove(b),stats:null};
    const elapsedMs=performance.now()-started;
    assert.ok(Q.moveVariants(b).some(m=>F.moveKey(m)===F.moveKey(r.move)));assert.equal(JSON.stringify(b),before);
    const next=Q.applyMove(b,r.move).state;game=S.apply(game,r.move);assert.deepEqual(game.board,next);
    assert.equal([...next.pits.flat(2),...next.reserve,...next.nyakuaReserve,...next.pending].reduce((a,n)=>a+n,0),64);
    turns.push({ply:game.history.length,player:b.player,search:b.player===searchPlayer,elapsedMs,stats:r.stats});
  }
  const record=S.record(game,{mode:'computer'});record.computer={id:'development-v010-pair',searchPlayer,budgetMs,learnedModel:false};
  assert.deepEqual(S.replay(record),game);
  return {searchPlayer,record,turns,outcome:Q.outcome(game.board)};
}
let newPairs=0,reusedPairs=0;const pairs=[],seen=new Set();
for(const budgetMs of contract.budgets)for(let i=0;i<contract.pairsPerBudget;i++) {
  const id=`${budgetMs}-${i}`,start=opening(contract.seedStart+contract.budgets.indexOf(budgetMs)*100+i,6+i*3);
  assert.equal(Q.outcome(start.board),'ongoing');const rootKey=Q.stateKey(start.board);assert.ok(!seen.has(rootKey));seen.add(rootKey);
  const file=path.join(out,`pair-${id}.json`);let row;
  if(fs.existsSync(file)) {
    row=JSON.parse(fs.readFileSync(file));assert.equal(row.fingerprint,fingerprint);assert.equal(row.rootKey,rootKey);
    assert.equal(row.checksum,hash(row.payload));for(const g of row.payload.games)S.replay(g.record);reusedPairs++;
  } else {
    const games=[0,1].map(p=>play(start,p,budgetMs));const payload={budgetMs,games};
    row={id,fingerprint,rootKey,payload,checksum:hash(payload)};
    fs.writeFileSync(file+'.tmp',JSON.stringify(row,null,2)+'\n');fs.renameSync(file+'.tmp',file);newPairs++;
  }
  pairs.push(row);console.log(JSON.stringify({pair:id,newPairs,reusedPairs}));
}
const reports=contract.budgets.map(budgetMs=>{
  const games=pairs.filter(x=>x.payload.budgetMs===budgetMs).flatMap(x=>x.payload.games);
  const turns=games.flatMap(g=>g.turns.filter(t=>t.search)),times=turns.map(t=>t.elapsedMs),depths=turns.map(t=>t.stats.completedDepth);
  const normal=games.filter(g=>g.outcome==='normal-terminal'),wins=normal.filter(g=>g.record.outcome.winner===g.searchPlayer).length;
  const unresolved=games.length-normal.length;
  const r={budgetMs,games:games.length,wins,losses:normal.length-wins,safetyStops:games.filter(g=>g.outcome==='safety-stop').length,
    unfinished:games.filter(g=>g.outcome==='ongoing').length,searchMoves:turns.length,depthZero:depths.filter(d=>d===0).length,
    p50Ms:quantile(times,.5),p95Ms:quantile(times,.95),maxMs:Math.max(...times),medianDepth:quantile(depths,.5),
    conservativeScoreInterval:[wins/games.length,(wins+unresolved)/games.length]};
  // Operational budget choice uses only depth/latency, never the observed wins.
  r.operationalPass=r.searchMoves>0&&r.depthZero/r.searchMoves<=.01&&r.p95Ms<=budgetMs+250&&r.maxMs<=2000;
  return r;
});
const report={status:'PASS',contract,fingerprint,newPairs,reusedPairs,pairs:pairs.length,games:pairs.length*2,
  environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:require('node:os').cpus()[0]?.model},
  reports,technicalFailures:0,adoptionDecision:false,
  largestOperationalBudget:reports.filter(r=>r.operationalPass).at(-1)?.budgetMs??null};
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
