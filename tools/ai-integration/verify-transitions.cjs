"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const E = require("../../prototype/next-turn-engine.js");
const S = require("../../prototype/steal.js").createForEngine(E);
const Q = require("../../prototype/search-transition.js").createForEngine(E);
const C = require("../nyakua-three/core.cjs");
const plain = x => JSON.parse(JSON.stringify(x));
const freeze = x => { if (x && typeof x === "object") { Object.values(x).forEach(freeze); Object.freeze(x); } return x; };
function mirror(b) {
  const c = E.clone(b);
  for (const field of ["pits", "reserve", "nyakuaReserve", "houseOwned", "pending"]) c[field].reverse();
  c.player = 1 - c.player; if (c.winner !== null) c.winner = 1 - c.winner;
  return c;
}
function check(b, m, apply = Q.applyMove) {
  const before = E.clone(b), moveBefore = E.clone(m);
  freeze(b); freeze(m);
  const normal = S.applyWithEvents({board: b, history: []}, m);
  const search = apply(b, m);
  const oracle = C.T.advance(b, m, true);
  assert.deepEqual(search.state, normal.game.board);
  assert.deepEqual(search.summary, normal.game.history[0]);
  assert.deepEqual(search.state, plain(oracle.b));
  assert.deepEqual(search.summary, plain(oracle.entry));
  assert.deepEqual(search.events, normal.events.filter(e => e.kind !== "steal")
    .map(({state, ...event}) => event));
  assert.deepEqual(b, before); assert.deepEqual(m, moveBefore);
  assert.ok(!("history" in search) && !("game" in search));
  assert.ok(search.events.every(e => !("state" in e)));
  C.validate(search.state);
  return search;
}
function verify(gamesPerPolicy = 32) {
  assert.ok(Number.isSafeInteger(gamesPerPolicy) && gamesPerPolicy >= 1 && gamesPerPolicy <= 100);
  const coverage = {namua: 0, mtaji: 0, nyakua: 0, threePlacement: 0, twoPlacement: 0,
    reservedOnlyPlacement: 0, protectedLastWithMultipleCaptures: 0, reservedOpponentProtected: 0,
    houseStop: 0, houseUse: 0, normalTerminal: 0, phaseTransition: 0};
  let positions = 0, transitions = 0, mirroredTransitions = 0, replayedGames = 0;
  let negativeFixture = null;
  const digest = crypto.createHash("sha256"), trajectories = [];
  for (const policy of ["random", "noisy", "greedy", "reply"]) {
    for (let i = 0; i < gamesPerPolicy; i++) {
      const seed = C.seedAt(500000 + i), g = C.play("three", [policy, policy], seed, 0, true);
      let board = E.initialState(); const history = [];
      for (const step of g.path) {
        const moves = Q.moveVariants(board), mb = mirror(board);
        assert.deepEqual(moves, S.moveVariants({board, history: []}));
        assert.deepEqual(moves, plain(C.children("three", board).map(c => c.m)));
        assert.deepEqual(Q.moveVariants(mb), moves);
        positions++;
        for (const m of moves) {
          const r = check(board, m), mirrored = Q.applyMove(mb, m);
          assert.deepEqual(mirrored.state, mirror(r.state));
          assert.deepEqual(mirrored.summary, {...r.summary, player: 1 - r.summary.player});
          transitions++; mirroredTransitions++;
          coverage[board.phase]++;
          coverage.nyakua += r.summary.stolen;
          coverage.threePlacement += r.summary.placed === 3;
          coverage.twoPlacement += r.summary.placed === 2;
          coverage.reservedOnlyPlacement += r.summary.reservedPlaced === 1 && r.summary.ordinaryPlaced === 0;
          coverage.protectedLastWithMultipleCaptures += board.phase === "namua"
            && board.reserve[1 - board.player] === 1 && r.summary.captures >= 2 && r.summary.stolen === 0;
          coverage.reservedOpponentProtected += board.nyakuaReserve[1 - board.player] > 0;
          coverage.houseStop += m.houseChoice === "stop";
          coverage.houseUse += m.houseChoice === "use";
          coverage.normalTerminal += Q.outcome(r.state) === "normal-terminal";
          coverage.phaseTransition += board.phase !== r.state.phase;
          digest.update(JSON.stringify([board, m, r.state, r.summary]) + "\n");
          if (r.summary.stolen && !negativeFixture) negativeFixture = {board: E.clone(board), move: E.clone(m)};
        }
        const r = Q.applyMove(board, step.move);
        assert.deepEqual(r.state, plain(step.after));
        board = r.state; history.push(r.summary);
      }
      assert.deepEqual(S.replay(history).board, board); replayedGames++;
      trajectories.push({policy, seed, plies: g.path.length, reason: g.reason});
    }
  }
  for (const name of ["namua", "mtaji", "nyakua", "threePlacement", "reservedOpponentProtected",
    "houseStop", "houseUse", "normalTerminal", "phaseTransition"]) assert.ok(coverage[name] > 0, "Missing coverage: " + name);
  assert.ok(negativeFixture);
  const negativeControls = [];
  for (const [name, breakResult] of [
    ["omit-nyakua-transfer", r => { const p = r.summary.player; r.state.reserve[1 - p]++; r.state.nyakuaReserve[p]--; }],
    ["lose-protected-reserve", r => { r.state.nyakuaReserve[r.summary.player] = 0; }],
    ["miscount-captures", r => { r.summary.captures++; }],
    ["copy-display-snapshot", r => { r.events[0].state = E.clone(r.state); }],
    ["retain-history", r => { r.history = []; }],
  ]) {
    assert.throws(() => check(negativeFixture.board, negativeFixture.move, (b, m) => {
      const r = Q.applyMove(b, m); breakResult(r); return r;
    }), assert.AssertionError);
    negativeControls.push({name, detected: true});
  }
  const sources = {};
  for (const file of ["prototype/next-turn-engine.js", "prototype/steal.js", "prototype/search-transition.js",
    "prototype/search-transition.test.cjs", "prototype/bulk-engine.js", "tools/nyakua-three/engine.cjs",
    "tools/nyakua-three/core.cjs", "tools/ai-integration/verify-transitions.cjs"]) {
    sources[file] = crypto.createHash("sha256").update(fs.readFileSync(path.join(__dirname, "../..", file))).digest("hex");
  }
  return {status: "PASS", scope: "transition-equivalence-only", rulesVersion: E.RULES_VERSION,
    ruleId: E.RULE_ID, gamesPerPolicy, seedBlock: {startIndex: 500000, count: gamesPerPolicy},
    games: trajectories.length, positions, transitions, mirroredTransitions, replayedGames,
    coverage, negativeControls, traceSha256: digest.digest("hex"), sources, trajectories};
}
if (require.main === module) {
  const result = verify(Number(process.argv[2] || 32));
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(result, null, 2) + "\n");
  const {sources, trajectories, ...summary} = result; console.log(JSON.stringify(summary, null, 2));
}
module.exports = {verify};
