"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
require("./engine.js");
const S = require("./steal.js");

const openings = [
  { type: "takata", phase: "namua", row: 0, index: 6, direction: "left" },
  { type: "capture", phase: "namua", row: 0, index: 4, direction: "left", side: "right" },
  { type: "takata", phase: "namua", row: 0, index: 5, direction: "left" },
];

function position() { return openings.reduce((game, move) => S.apply(game, move), S.initialGame()); }
function total(board) {
  return board.reserve.reduce((sum, n) => sum + n, 0)
    + board.pits.flat(2).reduce((sum, n) => sum + n, 0)
    + board.pending.reduce((sum, n) => sum + n, 0);
}

test("two captures in one NAMUA move transfer exactly one KETE and replay", () => {
  const before = position();
  const move = S.moveVariants(before).find((m) => m.index === 4 && m.side === "right");
  const unchanged = structuredClone(before);
  const after = S.apply(before, move);
  assert.deepEqual(before, unchanged);
  assert.equal(after.history.at(-1).captures, 2);
  assert.equal(after.history.at(-1).stolen, 1);
  assert.deepEqual(after.board.reserve, [19, 21]);
  assert.equal(total(after.board), total(before.board));
  assert.deepEqual(S.replay(after.history), after);
  const altered = structuredClone(after.history);
  altered.at(-1).stolen = 0;
  assert.throws(() => S.replay(altered), /does not match/);
});

test("one capture and empty opposing hand do not transfer KETE", () => {
  const before = position();
  const single = S.moveVariants(before).find((m) => m.index === 4 && m.side === "left");
  const ordinary = S.apply(before, single);
  assert.equal(ordinary.history.at(-1).captures, 1);
  assert.equal(ordinary.history.at(-1).stolen, 0);
  assert.deepEqual(ordinary.board.reserve, [20, 20]);

  const empty = structuredClone(before);
  empty.board.reserve[0] = 0;
  const chained = S.moveVariants(empty).find((m) => m.index === 4 && m.side === "right");
  const after = S.apply(empty, chained);
  assert.equal(after.history.at(-1).captures, 2);
  assert.equal(after.history.at(-1).stolen, 0);
  assert.deepEqual(after.board.reserve, [0, 20]);
  assert.equal(total(after.board), total(empty.board));
});

test("two captures in MTAJI do not activate the NAMUA rule", () => {
  const mtaji = position();
  mtaji.board.phase = "mtaji";
  mtaji.board.reserve = [0, 0];
  const move = S.moveVariants(mtaji)[0];
  const after = S.apply(mtaji, move);
  assert.equal(after.history.at(-1).captures, 2);
  assert.equal(after.history.at(-1).stolen, 0);
  assert.deepEqual(after.board.reserve, [0, 0]);
  assert.equal(total(after.board), total(mtaji.board));
});
