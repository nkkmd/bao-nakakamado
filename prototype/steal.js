"use strict";

// Prototype rule layer. The original Bao engine remains unchanged.
(function exposeSteal(root) {
  const engine = root.BaoEngine;

  function initialGame() {
    return { board: engine.initialState(), history: [] };
  }

  function resultFor(game, move, transition) {
    const mover = game.board.player;
    const { state: board, events } = engine.applyMove(game.board, move,
      transition ? undefined : { snapshots: false });
    const captures = events.filter((event) => event.kind === "capture").length;
    const opponent = 1 - mover;
    const placed = game.board.phase !== "namua" || move.type === "pass" ? 0
      : game.board.reserve[opponent] === 0 ? game.board.reserve[mover] : 1;
    const stolen = game.board.phase === "namua" && captures >= 2 && board.reserve[opponent] > 0 ? 1 : 0;
    if (stolen) {
      board.reserve[opponent] -= 1;
      board.reserve[mover] += 1;
    }
    const next = {
      board,
      history: [...game.history, { player: mover, move: { ...move }, placed, captures, stolen }],
    };
    if (transition && stolen) events.push({
      kind: "steal", from: opponent, to: mover, count: 1, state: engine.clone(board),
    });
    return transition ? { game: next, events } : next;
  }

  function apply(game, move) { return resultFor(game, move, false); }
  function applyWithEvents(game, move) { return resultFor(game, move, true); }

  // Keep nyumba choices distinct when the new hand transfer changes the result.
  function moveVariants(game) {
    return engine.legalMoves(game.board).flatMap((move) => {
      if (move.phase !== "namua" || move.type !== "capture") return [move];
      const stop = { ...move, houseChoice: "stop" };
      const use = { ...move, houseChoice: "use" };
      const a = apply(game, stop).board;
      const b = apply(game, use).board;
      return JSON.stringify(a) === JSON.stringify(b) ? [move] : [stop, use];
    });
  }

  function replay(history) {
    return history.reduce((game, entry) => {
      if (game.board.player !== entry.player) throw new Error("Wrong player in record");
      const next = apply(game, entry.move);
      const last = next.history.at(-1);
      if (last.placed !== entry.placed || last.captures !== entry.captures || last.stolen !== entry.stolen) {
        throw new Error("Placement or capture result does not match record");
      }
      return next;
    }, initialGame());
  }

  const api = { initialGame, apply, applyWithEvents, moveVariants, replay };
  root.NakakamadoSteal = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
}(typeof window !== "undefined" ? window : globalThis));
