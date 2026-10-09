"use strict";
// MIT. Preregistered independent v0.10.0 search-vs-simple comparison.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const E=require('../prototype/end-pit-engine.js'),S=require('../prototype/end-pit-rules.js');
const Q=require('../prototype/end-pit-search-transition.js').createForEngine(E),F=require('../prototype/end-pit-search-ai.js');
const Simple=require('../prototype/end-pit-simple-ai.js').createAI(Q),A=F.createAI(Q);
const root=path.resolve(__dirname,'..'),hash=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const sources=['prototype/end-pit-engine.js','prototype/end-pit-rules.js','prototype/end-pit-search-transition.js','prototype/end-pit-search-ai.js','prototype/end-pit-search-evaluator.js','prototype/end-pit-simple-ai.js','tools/end-pit-search-formal.cjs'];
const sourceSha256=Object.fromEntries(sources.map(p=>[p,hash(fs.readFileSync(path.join(root,p),'utf8'))]));
const contract=Object.freeze({id:'NAKAKAMADO-V010-SEARCH-SIMPLE-FORMAL-001',rulesVersion:'0.10.0',budgetMs:150,maxDepth:32,
  quiescenceDepth:1,pairs:256,shards:8,maxPlies:200,seedRange:[2026200000,2026209999],
  openingPolicies:['random','noisy-simple'],minOpeningPlies:6,maxOpeningPlies:24,
  oneSidedAlpha:.05,confidenceMethod:'Hoeffding on independent opening-pair bounded utilities',
  minimumConfidenceLower:.5,maximumUnresolvedFraction:.02,maximumDepthZeroFraction:.01,
  maximumP95Ms:400,maximumMoveMs:2000,maximumTechnicalFailures:0,sourceSha256});
