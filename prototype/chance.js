"use strict";

// Prototype rule layer. The original Bao engine remains unchanged.
(function exposeChance(root) {
  const BAG = Object.freeze({ gain: 3, loss: 3 });

  function initialGame() {
    return {
      board: root.BaoEngine.initialState(),
      bag: { ...BAG },
      chances: [1, 1],
      repeatAfterNext: null,
      bonusTurn: false,
      history: [],
    };
  }

  function canGamble(game, move) {
    return game.board.winner === null && move.type !== "pass"
      && game.chances[game.board.player] > 0
      && !game.bonusTurn && game.repeatAfterNext === null
      && game.bag.gain + game.bag.loss > 0;
  }

  function draw(bag, random = Math.random) {
    const total = bag.gain + bag.loss;
    if (!total) throw new Error("The bag is empty");
    const n = random();
    if (!(n >= 0 && n < 1)) throw new Error("Random value out of range");
    return Math.floor(n * total) < bag.gain ? "gain" : "loss";
  }

  function apply(game, move, gamble = false, outcome, random = Math.random) {
    const engine = root.BaoEngine;
    if (gamble && !canGamble(game, move)) throw new Error("Challenge unavailable");
    const mover = game.board.player;
    const board = engine.applyMove(game.board, move, { snapshots: false }).state;
    const next = {
      board,
      bag: { ...game.bag },
      chances: [...game.chances],
      repeatAfterNext: game.repeatAfterNext,
      bonusTurn: false,
      history: [...game.history],
    };
    let result = null;
    if (board.winner === null) {
      // A previously lost challenge gives the opponent one extra turn.
      if (game.repeatAfterNext === mover) {
        next.repeatAfterNext = null;
        board.player = mover;
        next.bonusTurn = true;
      }
      if (gamble) {
        result = outcome === undefined ? draw(next.bag, random) : outcome;
        if (result !== "gain" && result !== "loss" || next.bag[result] <= 0) {
          throw new Error("Invalid challenge result");
        }
        next.bag[result] -= 1;
        next.chances[mover] -= 1;
        if (result === "gain") {
          board.player = mover;
          next.bonusTurn = true;
        } else {
          next.repeatAfterNext = 1 - mover;
        }
      }
      // The engine checked the ordinary next player. Check any overridden player too.
      if (board.player !== 1 - mover && !engine.legalMoves(board).length) {
        board.winner = 1 - board.player;
        board.reason = "no-move";
        next.bonusTurn = false;
      }
    }
    next.history.push({ player: mover, move: { ...move }, gamble: Boolean(gamble), result });
    return next;
  }

  function replay(history) {
    return history.reduce((game, entry) => {
      if (game.board.player !== entry.player) throw new Error("Wrong player in record");
      return apply(game, entry.move, entry.gamble, entry.result);
    }, initialGame());
  }

  const api = { BAG, initialGame, canGamble, draw, apply, replay };
  root.NakakamadoChance = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
}(typeof window !== "undefined" ? window : globalThis));
