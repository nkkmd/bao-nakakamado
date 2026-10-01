"use strict";
// Reproducible exploratory study of the playable v0.6.0 rules.
// node tools/one-row-bounce-study.cjs 1000 random,noisy,greedy
const E = require("../prototype/bounce-engine.js");
// Preserve the v0.6.0 condition for reproduction of the historical report.
const LegacyS = require("../prototype/steal.js").createForEngine(E, { protectLast: false });
function rng(seed) {
  let x = seed >>> 0;
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
}
function seedAt(i) { return (0x924f3aa1 + i * 0x9e3779b1) >>> 0; }
function total(board) {
  return [...board.reserve, ...board.pending, ...board.pits.flat(2)].reduce((a, b) => a + b, 0);
}
function score(board, side) {
  if (board.winner !== null) return board.winner === side ? 100000 : -100000;
  const front = p => board.pits[p][0].reduce((a, b) => a + b, 0);
  const all = p => front(p) + board.reserve[p];
  return 2 * (front(side) - front(1-side)) + all(side) - all(1-side);
}
function game(seed, policy = "random", first = 0, details = false, S = LegacyS) {
  const random = rng(seed);
  let game = S.initialGame(); game.board.player = first;
  const metrics = { seed, policy, first, plies: 0, stolen: 0, bulk: 0, mtaji: false };
  const trace = [];
  while (game.board.winner === null && metrics.plies < 400) {
    const moves = S.moveVariants(game);
    if (!moves.length) throw new Error("Nonterminal position without a move");
    let choices = moves;
    if (policy !== "random" && moves.length > 1) {
      const values = moves.map(move => {
        const after = S.apply(game, move);
        let value = score(after.board, game.board.player) + (move.type === "capture" ? 2 : 0);
        if (policy === "reply" && after.board.winner === null) {
          value = Math.min(...S.moveVariants(after).map(reply => score(S.apply(after, reply).board, game.board.player)));
        }
        return { move, value };
      });
      const best = Math.max(...values.map(item => item.value));
      choices = values.filter(item => item.value >= best - (policy === "noisy" ? 7 : 0)).map(item => item.move);
    }
    const move = choices[Math.floor(random() * choices.length)];
    const before = game;
    game = S.apply(game, move);
    const entry = game.history.at(-1);
    metrics.plies++; metrics.stolen += entry.stolen; metrics.bulk += entry.placed > 1;
    metrics.mtaji ||= game.board.phase === "mtaji";
    if (total(game.board) !== E.TOTAL_KETE) throw new Error("KETE conservation failed");
    if (game.board.reason === "relay-limit") throw new Error(`Relay safety limit at seed ${seed}`);
    if (details) trace.push({ before: before.board, move, after: game.board, ...entry });
  }
  if (game.board.winner === null) throw new Error(`Unfinished game at seed ${seed}`);
  return { ...metrics, winner: game.board.winner, reason: game.board.reason, board: game.board, ...(details ? { trace } : {}) };
}
if (require.main === module) {
  const n = Number(process.argv[2] || 1000);
  const policies = (process.argv[3] || "random,noisy,greedy").split(",");
  for (const policy of policies) {
    const games = Array.from({ length: n }, (_, i) => game(seedAt(i), policy));
    const sum = fn => games.reduce((a, b) => a + fn(b), 0);
    console.log(JSON.stringify({ policy, n, avgPlies: sum(g => g.plies) / n,
      firstWins: sum(g => g.winner === 0), nyakuaGames: sum(g => g.stolen > 0),
      bulkGames: sum(g => g.bulk > 0), mtajiGames: sum(g => g.mtaji) }));
  }
}
module.exports = { rng, seedAt, total, game };
