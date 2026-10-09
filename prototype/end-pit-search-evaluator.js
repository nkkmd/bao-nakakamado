"use strict";

// Adapted from Bao la Kiswahili public/ai.js and ai-weights.js at
// 8c87ed44c9b08f75456766f0a9bd9f76d06209d4.
// Copyright (c) 2026 cultivationdata.net. MIT; see ENGINE_LICENSE.txt.
// NYAKUA features/weights are provisional engineering choices, not trained.
(function exposeSearchEvaluator(root) {
  const WIN = 1_000_000;
  const ID = "NAKAKAMADO-HANDCRAFT-V010-v1";
  const WEIGHTS = Object.freeze({
    namua: Object.freeze({boardSeeds: 6, frontSeeds: 5, frontOccupied: 40,
      frontConnections: 3, reusablePits: 3, mobility: 2, captureMoves: 3,
      maxCapture: 8, relayShape: 1, frontSafety: 8, houseValue: -7,
      houseOwned: 18, reserveEfficiency: 1, transitionShape: 2, tempo: 2,
      ordinaryHand: 6, nyakuaMoves: 6}),
    mtaji: Object.freeze({boardSeeds: 7, frontSeeds: 6, frontOccupied: 42,
      frontConnections: 4, reusablePits: 5, mobility: 3, captureMoves: 5,
      maxCapture: 8, relayShape: 1, frontSafety: 12, houseValue: 0,
      houseOwned: 18, reserveEfficiency: 0, transitionShape: 0, tempo: 3,
      ordinaryHand: 0, nyakuaMoves: 0}),
  });
  function createEvaluator(Q) {
    const sum = a => a.reduce((v, n) => v + n, 0);
    const occupied = a => a.filter(n => n > 0).length;
    function metrics(state, player, check = () => {}) {
      check();
      // The non-moving side is a static hypothetical view: a one-turn
      // takasia constraint belongs only to the actual moving side.
      const view = state.player === player ? state : {...state, player, takasia: null};
      const front = state.pits[player][Q.FRONT], back = state.pits[player][Q.BACK];
      const moves = Q.moveVariants(view); check();
      const captures = moves.filter(m => m.type === "capture");
      let maxCapture = 0, relayLength = 0, nyakuaMoves = 0;
      for (const m of captures) {
        check(); const r = Q.applyMove(view, m); check();
        // A truncated relay is not a completed capture sequence or a win label.
        if (Q.outcome(r.state) === "safety-stop") continue;
        maxCapture = Math.max(maxCapture, sum(r.events.filter(e => e.kind === "capture").map(e => e.count)));
        relayLength = Math.max(relayLength, r.events.filter(e => e.kind === "relay" || e.kind === "capture").length);
        nyakuaMoves += r.summary.stolen;
      }
      const frontCount = occupied(front), reusable = [...front, ...back].filter(n => n >= 2).length;
      let connections = 0;
      for (let i = 0; i < 7; i++) connections += front[i] > 0 && front[i + 1] > 0;
      const ordinary = state.reserve[player], effectiveHand = ordinary;
      return {boardSeeds: sum(front) + sum(back), frontSeeds: sum(front),
        frontOccupied: frontCount, frontConnections: connections, reusablePits: reusable,
        mobility: moves.filter(m => m.type !== "pass").length, captureMoves: captures.length,
        maxCapture, relayShape: relayLength + Math.min(reusable, 4),
        frontSafety: frontCount >= 3 ? 2 : frontCount === 2 ? 0 : -3,
        houseValue: state.houseOwned[player] ? 2 + Math.min(front[Q.HOUSE], 12) : 0,
        houseOwned: Number(state.houseOwned[player]),
        reserveEfficiency: effectiveHand > 0 ? Math.round(frontCount * 10 / effectiveHand) : 0,
        transitionShape: state.phase === "namua" && effectiveHand <= 4 ? frontCount + connections + reusable : 0,
        tempo: Number(state.player === player), ordinaryHand: ordinary, nyakuaMoves};
    }
    function breakdown(state, player, check = () => {}) {
      if (player !== 0 && player !== 1) throw new Error("Invalid perspective");
      const outcome = Q.outcome(state);
      if (outcome !== "ongoing") return {evaluatorId: ID, outcome, features: {}, contributions: {},
        total: outcome === "safety-stop" ? 0 : state.winner === player ? WIN : -WIN,
        scoreMeaning: outcome === "safety-stop" ? "unresolved-neutral-estimate" : "terminal"};
      const own = metrics(state, player, check), enemy = metrics(state, 1 - player, check);
      const features = Object.fromEntries(Object.keys(own).map(k => [k, own[k] - enemy[k]]));
      const contributions = Object.fromEntries(Object.entries(WEIGHTS[state.phase]).map(([k, w]) => [k, features[k] * w]));
      const total = Math.max(-100_000, Math.min(100_000, sum(Object.values(contributions))));
      return {evaluatorId: ID, outcome, features, contributions, total, scoreMeaning: "heuristic"};
    }
    return Object.freeze({ID, WIN, WEIGHTS, metrics, breakdown,
      evaluate: (state, player, check) => breakdown(state, player, check).total});
  }
  root.NakakamadoEndPitSearchEvaluator = Object.freeze({createEvaluator, ID, WIN, WEIGHTS});
  if (typeof module !== "undefined" && module.exports) module.exports = root.NakakamadoEndPitSearchEvaluator;
}(typeof window !== "undefined" ? window : globalThis));
