"use strict";
// MIT; current NYAKUA/takasia search adapter. No old rule or model imports.
(function(root) {
  function createForEngine(E) {
    if (E.RULES_VERSION !== "0.10.0" || !E.NYAKUA_END_PIT_ADD || !E.TAKASIA
      || E.NYAKUA_NEXT_TURN_THREE || typeof E.applyMoveForSearch !== "function") {
      throw Error("Search adapter requires Bao Nakakamado v0.10.0");
    }
    function stateKey(b) {
      return JSON.stringify([E.RULE_ID, E.RULES_VERSION, E.BASE_RULES_REVISION,
        b.pits, b.reserve, b.nyakuaReserve, b.houseOwned, b.player, b.phase,
        b.winner, b.reason, b.pending, b.turn, b.takasia ?? null]);
    }
    function applyMove(b, move) {
      if (b.nyakuaReserve.some(Boolean)) throw Error("v0.10.0 has no reserved hand");
      const {state, events} = E.applyMoveForSearch(b, move);
      const addition = events.find(e => e.kind === "end-pit-add");
      return {state, events, summary: {
        captures: events.filter(e => e.kind === "capture").length,
        stolen: addition ? 1 : 0, added: addition ? 2 : 0,
        endpoint: addition ? {...addition.position} : null,
        takasiaBefore: b.takasia ? {...b.takasia} : null,
        takasiaAfter: state.takasia ? {...state.takasia} : null,
      }};
    }
    const outcome = b => b.reason === "relay-limit" ? "safety-stop"
      : b.winner === null ? "ongoing" : "normal-terminal";
    return Object.freeze({...E, applyMove, applyMoveForSearch: applyMove,
      moveVariants: E.moveVariantsForSearch, stateKey, outcome});
  }
  root.NakakamadoEndPitSearchTransition = Object.freeze({createForEngine});
  if (typeof module !== "undefined" && module.exports) module.exports = root.NakakamadoEndPitSearchTransition;
}(typeof window !== "undefined" ? window : globalThis));
