// Exploratory Bao Nakakamado v0.4 balance study. Run from any working directory:
// node tools/first-player-balance.cjs 1000 random,noisy,greedy shared,mixed
// node tools/first-player-balance.cjs 300 reply paired
// No production rules or prototype files are changed.
const E = require('../prototype/engine.js');

function rng(seed) {
  let x = seed >>> 0;
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
}
function score(b, side) {
  if (b.winner !== null) return b.winner === side ? 100000 : -100000;
  const front = p => b.pits[p][0].reduce((a, c) => a + c, 0);
  const all = p => b.reserve[p] + b.pits[p].flat().reduce((a, c) => a + c, 0);
  return 2 * (front(side) - front(1-side)) + all(side) - all(1-side);
}
function step(board, move, stealEnabled, transition) {
  const mover = board.player;
  const {state, events} = E.applyMoveForSearch(board, move);
  const captures = events.filter(e => e.kind === 'capture').length;
  const stolen = stealEnabled && board.phase === 'namua' && captures >= 2 && state.reserve[1-mover] > 0 ? 1 : 0;
  if (stolen) { state.reserve[1-mover]--; state.reserve[mover]++; }
  if (transition === 'mixed' && state.reason !== 'front-empty' && state.reason !== 'relay-limit') {
    // The engine checks the next player's moves under the mover's phase.
    // Re-evaluate no-move after selecting the next player's individual phase.
    state.phase = state.reserve[state.player] > 0 ? 'namua' : 'mtaji';
    if (state.reason === 'no-move') { state.winner = null; state.reason = ''; }
    if (state.winner === null && E.legalMoves(state).length === 0) {
      state.winner = mover; state.reason = 'no-move';
    }
  }
  return {state, stolen, captures};
}
function one(seed, policy, stealEnabled, first, transition) {
  const random = rng(seed);
  let board = E.initialState();
  board.player = first;
  const m = { steal: [0,0], pass: [0,0], captures: [0,0], mtajiTurn: null, bothMtajiTurn: null,
    mixedPlies: 0, earlyMtajiMoves: [0,0], zeroAt: [null,null], firstSteal: null };
  for (let ply = 0; ply < 400 && board.winner === null; ply++) {
    if (transition === 'mixed' && (board.reserve[0] === 0) !== (board.reserve[1] === 0)) m.mixedPlies++;
    if (board.phase === 'mtaji' && board.reserve[1-board.player] > 0) m.earlyMtajiMoves[board.player]++;
    let moves = E.moveVariantsForSearch(board);
    let choices = moves;
    if (policy !== 'random' && moves.length > 1) {
      const evals = moves.map(move => {
        const r = step(board, move, stealEnabled, transition);
        let value = score(r.state, board.player) + (move.type === 'capture' ? 2 : 0);
        if (policy === 'reply' && r.state.winner === null) {
          const replies = E.moveVariantsForSearch(r.state);
          value = Math.min(...replies.map(reply => score(step(r.state, reply, stealEnabled, transition).state, board.player)));
        }
        return {move, value};
      });
      const highest = Math.max(...evals.map(x => x.value));
      choices = evals.filter(x => x.value >= highest - (policy === 'noisy' ? 7 : 0)).map(x => x.move);
    }
    const move = choices[Math.floor(random() * choices.length)];
    const side = board.player;
    const r = step(board, move, stealEnabled, transition);
    m.steal[side] += r.stolen;
    m.captures[side] += r.captures;
    m.pass[side] += move.type === 'pass';
    if (m.firstSteal === null && r.stolen) m.firstSteal = side;
    board = r.state;
    if (m.mtajiTurn === null && (board.phase === 'mtaji' || (transition === 'mixed' && board.reserve.includes(0)))) m.mtajiTurn = ply + 1;
    if (m.bothMtajiTurn === null && board.reserve.every(x=>x===0)) m.bothMtajiTurn = ply + 1;
    for (let p=0;p<2;p++) if (m.zeroAt[p] === null && board.reserve[p] === 0) m.zeroAt[p] = ply + 1;
  }
  return {winner: board.winner, plies: board.turn - 1, phase: board.phase, reason: board.reason, ...m};
}
const games = Number(process.argv[2] || 300);
const policies = process.argv[3] ? process.argv[3].split(',') : ['random','noisy','greedy'];
const transitions = process.argv[4] ? process.argv[4].split(',') : ['shared','mixed'];
if (require.main === module) {
if (process.argv[4] === 'paired') {
  for (const policy of policies) {
    let same=0,toFirst=0,toSecond=0,firstZeroN=0,oldZeroWin=0,newZeroWin=0,early=0;
    for (let i=0;i<games;i++) {
      const seed=0x924f3aa1+i*0x9e3779b1;
      const a=one(seed,policy,true,0,'shared');
      const b=one(seed,policy,true,0,'mixed');
      if(a.winner===b.winner) same++; else if(b.winner===0) toFirst++; else toSecond++;
      const zero=a.zeroAt[0]!==null&& (a.zeroAt[1]===null||a.zeroAt[0]<a.zeroAt[1])?0:
        a.zeroAt[1]!==null&&(a.zeroAt[0]===null||a.zeroAt[1]<a.zeroAt[0])?1:null;
      if(zero!==null){firstZeroN++;oldZeroWin+=a.winner===zero;newZeroWin+=b.winner===zero;}
      early+=b.earlyMtajiMoves.some(Boolean);
    }
    console.log(JSON.stringify({policy,n:games,same,toFirst,toSecond,firstZeroN,oldZeroWin,newZeroWin,early}));
  }
  process.exit(0);
}
for (const policy of policies) for (const steal of [false,true]) for (const transition of transitions) for (const first of [0,1]) {
  const results = Array.from({length: games}, (_,i) => one(0x924f3aa1 + i * 0x9e3779b1, policy, steal, first, transition));
  const wins = [0,1].map(p => results.filter(r => r.winner === p).length);
  const unc = results.filter(r => r.winner === null).length;
  const sum = f => results.reduce((s,r) => s+f(r),0);
  const initial = [0,1].map(p => results.filter(r => r.firstSteal === p));
  console.log(JSON.stringify({policy, steal, transition, first, games, wins, unc,
    avgPlies: sum(r=>r.plies)/games, mtajiReached:results.filter(r=>r.mtajiTurn!==null).length,
    bothMtajiReached:results.filter(r=>r.bothMtajiTurn!==null).length,
    mixedGames:results.filter(r=>r.mixedPlies>0).length, avgMixedPlies:sum(r=>r.mixedPlies)/games,
    earlyMtajiGames:results.filter(r=>r.earlyMtajiMoves.some(Boolean)).length,
    avgEarlyMtajiMoves:[0,1].map(p=>sum(r=>r.earlyMtajiMoves[p])/games),
    avgStolen:[0,1].map(p=>sum(r=>r.steal[p])/games),
    avgPass:[0,1].map(p=>sum(r=>r.pass[p])/games),
    firstStolen:[0,1].map(p=>initial[p].length),
    winAfterFirstStolen:[0,1].map(p=>initial[p].filter(r=>r.winner===p).length),
    firstZero:[0,1].map(p=>results.filter(r=>r.zeroAt[p]!==null && (r.zeroAt[1-p]===null || r.zeroAt[p]<r.zeroAt[1-p])).length),
    winsAfterFirstZero:[0,1].map(p=>results.filter(r=>r.winner===p && r.zeroAt[p]!==null && (r.zeroAt[1-p]===null || r.zeroAt[p]<r.zeroAt[1-p])).length),
    reasons:Object.fromEntries([...new Set(results.map(r=>r.reason))].map(k=>[k,results.filter(r=>r.reason===k).length]))
  }));
}
}
module.exports = { one };
