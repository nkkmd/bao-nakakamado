"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const vm = require("node:vm");
const E = require("./next-turn-engine.js");
const S = require("./steal.js").createForEngine(E);
const A = require("./search-transition.js");
const Q = A.createForEngine(E);
const total = b => [...b.pits.flat(2), ...b.reserve, ...b.nyakuaReserve, ...b.pending]
  .reduce((sum, n) => sum + n, 0);
const freeze = x => { if (x && typeof x === "object") { Object.values(x).forEach(freeze); Object.freeze(x); } return x; };
function position() {
  return [
    {type: "takata", phase: "namua", row: 0, index: 6, direction: "left"},
    {type: "capture", phase: "namua", row: 0, index: 4, direction: "left", side: "right"},
    {type: "takata", phase: "namua", row: 0, index: 5, direction: "left"},
  ].reduce((g, m) => S.apply(g, m), S.initialGame()).board;
}
function compare(b, m) {
  const before = E.clone(b);
  freeze(b); freeze(m);
  const expected = S.applyWithEvents({board: b, history: []}, m);
  const actual = Q.applyMove(b, m);
  assert.deepEqual(actual.state, expected.game.board);
  assert.deepEqual(actual.summary, expected.game.history[0]);
  assert.deepEqual(actual.events, expected.events.filter(e => e.kind !== "steal")
    .map(({state, ...event}) => event));
  assert.ok(actual.events.every(e => !Object.hasOwn(e, "state")));
  assert.ok(!Object.hasOwn(actual, "history") && !Object.hasOwn(actual, "game"));
  assert.deepEqual(b, before);
  assert.equal(total(actual.state), total(b));
  return actual;
}
test("search includes NYAKUA, survives the reply, consumes three, and can steal again", () => {
  let b = position();
  const m = Q.moveVariants(b).find(m => Q.applyMove(b, m).summary.stolen);
  assert.ok(m);
  const p = b.player, hand = b.reserve[p];
  b = compare(b, m).state;
  assert.equal(b.reserve[p], hand - 1); assert.equal(b.nyakuaReserve[p], 1);
  b = compare(b, Q.moveVariants(b)[0]).state;
  assert.equal(b.nyakuaReserve[p], 1);
  const next = compare(b, Q.moveVariants(b)[0]);
  assert.equal(next.summary.ordinaryPlaced, 2); assert.equal(next.summary.placed, 3);
  const repeat = position(); repeat.nyakuaReserve[repeat.player] = 1;
  const stealAgain = Q.moveVariants(repeat).find(m => Q.applyMove(repeat, m).summary.stolen);
  assert.ok(stealAgain); const r = compare(repeat, stealAgain);
  assert.equal(r.summary.reservedPlaced, 1); assert.equal(r.state.nyakuaReserve[repeat.player], 1);
});
test("boundary hands 0/1/2/5, both reserved stones, and last-one protection", () => {
  let protectedCapture = 0;
  for (const hand of [0, 1, 2, 5]) for (const enemy of [0, 1, 2, 5]) {
    const b = position(), p = b.player, o = 1 - p;
    b.reserve[p] = hand; b.reserve[o] = enemy; b.nyakuaReserve = [1, 1];
    assert.deepEqual(Q.moveVariants(b), S.moveVariants({board: b, history: []}));
    for (const m of Q.moveVariants(b)) {
      assert.notEqual(m.type, "pass"); const r = compare(b, m);
      assert.equal(r.summary.placed, Math.min(hand, 2) + 1);
      assert.equal(r.summary.stolen, Number(r.summary.captures >= 2 && enemy >= 2));
      assert.equal(r.state.nyakuaReserve[o], 1);
      protectedCapture += enemy === 1 && r.summary.captures >= 2;
    }
  }
  assert.ok(protectedCapture > 0);
});
test("reserved stone postpones MTAJI; artificial empty-hand pass remains compatible", () => {
  const b = E.initialState(); b.reserve = [1, 0]; b.nyakuaReserve = [0, 1];
  const a = compare(b, Q.moveVariants(b)[0]).state;
  assert.equal(a.phase, "namua"); assert.notEqual(Q.moveVariants(a)[0].type, "pass");
  const c = compare(a, Q.moveVariants(a)[0]);
  assert.equal(c.summary.placed, 1); assert.equal(c.state.phase, "mtaji");
  const pass = E.initialState(); pass.reserve = [0, 2];
  assert.deepEqual(Q.moveVariants(pass), [{type: "pass"}]);
  assert.equal(compare(pass, {type: "pass"}).summary.placed, 0);
});
test("NYUMBA two-stone sowing, terminal pending, and terminal legality", () => {
  const house = E.initialState(); house.pits[0][0][5] = house.pits[0][0][6] = 0;
  house.nyakuaReserve[0] = 1;
  const h = compare(house, Q.moveVariants(house).find(m => m.houseTwo));
  assert.equal(h.summary.placed, 3); assert.equal(h.events.find(e => e.kind === "lift").count, 2);
  const terminal = E.initialState(); terminal.pits[1][0] = [0, 0, 0, 1, 0, 0, 0, 0];
  const t = compare(terminal, Q.moveVariants(terminal)[0]);
  assert.equal(t.state.reason, "front-empty"); assert.ok(t.state.pending[0] > 0);
  assert.equal(Q.outcome(t.state), "normal-terminal"); assert.deepEqual(Q.moveVariants(t.state), []);
  assert.throws(() => Q.applyMove(t.state, {type: "pass"}), /Illegal move/);
});
test("known relay cycle is a safety stop, never an ordinary win", () => {
  const record = JSON.parse(fs.readFileSync(require.resolve("../tools/nyakua-three/results/anomalies/self-random-three-3435580265-game.json")));
  const history = record.path.map(t => t.entry), b = S.replay(history.slice(0, -1)).board;
  const r = compare(b, history.at(-1).move);
  assert.equal(r.state.reason, "relay-limit"); assert.equal(Q.outcome(r.state), "safety-stop");
});
test("cache key includes all board fields, protected reserve, rule identity and safety status", () => {
  const b = E.initialState(), key = Q.stateKey(b);
  for (const mutate of [
    b => b.nyakuaReserve[0]++, b => b.reserve[0]--, b => b.pits[0][1][0]++,
    b => b.houseOwned[0] = false, b => b.player = 1, b => b.phase = "mtaji",
    b => b.winner = 0, b => b.reason = "relay-limit", b => b.pending[0]++, b => b.turn++,
  ]) { const c = E.clone(b); mutate(c); assert.notEqual(Q.stateKey(c), key); }
  assert.equal(Q.stateKey(E.clone(b)), key); assert.equal(Q.outcome(b), "ongoing");
  assert.throws(() => A.createForEngine({...E, RULES_VERSION: "0.7.0"}), /v0.8.0/);
  assert.notEqual(A.createForEngine({...E, RULE_ID: "other-rule"}).stateKey(b), key);
});
test("browser export binds the supplied current engine independently of a previous rules binding", () => {
  const context = {window: {}};
  vm.runInNewContext(fs.readFileSync(require.resolve("./next-turn-engine.js"), "utf8"), context);
  vm.runInNewContext(fs.readFileSync(require.resolve("./steal.js"), "utf8"), context);
  vm.runInNewContext(fs.readFileSync(require.resolve("./search-transition.js"), "utf8"), context);
  const browser = context.window.NakakamadoSearchTransition.createForEngine(context.window.BaoEngine);
  const b = browser.initialState(), m = browser.moveVariants(b)[0];
  assert.deepEqual(JSON.parse(JSON.stringify(browser.applyMove(b, m))), Q.applyMove(Q.initialState(), m));
});
