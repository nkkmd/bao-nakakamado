"use strict";
// MIT; see LICENSE and ENGINE_LICENSE.txt. v0.10.0 accounting is inside end-pit-engine.js.
(function exposeEndPitRules(root) {
  const E = root.BaoEngine;
  const FORMAT = "bao-nakakamado-prototype";
  const VERSION = 9;
  function initialGame() { return {board: E.initialState(), history: []}; }
  function boardResult(source, move, snapshots) {
    if (source.nyakuaReserve.some(Boolean)) throw Error("Proposal A has no reserved hand");
    const {state, events} = E.applyMove(source, move, {snapshots});
    const addition = events.find(event => event.kind === "end-pit-add");
    const placement = events.find(event => event.kind === "reserve");
    const summary = {
      player: source.player, move: {...move}, placed: placement?.count || 0,
      captures: events.filter(event => event.kind === "capture").length,
      stolen: addition ? 1 : 0, // One opponent KETE, not the two-KETE pit addition.
      added: addition?.count || 0, ownAdded: addition ? 1 : 0,
      opponentAdded: addition ? 1 : 0,
      endpoint: addition ? {...addition.position} : null,
      takasiaBefore: source.takasia ? {...source.takasia} : null,
      takasiaAfter: state.takasia ? {...state.takasia} : null,
    };
    return {state, events, summary};
  }
  function resultFor(game, move, snapshots) {
    const result = boardResult(game.board, move, snapshots);
    return {game: {board: result.state, history: [...game.history, result.summary]}, events: result.events};
  }
  function apply(game, move) { return resultFor(game, move, false).game; }
  function applyWithEvents(game, move) { return resultFor(game, move, true); }
  function moveVariants(game) {
    return E.legalMoves(game.board).flatMap(move => {
      if (move.phase !== "namua" || move.type !== "capture") return [move];
      const stop = {...move, houseChoice: "stop"}, use = {...move, houseChoice: "use"};
      const a = boardResult(game.board, stop, false).state;
      const b = boardResult(game.board, use, false).state;
      return JSON.stringify(a) === JSON.stringify(b) ? [move] : [stop, use];
    });
  }
  function record(game, {mode = "local", computer = null} = {}) {
    const safety = game.board.reason === "relay-limit";
    const adjudication = safety ? "safety-stop" : game.board.winner === null ? "ongoing" : "normal";
    return E.clone({format: FORMAT, version: VERSION, baseRules: "bao-la-kiswahili-ja",
      baseRulesVersion: E.BASE_RULES_VERSION, baseRulesRevision: E.BASE_RULES_REVISION,
      variantRule: E.RULE_ID, rulesVersion: E.RULES_VERSION,
      publicAdopted: true, boardRowsPerPlayer: 2, sowingPath: "ring", initialHand: 22, totalKete: 64,
      takasia: true,
      nyakuaProtectLast: true, nyakuaFixedPitBulk: false, nyakuaNextTurnThree: false,
      nyakuaReservedProtected: false, nyakuaEndPitAdd: true, mode,
      ...(mode === "computer" ? {computer: computer || {id: "nyakua-takasia-simple-v2", learnedModel: false}} : {}),
      history: game.history, final: game.board, adjudication,
      outcome: {winner: safety ? null : game.board.winner, adjudication},
    });
  }
  function replay(saved) {
    if (saved?.format !== FORMAT || saved.version !== VERSION || saved.variantRule !== E.RULE_ID
      || saved.rulesVersion !== E.RULES_VERSION || saved.publicAdopted !== true
      || saved.takasia !== true || saved.baseRulesRevision !== E.BASE_RULES_REVISION
      || saved.nyakuaEndPitAdd !== true || saved.nyakuaNextTurnThree !== false
      || !Array.isArray(saved.history)) throw Error("Not a supported v0.10.0 record");
    const game = saved.history.reduce((previous, entry) => {
      if (previous.board.player !== entry.player) throw Error("Wrong player in record");
      if (JSON.stringify(previous.board.takasia ?? null) !== JSON.stringify(entry.takasiaBefore ?? null)) {
        throw Error("Record takasia state mismatch before move");
      }
      const next = apply(previous, entry.move), actual = next.history.at(-1);
      for (const key of ["placed", "captures", "stolen", "added", "ownAdded", "opponentAdded", "endpoint", "takasiaBefore", "takasiaAfter"]) {
        if (JSON.stringify(actual[key]) !== JSON.stringify(entry[key])) throw Error("Record result mismatch: " + key);
      }
      return next;
    }, initialGame());
    const expected = record(game, {mode: saved.mode});
    if (JSON.stringify(game.board) !== JSON.stringify(saved.final)
      || expected.adjudication !== saved.adjudication
      || JSON.stringify(expected.outcome) !== JSON.stringify(saved.outcome)) throw Error("Final result mismatch");
    return game;
  }
  root.NakakamadoSteal = {initialGame, apply, applyWithEvents, moveVariants, record, replay};
  if (typeof module !== "undefined" && module.exports) module.exports = root.NakakamadoSteal;
}(typeof window !== "undefined" ? window : globalThis));