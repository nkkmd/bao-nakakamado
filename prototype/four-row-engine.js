"use strict";

// Playable four-row Bao with the fixed-pit bulk rule. Keep the historical
// engine files unchanged so their recorded studies remain reproducible.
(function exposeFourRowEngine(root) {
  const base = typeof module !== "undefined" && module.exports
    ? require("./bulk-engine.js") : root.BaoEngine;
  if (!base || base.BACK !== 1) throw new Error("Load bulk-engine.js before four-row-engine.js");
  const api = Object.freeze({
    ...base,
    INITIAL_HAND: 22,
    TOTAL_KETE: 64,
    BOARD_ROWS_PER_PLAYER: 2,
    SOWING_PATH: "ring",
    RULES_VERSION: "0.7.0",
    NYAKUA_PROTECT_LAST: true,
    NYAKUA_FIXED_PIT_BULK: true,
    RULE_ID: "namua-steal-one-protect-last-fixed-pit-bulk-two-row-ring-hand22",
  });
  root.BaoEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
}(typeof window !== "undefined" ? window : globalThis));