const fingerprint=hash(contract);
function opening(seed,policy,steps) {
  let game=S.initialGame(),n=seed>>>0;
  const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
  for(let ply=0;ply<steps&&Q.outcome(game.board)==='ongoing';ply++) {
    const moves=Q.moveVariants(game.board);
    const m=policy==='noisy-simple'&&random()<.6?Simple.chooseMove(game.board):moves[Math.floor(random()*moves.length)];
    game=S.apply(game,m);
  }
  return game;
}
function manifest() {
  const rows=[],seen=new Set();
  // Exclude every currently inspected development root, including all prefixes
  // of the deterministic parity games and operational-pilot openings.
  const excluded=new Set();const addGame=g=>{excluded.add(Q.stateKey(g.board));};
  for(const i of [0,1])addGame({board:require('./end-pit-search/fixtures.cjs').e30(Boolean(i))});
  for(const x of require('./end-pit-search/fixtures.cjs').examples)addGame({board:x.state});
  let n=2026100910;const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
  for(let i=0;i<32;i++) {
    let g=S.initialGame();for(let p=0;p<160&&Q.outcome(g.board)==='ongoing';p++) {
      addGame(g);const moves=Q.moveVariants(g.board);g=S.apply(g,i%2?Simple.chooseMove(g.board):moves[Math.floor(random()*moves.length)]);
    }
  }
  for(let b=0;b<3;b++)for(let i=0;i<4;i++)addGame(opening(2026100920+b*100+i,'random',6+i*3));
  for(let policyIndex=0;policyIndex<2;policyIndex++) {
    let count=0;
    for(let i=0;i<5000&&count<128;i++) {
      const seed=contract.seedRange[0]+policyIndex*5000+i,steps=6+i%19;
      const game=opening(seed,contract.openingPolicies[policyIndex],steps),key=Q.stateKey(game.board);
      if(Q.outcome(game.board)!=='ongoing'||excluded.has(key)||seen.has(key))continue;
      seen.add(key);rows.push({id:rows.length,seed,policy:contract.openingPolicies[policyIndex],steps,rootKey:key,game});count++;
    }
    assert.equal(count,128,'insufficient unique independent openings');
  }
  assert.equal(rows.length,256);return rows;
}
const rows=manifest(),manifestDigest=hash(rows);
function play(start,searchPlayer) {
  let game=E.clone(start);const turns=[];
  for(let ply=0;ply<contract.maxPlies&&Q.outcome(game.board)==='ongoing';ply++) {
    const b=game.board,original=JSON.stringify(b),started=performance.now();
    const r=b.player===searchPlayer?A.analyzeMove(b,{maxDepth:32,timeLimitMs:150}):{move:Simple.chooseMove(b),stats:null};
    const elapsedMs=performance.now()-started;
    assert.ok(Q.moveVariants(b).some(m=>F.moveKey(m)===F.moveKey(r.move)));assert.equal(JSON.stringify(b),original);
    const after=Q.applyMove(b,r.move).state;game=S.apply(game,r.move);assert.deepEqual(game.board,after);
    assert.equal([...after.pits.flat(2),...after.reserve,...after.nyakuaReserve,...after.pending].reduce((a,n)=>a+n,0),64);
    turns.push({ply:game.history.length,player:b.player,search:b.player===searchPlayer,elapsedMs,stats:r.stats});
  }
  const record=S.record(game);assert.deepEqual(S.replay(record),game);
  return {searchPlayer,record,turns,outcome:Q.outcome(game.board)};
}
function audit(row,expected) {
  assert.equal(row.fingerprint,fingerprint);assert.equal(row.manifestDigest,manifestDigest);assert.equal(row.id,expected.id);
  assert.equal(row.rootKey,expected.rootKey);assert.equal(row.checksum,hash(row.payload));assert.equal(row.payload.games.length,2);
  assert.deepEqual(row.payload.games.map(g=>g.searchPlayer),[0,1]);
  for(const g of row.payload.games) {
    S.replay(g.record);assert.equal(g.outcome,Q.outcome(g.record.final));
    assert.deepEqual(g.record.history.slice(0,expected.game.history.length),expected.game.history);
    assert.equal(g.turns.length,g.record.history.length-expected.game.history.length);
    for(const [i,t] of g.turns.entries()) {
      assert.equal(t.ply,expected.game.history.length+i+1);assert.equal(t.player,g.record.history[t.ply-1].player);
      assert.equal(t.search,t.player===g.searchPlayer);assert.ok(Number.isFinite(t.elapsedMs)&&t.elapsedMs>=0);
      if(t.search){assert.equal(t.stats.searchId,F.SEARCH_ID);assert.equal(t.stats.allocatedTimeMs,150);
        assert.ok(Number.isInteger(t.stats.completedDepth)&&t.stats.completedDepth>=0&&t.stats.completedDepth<=32);}
    }
  }
}
function runShard(out,shard) {
  assert.ok(Number.isInteger(shard)&&shard>=0&&shard<8);fs.mkdirSync(out,{recursive:true});let newPairs=0,reusedPairs=0;
  for(const expected of rows.filter(x=>x.id%8===shard)) {
    const file=path.join(out,`pair-${expected.id}.json`);let row;
    if(fs.existsSync(file)){row=JSON.parse(fs.readFileSync(file));audit(row,expected);reusedPairs++;}
    else {
      // A leftover started marker identifies an interrupted measured pair.
      // Hold it for review instead of silently taking a second measurement.
      if(fs.existsSync(file+'.started'))throw Error(`Interrupted pair ${expected.id}: HOLD, no automatic remeasurement`);
      fs.writeFileSync(file+'.started',JSON.stringify({fingerprint,id:expected.id}));
      const payload={games:[0,1].map(player=>play(expected.game,player))};
      row={id:expected.id,fingerprint,manifestDigest,rootKey:expected.rootKey,payload,checksum:hash(payload)};
      audit(row,expected);fs.writeFileSync(file+'.tmp',JSON.stringify(row,null,2)+'\n');fs.renameSync(file+'.tmp',file);
      fs.unlinkSync(file+'.started');newPairs++;
    }
    console.log(JSON.stringify({shard,pair:expected.id,newPairs,reusedPairs}));
  }
  const receipt={status:'PASS',shard,fingerprint,manifestDigest,newPairs,reusedPairs,pairs:32,
    environment:{node:process.version,cpu:require('node:os').cpus()[0]?.model}};
  fs.writeFileSync(path.join(out,`shard-${shard}.json`),JSON.stringify(receipt,null,2)+'\n');return receipt;
}
function aggregate(out) {
  const files=fs.readdirSync(out).filter(n=>/^pair-\d+\.json$/.test(n));assert.equal(files.length,256,'all pairs must be present before aggregation');
  let wins=0,losses=0,unresolved=0,depthZero=0;const times=[],pairUtilities=[];
  for(const expected of rows) {
    const row=JSON.parse(fs.readFileSync(path.join(out,`pair-${expected.id}.json`)));audit(row,expected);let utility=0;
    for(const g of row.payload.games) {
      if(g.outcome==='normal-terminal'){if(g.record.outcome.winner===g.searchPlayer){wins++;utility++;}else losses++;}
      else unresolved++;
      for(const t of g.turns.filter(t=>t.search)){times.push(t.elapsedMs);depthZero+=Number(t.stats.completedDepth===0);}
    }
    pairUtilities.push(utility/2);
  }
  const lowerUtility=pairUtilities.reduce((a,n)=>a+n,0)/256;
  const confidenceLower=Math.max(0,lowerUtility-Math.sqrt(Math.log(1/contract.oneSidedAlpha)/(2*256)));
  const ordered=[...times].sort((a,b)=>a-b),p95Ms=ordered[Math.ceil(ordered.length*.95)-1],maxMs=Math.max(...times);
  const criteria={strength:confidenceLower>.5,unresolved:unresolved/512<=.02,depthZero:times.length>0&&depthZero/times.length<=.01,
    latency:p95Ms<=400&&maxMs<=2000,technicalFailures:true};
  const report={status:Object.values(criteria).every(Boolean)?'PASS':'HOLD',contract,fingerprint,manifestDigest,
    pairs:256,games:512,wins,losses,unresolved,lowerUtility,confidenceLower,p95Ms,maxMs,searchMoves:times.length,depthZero,
    technicalFailures:0,criteria,publicAdopted:false,requiresCurrentDeviceCheck:true};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');return report;
}
if(require.main===module) {
  const [mode,out,shard]=process.argv.slice(2);
  if(mode==='manifest') {const r={contract,fingerprint,manifestDigest,rows};fs.writeFileSync(out,JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({fingerprint,manifestDigest,roots:rows.length}));}
  else if(mode==='shard')console.log(JSON.stringify(runShard(out,Number(shard))));
  else if(mode==='aggregate')console.log(JSON.stringify(aggregate(out)));
  else throw Error('Use manifest FILE | shard DIR INDEX | aggregate DIR');
}
module.exports={contract,fingerprint,manifestDigest,manifest,runShard,aggregate};
