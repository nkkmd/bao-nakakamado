'use strict';
// MIT. Research harness; all physical rules are the frozen v0.10.0 rules.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const E=require('../../prototype/end-pit-engine.js');
const S=require('../../prototype/end-pit-rules.js');
const Q=require('../../prototype/end-pit-search-transition.js').createForEngine(E);
const Public=require('../../prototype/end-pit-search-ai.js');
const Research=require('./research-search.cjs');
const Simple=require('../../prototype/end-pit-simple-ai.js').createAI(Q);
const {mirror,e30}=require('../end-pit-search/fixtures.cjs');
const root=path.resolve(__dirname,'../..');
const hash=x=>crypto.createHash('sha256').update(Buffer.isBuffer(x)?x:typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const sources=['prototype/end-pit-engine.js','prototype/end-pit-rules.js','prototype/end-pit-search-transition.js',
  'prototype/end-pit-search-ai.js','prototype/end-pit-search-evaluator.js','prototype/end-pit-simple-ai.js',
  'tools/v010-balance/research-search.cjs','tools/v010-balance/core.cjs','tools/v010-balance/run.cjs'];
const fingerprint=()=>Object.fromEntries(sources.map(p=>[p,hash(fs.readFileSync(path.join(root,p)))]));
const total=b=>[...b.pits.flat(2),...b.reserve,...b.nyakuaReserve,...b.pending].reduce((a,n)=>a+n,0);
function invariant(b){const values=[...b.pits.flat(2),...b.reserve,...b.nyakuaReserve,...b.pending];
  assert.ok(values.every(n=>Number.isSafeInteger(n)&&n>=0));assert.equal(total(b),64);assert.deepEqual(b.nyakuaReserve,[0,0]);}
function positionKey(b){const c=E.clone(b);delete c.turn;return Q.stateKey(c);}
function play(profile,seed,firstPlayer,{maxPlies=400}={}) {
  let game=S.initialGame();if(firstPlayer===1)game.board=mirror(game.board);
  const start=E.clone(game.board),seen=new Set([positionKey(start)]),turns=[];
  const ai=profile.kind==='research'?Research.createAI(Q,{now:()=>0}):Public.createAI(Q);
  let stop='ply-limit';
  for(let ply=0;ply<maxPlies;ply++) {
    if(Q.outcome(game.board)!=='ongoing')break;
    const b=game.board,before=JSON.stringify(b),t=performance.now();
    const r=profile.kind==='simple'?{move:Simple.chooseMove(b),stats:null}
      :ai.analyzeMove(b,profile.kind==='research'?{maxNodes:profile.nodes,maxDepth:32,timeLimitMs:60000,
        exactRoot:true,tieSeed:seed,quiescenceDepth:1}:{maxDepth:32,timeLimitMs:profile.ms,quiescenceDepth:1});
    const elapsedMs=performance.now()-t;
    assert.equal(JSON.stringify(b),before);assert.ok(Q.moveVariants(b).some(m=>Public.moveKey(m)===Public.moveKey(r.move)));
    const light=Q.applyMove(b,r.move).state;game=S.apply(game,r.move);assert.deepEqual(game.board,light);invariant(game.board);
    const h=game.history.at(-1);turns.push({move:r.move,before:Q.stateKey(b),after:Q.stateKey(game.board),
      player:b.player,phase:b.phase,elapsedMs,stats:r.stats,summary:h});
    if(Q.outcome(game.board)!=='ongoing')break;
    const k=positionKey(game.board);if(seen.has(k)){stop='state-repeat';break;}seen.add(k);
  }
  const status=Q.outcome(game.board);if(status!=='ongoing')stop=status;
  return {profile:profile.id,seed,firstPlayer,start,turns,final:game.board,stop,
    firstWin:status==='normal-terminal'?Number(game.board.winner===firstPlayer):null,
    trajectory:hash(turns.map(t=>[t.move.type,t.move.phase,t.move.row,t.move.index,t.move.direction,t.move.side,t.move.houseChoice,t.move.houseTwo]))};
}
function auditGame(g,{checkSearch=false,profile=null}={}) {
  assert.ok(g.firstPlayer===0||g.firstPlayer===1);assert.equal(g.start.player,g.firstPlayer);
  assert.deepEqual(g.start,g.firstPlayer?mirror(E.initialState()):E.initialState());
  let game={board:E.clone(g.start),history:[]};
  const ai=checkSearch&&profile?.kind==='research'?Research.createAI(Q,{now:()=>0}):null;
  for(const t of g.turns) {
    assert.equal(t.player,game.board.player);assert.equal(t.phase,game.board.phase);assert.equal(t.before,Q.stateKey(game.board));
    assert.ok(Q.moveVariants(game.board).some(m=>Public.moveKey(m)===Public.moveKey(t.move)));
    if(ai){const r=ai.analyzeMove(game.board,{maxNodes:profile.nodes,maxDepth:32,timeLimitMs:60000,exactRoot:true,tieSeed:g.seed,quiescenceDepth:1});
      assert.deepEqual(r.move,t.move);for(const k of ['nodes','completedDepth','rootScore','exactRootScores'])assert.deepEqual(r.stats[k],t.stats[k]);}
    game=S.apply(game,t.move);assert.deepEqual(game.history.at(-1),t.summary);assert.equal(t.after,Q.stateKey(game.board));invariant(game.board);
  }
  assert.deepEqual(game.board,g.final);const status=Q.outcome(game.board);
  assert.equal(g.firstWin,status==='normal-terminal'?Number(game.board.winner===g.firstPlayer):null);
  if(status!=='ongoing')assert.equal(g.stop,status);else assert.ok(['state-repeat','ply-limit'].includes(g.stop));
  assert.equal(g.trajectory,hash(g.turns.map(t=>[t.move.type,t.move.phase,t.move.row,t.move.index,t.move.direction,t.move.side,t.move.houseChoice,t.move.houseTwo])));
  // Current public record format assumes SOUTH starts. NORTH-start research
  // records are explicitly replayed from their serialized initial position.
  if(g.firstPlayer===0)assert.deepEqual(S.replay(S.record(game)),game);
  return game;
}
const quantile=(a,p)=>a.length?[...a].sort((x,y)=>x-y)[Math.ceil(a.length*p)-1]:null;
function operations(games){const turns=games.flatMap(g=>g.turns),search=turns.filter(t=>t.stats),times=turns.map(t=>t.elapsedMs);
  return {games:games.length,turns:turns.length,searchTurns:search.length,depthZero:search.filter(t=>t.stats.completedDepth===0).length,
    medianDepth:quantile(search.map(t=>t.stats.completedDepth),.5),p95Ms:quantile(times,.95),maxMs:times.length?Math.max(...times):null,
    uniqueTrajectories:new Set(games.map(g=>g.trajectory)).size,distinctFirstMoves:new Set(games.map(g=>Public.moveKey(g.turns[0]?.move))).size,
    normal:games.filter(g=>g.stop==='normal-terminal').length,safetyStops:games.filter(g=>g.stop==='safety-stop').length,
    repeats:games.filter(g=>g.stop==='state-repeat').length,plyLimits:games.filter(g=>g.stop==='ply-limit').length};}
module.exports={E,S,Q,Public,Research,Simple,mirror,e30,hash,fingerprint,invariant,positionKey,play,auditGame,operations,root};
