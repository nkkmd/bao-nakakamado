"use strict";
// MIT. The existing v0.10.0 one-move computer, shared by UI and comparisons.
(function(root) {
  function createAI(Q) {
    function evaluate(b, player) {
      if (b.reason === "relay-limit") return 0;
      if (b.winner !== null) return b.winner === player ? 100000 : -100000;
      const front = p => b.pits[p][Q.FRONT].reduce((a,n) => a+n,0);
      const all = p => b.reserve[p]+b.nyakuaReserve[p]+b.pits[p].flat().reduce((a,n) => a+n,0);
      const takasia = b.takasia?.player === 1-player ? 1 : 0;
      return 2*(front(player)-front(1-player))+all(player)-all(1-player)+takasia;
    }
    function chooseMove(b) {
      let best = null, bestScore = -Infinity;
      for (const m of Q.moveVariants(b)) {
        const score = evaluate(Q.applyMove(b,m).state,b.player)+(m.type === "capture" ? 2 : 0);
        if (score > bestScore) {best=m;bestScore=score;}
      }
      return best;
    }
    return Object.freeze({chooseMove,evaluate});
  }
  root.NakakamadoEndPitSimpleAI = Object.freeze({createAI});
  if (typeof module !== "undefined" && module.exports) module.exports = root.NakakamadoEndPitSimpleAI;
}(typeof window !== "undefined" ? window : globalThis));
