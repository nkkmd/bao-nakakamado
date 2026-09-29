"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
require("./bulk-engine.js");
const S = require("./steal.js");
const Study = require("../tools/fixed-pit-bulk-study.cjs");
const Original = require("./engine.js");

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
function reachableBulk(seedIndex, type) {
  const trace = Study.game(Study.seedAt(seedIndex), "random", "fixed", 0, true, true).trace;
  const index = trace.findIndex((entry) => entry.bulk > 1 && entry.move.type === type);
  assert.ok(index >= 0);
  const before = trace.slice(0, index).reduce((game, entry) => S.apply(game, entry.move), S.initialGame());
  assert.deepEqual(before.board, JSON.parse(JSON.stringify(trace[index].before)));
  return { before, expected: trace[index] };
}

test("two captures in one NAMUA move transfer exactly one KETE and replay", () => {
  const before = position();
  const move = S.moveVariants(before).find((m) => m.index === 4 && m.side === "right");
  const unchanged = structuredClone(before);
  const after = S.apply(before, move);
  assert.deepEqual(before, unchanged);
  assert.equal(after.history.at(-1).captures, 2);
  assert.equal(after.history.at(-1).placed, 1);
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
  assert.equal(after.history.at(-1).placed, 21);
  assert.deepEqual(after.board.reserve, [0, 0]);
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

test("transition snapshots end at the same position and show the hand transfer", () => {
  const before = position();
  const move = S.moveVariants(before).find((m) => m.index === 4 && m.side === "right");
  const transition = S.applyWithEvents(before, move);
  assert.deepEqual(transition.game, S.apply(before, move));
  assert.equal(transition.events.filter((event) => event.kind === "capture").length, 2);
  assert.equal(transition.events.at(-1).kind, "steal");
  assert.deepEqual(transition.events.at(-1).state, transition.game.board);
  assert.equal(transition.events.at(-1).from, 0);
  assert.equal(transition.events.at(-1).to, 1);
  assert.ok(transition.events.every((event) => event.state));
  assert.deepEqual(before.board.reserve, [20, 21]);

  const single = S.moveVariants(before).find((m) => m.index === 4 && m.side === "left");
  const ordinary = S.applyWithEvents(before, single);
  assert.equal(ordinary.events.some((event) => event.kind === "steal"), false);
  assert.deepEqual(ordinary.events.at(-1).state, ordinary.game.board);
});

test("six KETE enter one hole in one placement before the ordinary capture and no-move", () => {
  const { before, expected } = reachableBulk(23, "capture");
  const hand = before.board.reserve[before.board.player];
  const pitBefore = before.board.pits[before.board.player][expected.move.row][expected.move.index];
  const { game: after, events } = S.applyWithEvents(before, expected.move);
  assert.equal(hand, 6);
  assert.equal(after.history.at(-1).placed, hand);
  assert.equal(after.history.at(-1).stolen, 0);
  assert.equal(events.filter((event) => event.kind === "reserve").length, 1);
  assert.equal(events[0].kind, "reserve");
  assert.equal(events[0].count, 6);
  assert.equal(events[0].state.reserve[before.board.player], 0);
  assert.equal(events[0].state.pits[before.board.player][expected.move.row][expected.move.index], pitBefore + 6);
  assert.equal(events[1].kind, "capture");
  assert.equal(after.board.reason, "no-move");
  assert.equal(after.board.phase, "mtaji");
  assert.equal(total(after.board), total(before.board));
  assert.deepEqual(after.board, JSON.parse(JSON.stringify(expected.after)));
  assert.deepEqual(events.at(-1).state, after.board);
  assert.deepEqual(S.replay(after.history), after);
  const altered = structuredClone(after.history);
  altered.at(-1).placed = 1;
  assert.throws(() => S.replay(altered), /does not match record/);
});

test("bulk takata and nyumba alternatives use the trial engine", () => {
  const { before, expected } = reachableBulk(32, "takata");
  const next = S.applyWithEvents(before, expected.move);
  assert.equal(next.game.history.at(-1).placed, 3);
  assert.ok(next.events.some((event) => event.kind === "lift"));
  assert.deepEqual(next.game.board, JSON.parse(JSON.stringify(expected.after)));
  assert.deepEqual(S.replay(next.game.history), next.game);

  const house = reachableBulk(47, "capture");
  const choices = S.moveVariants(house.before);
  const use = choices.find((m) => m.houseChoice === "use" && m.index === house.expected.move.index);
  const stop = choices.find((m) => m.houseChoice === "stop" && m.index === house.expected.move.index);
  assert.ok(use && stop);
  assert.notDeepEqual(S.apply(house.before, use).board, S.apply(house.before, stop).board);
});

test("after the one-time placement capture and takata follow the original engine unchanged", () => {
  for (const [seed, type] of [[23, "capture"], [32, "takata"]]) {
    const { before, expected } = reachableBulk(seed, type);
    const bulk = S.applyWithEvents(before, expected.move);
    const reference = Original.clone(before.board);
    const player = reference.player;
    const count = reference.reserve[player];
    reference.reserve[player] = 1;
    reference.pits[player][expected.move.row][expected.move.index] += count - 1;
    const ordinary = Original.applyMove(reference, expected.move);
    assert.equal(ordinary.events[0].kind, "reserve");
    assert.deepEqual(bulk.events[0].state, ordinary.events[0].state);
    assert.deepEqual(bulk.events.slice(1), ordinary.events.slice(1));
    assert.deepEqual(bulk.game.board, ordinary.state);
  }
});

test("trial engine matches the studied rule across complete reachable games", () => {
  for (let i = 0; i < 50; i += 1) {
    const studied = Study.game(Study.seedAt(i), "random", "fixed", 0, true, true);
    let played = S.initialGame();
    for (const entry of studied.trace) {
      played = S.apply(played, entry.move);
      assert.deepEqual(played.board, JSON.parse(JSON.stringify(entry.after)));
      assert.equal(total(played.board), 64);
    }
    assert.notEqual(played.board.winner, null);
    assert.deepEqual(S.replay(played.history), played);
  }
});
