"use strict";
// Verification only: no pruning, PVS, transposition/evaluation cache, ordering,
// iterative deepening, or calls into the candidate search implementation.
const E = require("../../prototype/next-turn-engine.js");
const S = require("../../prototype/steal.js").createForEngine(E);
const Q = require("../../prototype/search-transition.js").createForEngine(E);
const V = require("../../prototype/search-evaluator.js").createEvaluator(Q);
function solve(state, depth, quiescenceDepth = 1) {
  const player = state.player; let nodes = 0, safetyStops = 0;
  function terminal(b, ply) {
    if (b.reason === "relay-limit") { safetyStops++; return 0; }
    return b.winner === null ? null : b.winner === player ? V.WIN - ply : -V.WIN + ply;
  }
  const moves = b => S.moveVariants({board: b, history: []});
  const next = (b, m) => S.apply({board: b, history: []}, m).board;
  function quiet(b, ply, remaining) {
    nodes++; const t = terminal(b, ply); if (t !== null) return t;
    if (!remaining) return V.evaluate(b, player);
    const captures = moves(b).filter(m => m.type === "capture");
    if (!captures.length) return V.evaluate(b, player);
    const values = captures.map(m => quiet(next(b, m), ply + 1, remaining - 1));
    return b.player === player ? Math.max(...values) : Math.min(...values);
  }
  function visit(b, d, ply) {
    nodes++; const t = terminal(b, ply); if (t !== null) return t;
    if (!d) return quiet(b, ply, quiescenceDepth);
    const legal = moves(b);
    if (!legal.length) return b.player === player ? -V.WIN + ply : V.WIN - ply;
    const values = legal.map(m => visit(next(b, m), d - 1, ply + 1));
    return b.player === player ? Math.max(...values) : Math.min(...values);
  }
  const t = terminal(state, 0);
  if (t !== null) return {score: t, bestMoves: [], nodes, safetyStops};
  const scored = moves(state).map(move => ({move, value: visit(next(state, move), depth - 1, 1)}));
  const score = scored.length ? Math.max(...scored.map(c => c.value)) : -V.WIN;
  return {score, bestMoves: scored.filter(c => c.value === score).map(c => c.move), nodes, safetyStops};
}
module.exports = {solve};
