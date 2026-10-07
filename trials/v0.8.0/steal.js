"use strict";

// Prototype rule layer. The original Bao engine remains unchanged.
(function exposeSteal(root) {
  function createForEngine(engine, { protectLast = Boolean(engine.NYAKUA_PROTECT_LAST) } = {}) {
    const nextTurnThree = Boolean(engine.NYAKUA_NEXT_TURN_THREE);

    function initialGame() {
      return { board: engine.initialState(), history: [] };
    }

    // Both public play and search finish the same hand-transfer accounting.
    // Search accepts a board only; it never copies the accumulated game history.
    function boardResult(source, move, transition) {
      const mover = source.player;
      const { state: board, events } = engine.applyMove(source, move,
        transition ? undefined : { snapshots: false });
      const captures = events.filter((event) => event.kind === "capture").length;
      const opponent = 1 - mover;
      const placementEvent = events.find((event) => event.kind === "reserve");
      const placed = placementEvent?.count ?? (source.phase !== "namua" || move.type === "pass" ? 0
        : source.reserve[opponent] === 0 ? source.reserve[mover] : 1);
      const stolen = source.phase === "namua" && captures >= 2
        && board.reserve[opponent] > (protectLast ? 1 : 0) ? 1 : 0;
      if (stolen) {
        board.reserve[opponent] -= 1;
        if (nextTurnThree) board.nyakuaReserve[mover] += 1;
        else board.reserve[mover] += 1;
      }
      const summary = { player: mover, move: { ...move }, placed, captures, stolen,
        ...(nextTurnThree ? { ordinaryPlaced: placementEvent?.ordinaryCount || 0,
          reservedPlaced: placementEvent?.nyakuaCount || 0 } : {}) };
      if (stolen && transition) events.push({
        kind: "steal", from: opponent, to: mover, count: 1, state: engine.clone(board),
        ...(nextTurnThree ? { reservedForNextTurn: true } : {}),
      });
      return { state: board, events, summary };
    }

    function resultFor(game, move, transition) {
      const result = boardResult(game.board, move, transition);
      const next = { board: result.state, history: [...game.history, result.summary] };
      const events = result.events;
      return transition ? { game: next, events } : next;
    }

    function apply(game, move) { return resultFor(game, move, false); }
    function applyWithEvents(game, move) { return resultFor(game, move, true); }
    function applyMoveForSearch(source, move) { return boardResult(source, move, false); }

    function moveVariantsForSearch(source, moves = engine.legalMoves(source)) {
      return moves.flatMap((move) => {
        if (move.phase !== "namua" || move.type !== "capture") return [move];
        const stop = { ...move, houseChoice: "stop" };
        const use = { ...move, houseChoice: "use" };
        const a = applyMoveForSearch(source, stop).state;
        const b = applyMoveForSearch(source, use).state;
        return JSON.stringify(a) === JSON.stringify(b) ? [move] : [stop, use];
      });
    }

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
        if (nextTurnThree && (last.ordinaryPlaced !== entry.ordinaryPlaced
          || last.reservedPlaced !== entry.reservedPlaced)) {
          throw new Error("Ordinary or reserved placement does not match record");
        }
        return next;
      }, initialGame());
    }

    const api = { initialGame, apply, applyWithEvents, moveVariants, replay,
      applyMoveForSearch, moveVariantsForSearch };
    return api;
  }

  const api = createForEngine(root.BaoEngine);
  // Historical studies explicitly select their original NYAKUA condition.
  api.createForEngine = createForEngine;
  root.NakakamadoSteal = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
}(typeof window !== "undefined" ? window : globalThis));
