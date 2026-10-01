"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const E = require("./bounce-engine.js");
const S = require("./steal.js");
const Study = require("../tools/one-row-bounce-study.cjs");
function bare() {
  const b = E.initialState();
  b.pits.forEach(p => p[0].fill(0)); b.houseOwned = [false, false];
  return b;
}
test("one row per side and twelve hand KETE make 44 total", () => {
  const b = E.initialState();
  assert.deepEqual(b.reserve, [12, 12]);
  assert.ok(b.pits.every(p => p.length === 1 && p[0].length === 8));
  assert.equal(Study.total(b), 44);
});
test("sowing reflects at both ends without wrapping or repeating an endpoint", () => {
  for (const [index, direction, expected] of [[6, "right", [7, 6, 5]], [1, "left", [0, 1, 2]]]) {
    const b = bare(); b.pits[0][0][index] = 2; b.pits[1][0][index] = 1;
    const original = E.clone(b);
    const { state, events } = E.applyMove(b, { type: "takata", phase: "namua", row: 0, index, direction });
    assert.deepEqual(events.filter(e => e.kind === "sow").map(e => e.position.index), expected);
    const turn = events.find(e => e.kind === "sow" && e.reflected);
    assert.equal(turn.direction, direction === "right" ? "left" : "right");
    assert.deepEqual(b, original);
    assert.deepEqual(events.at(-1).state, state);
  }
});
test("MTAJI returning to the emptied source stops instead of falsely capturing", () => {
  const b = bare(); b.phase = "mtaji"; b.reserve = [0, 0];
  b.pits[0][0][6] = 2; b.pits[1][0][1] = 1;
  const m = E.legalMoves(b).find(m => m.index === 6 && m.direction === "right");
  assert.equal(m.type, "takata");
  const r = E.applyMove(b, m);
  assert.equal(r.events.some(e => e.kind === "capture"), false);
  assert.deepEqual(r.events.filter(e => e.kind === "sow").map(e => e.position.index), [7, 6]);
});
test("endpoint aliases are represented once", () => {
  const b = bare(); b.pits[0][0][7] = 2; b.pits[1][0][7] = 1;
  const moves = E.legalMoves(b);
  assert.equal(moves.length, 1); assert.equal(moves[0].direction, "left");
});
test("reachable NYAKUA and seven-KETE bulk placement retain snapshots and replay", () => {
  const trace = Study.game(Study.seedAt(0), "random", 0, true, S).trace;
  let game = S.initialGame(), sawNyakua = false, sawPass = false, sawBulk = false, sawReflection = false;
  for (const t of trace) {
    const { game: next, events } = S.applyWithEvents(game, t.move);
    const entry = next.history.at(-1);
    assert.deepEqual(next, S.apply(game, t.move));
    assert.deepEqual(events.at(-1).state, next.board);
    assert.equal(Study.total(next.board), 44);
    sawReflection ||= events.some(e => e.reflected);
    if (entry.stolen) { sawNyakua = true; assert.equal(events.at(-1).kind, "steal"); }
    if (t.move.type === "pass") { sawPass = true; assert.equal(game.board.reserve[game.board.player], 0); }
    if (entry.placed > 1) {
      sawBulk = true; assert.equal(entry.placed, 7);
      const drops = events.filter(e => e.kind === "reserve");
      assert.equal(drops.length, 1); assert.equal(drops[0].count, 7);
      assert.equal(drops[0].state.reserve[game.board.player], 0);
    }
    game = next;
  }
  assert.ok(sawNyakua && sawBulk && sawReflection);
  assert.deepEqual(S.replay(game.history), game);
  const altered = E.clone(game.history); altered[0].placed = 2;
  assert.throws(() => S.replay(altered), /does not match/);
});
test("a loaded exhausted-hand position still offers pass before bulk placement", () => {
  // The protected rule no longer creates a reachable pass from the initial state.
  const board = E.initialState(); board.reserve = [0, 7];
  board.pits[0][0][4] += 17;
  const before = { board, history: [] };
  assert.deepEqual(S.moveVariants(before), [{ type: "pass" }]);
  const passed = S.apply(before, { type: "pass" });
  assert.equal(passed.board.player, 1);
  assert.equal(passed.board.phase, "namua");
  const after = S.apply(passed, S.moveVariants(passed)[0]);
  assert.equal(after.history.at(-1).placed, 7);
  assert.equal(Study.total(after.board), 44);
});
test("NYAKUA preserves the last hand KETE with three captures and matching snapshots", () => {
  const trace = Study.game(Study.seedAt(1001), "random", 0, true, S).trace;
  const index = trace.findIndex(t => t.before.phase === "namua" && t.captures >= 2
    && t.before.reserve[1-t.player] === 1);
  assert.ok(index >= 0);
  const before = trace.slice(0,index).reduce((g,t)=>S.apply(g,t.move),S.initialGame());
  const t = trace[index];
  const result = S.applyWithEvents(before,t.move);
  assert.deepEqual(result.game, S.apply(before,t.move));
  assert.equal(result.game.history.at(-1).captures, 3);
  assert.equal(result.game.history.at(-1).stolen, 0);
  assert.deepEqual(result.game.board.reserve, [0,1]);
  assert.equal(result.game.board.phase, "namua");
  assert.equal(result.events.some(e=>e.kind === "steal"), false);
  assert.deepEqual(result.events.at(-1).state, result.game.board);
  assert.equal(Study.total(result.game.board), 44);
  assert.deepEqual(S.replay(result.game.history),result.game);
  const next = S.apply(result.game,trace[index+1].move);
  assert.equal(next.history.at(-1).placed,1);
  assert.deepEqual(next.board.reserve,[0,0]);
  assert.equal(next.board.phase,"mtaji");
  assert.equal(next.board.winner, null);
});
test("two opposing hand KETE allow one transfer and leave one", () => {
  const trace = Study.game(Study.seedAt(1005), "random", 0, true, S).trace;
  const t = trace.find(t=>t.before.phase === "namua" && t.captures >= 2
    && t.before.reserve[1-t.player] === 2);
  assert.ok(t);
  const before = {board:t.before,history:[]}, result = S.applyWithEvents(before,t.move);
  assert.equal(result.game.history.at(-1).stolen,1);
  assert.equal(result.game.board.reserve[1-t.player],1);
  assert.equal(result.events.filter(e=>e.kind === "steal").length,1);
  assert.equal(Study.total(result.game.board),44);
});
test("complete reachable games preserve stones, mirrors and records", () => {
  for (let i = 0; i < 100; i++) {
    const a = Study.game(Study.seedAt(i), "random", 0, true, S);
    const b = Study.game(Study.seedAt(i), "random", 1, false, S);
    assert.equal(b.winner, 1-a.winner); assert.equal(b.plies, a.plies); assert.equal(b.reason, a.reason);
    const replayed = S.replay(a.trace);
    assert.deepEqual(replayed.board, a.board);
    assert.equal(Study.total(a.board), 44);
  }
});

