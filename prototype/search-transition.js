"use strict";

// MIT; see LICENSE and ENGINE_LICENSE.txt. AI integration foundation only.
// The public page keeps its existing computer until a later adoption review.
(function exposeSearchTransition(root) {
  function createForEngine(engine) {
    if (!engine.NYAKUA_NEXT_TURN_THREE || engine.RULES_VERSION !== "0.8.0") {
      throw new Error("Search adapter requires Bao Nakakamado v0.8.0");
    }
    const factory = root.NakakamadoSteal
      || (typeof require !== "undefined" ? require("./steal.js") : null);
    const rules = factory?.createForEngine(engine);
    if (typeof rules?.applyMoveForSearch !== "function"
      || typeof rules?.moveVariantsForSearch !== "function") {
      throw new Error("NYAKUA search rules are unavailable");
    }
    // Conservatively include every current board field. In particular, pending
    // and safety-stop reason must not disappear behind a cached terminal score.
    function stateKey(state) {
      return JSON.stringify([engine.RULE_ID, engine.RULES_VERSION,
        state.pits, state.reserve, state.nyakuaReserve, state.houseOwned,
        state.player, state.phase, state.winner, state.reason, state.pending, state.turn]);
    }
    function outcome(state) {
      if (state.reason === "relay-limit") return "safety-stop";
      return state.winner === null ? "ongoing" : "normal-terminal";
    }
    return Object.freeze({ ...engine,
      applyMove: rules.applyMoveForSearch,
      applyMoveForSearch: rules.applyMoveForSearch,
      moveVariants: rules.moveVariantsForSearch,
      moveVariantsForSearch: rules.moveVariantsForSearch,
      stateKey, outcome,
    });
  }
  root.NakakamadoSearchTransition = Object.freeze({ createForEngine });
  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.NakakamadoSearchTransition;
  }
}(typeof window !== "undefined" ? window : globalThis));
