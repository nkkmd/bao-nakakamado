"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
require("./engine.js");
const C = require("./chance.js");
const E = globalThis.BaoEngine;

function first(game) { return E.moveVariantsForSearch(game.board)[0]; }
function totalStones(board) {
  return board.reserve.reduce((a, b) => a + b, 0)
    + board.pits.flat(2).reduce((a, b) => a + b, 0)
    + board.pending.reduce((a, b) => a + b, 0);
}

test("success consumes one token and awards exactly one extra turn", () => {
  let game = C.initialGame();
  const before = totalStones(game.board);
  game = C.apply(game, first(game), true, "gain");
  assert.equal(game.board.player, 0);
  assert.equal(game.bonusTurn, true);
  assert.equal(game.chances[0], 0);
  assert.deepEqual(game.bag, { gain: 2, loss: 3 });
  assert.equal(totalStones(game.board), before);
  assert.equal(C.canGamble(game, first(game)), false);
  game = C.apply(game, first(game));
  assert.equal(game.board.player, 1);
  assert.equal(game.bonusTurn, false);
  assert.deepEqual(C.replay(game.history), game);
});

test("failure gives opponent a normal turn followed by one bonus turn", () => {
  let game = C.initialGame();
  game = C.apply(game, first(game), true, "loss");
  assert.equal(game.board.player, 1);
  assert.equal(game.repeatAfterNext, 1);
  assert.equal(C.canGamble(game, first(game)), false);
  game = C.apply(game, first(game));
  assert.equal(game.board.player, 1);
  assert.equal(game.repeatAfterNext, null);
  assert.equal(game.bonusTurn, true);
  game = C.apply(game, first(game));
  assert.equal(game.board.player, 0);
  assert.equal(game.bonusTurn, false);
  assert.deepEqual(C.replay(game.history), game);
});

test("the second draw uses the remaining public odds and rejects exhausted tokens", () => {
  const firstGame = C.apply(C.initialGame(), first(C.initialGame()), true, "gain");
  const second = C.apply(firstGame, first(firstGame));
  assert.equal(second.bag.gain / (second.bag.gain + second.bag.loss), 2 / 5);
  const last = C.apply(second, first(second), true, "loss");
  assert.deepEqual(last.bag, { gain: 2, loss: 2 });
  assert.equal(last.chances[1], 0);
  assert.deepEqual(C.replay(last.history), last);
  assert.throws(() => C.apply(C.initialGame(), first(C.initialGame()), true, "invalid"));
});
