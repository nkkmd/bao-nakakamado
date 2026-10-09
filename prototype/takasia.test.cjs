"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

const E = require("./end-pit-engine.js");
globalThis.BaoEngine = E;
const S = require("./end-pit-rules.js");

function e30() {
  return {
    pits: [
      [[0,2,0,0,1,1,0,0],[0,0,2,2,0,2,6,4]],
      [[1,0,1,2,10,0,0,10],[2,2,8,4,1,2,1,0]],
    ],
    reserve: [0,0],
    nyakuaReserve: [0,0],
    houseOwned: [false,false],
    player: 1,
    phase: "mtaji",
    winner: null,
    reason: "",
    turn: 2,
    pending: [0,0],
    takasia: null,
  };
}

test("v0.10.0 starts without takasia and exposes adopted revision", () => {
  const state = E.initialState();
  assert.equal(state.takasia, null);
  assert.equal(E.RULES_VERSION, "0.10.0");
  assert.equal(E.BASE_RULES_REVISION, "BAO-RULES-V0.2.0-TAKASIA-001");
  assert.equal(E.TAKASIA, true);
});

test("E30 detects North a4 as the next-turn takasia target", () => {
  const state = e30();
  const before = JSON.stringify(state);
  assert.deepEqual(E.detectTakasia(state, 0, {phase:"mtaji", type:"takata"}), {player:1,index:3});
  assert.equal(JSON.stringify(state), before, "detection must be pure");
});

test("active takasia target cannot start a MTAJI takata", () => {
  const state = e30();
  state.takasia = {player:1,index:3};
  const moves = E.legalMoves(state);
  assert.ok(moves.length > 0);
  assert.ok(moves.every(move => !(move.type === "takata" && move.row === E.FRONT && move.index === 3)));
});

test("E30 contains a legal response whose relay stops on the takasia target", () => {
  const state = e30();
  state.takasia = {player:1,index:3};
  const results = E.legalMoves(state).map(move => ({move, result:E.applyMove(state, move)}));
  const stopped = results.find(({result}) => result.events.some(event => event.kind === "takasia" && event.action === "stop"));
  assert.ok(stopped, "expected at least one E30 response to stop at takasia");
  assert.equal(stopped.result.state.takasia, null, "the one-turn constraint must be consumed");
});

test("takasia expires after the constrained turn and may be replaced only by a newly detected target", () => {
  const state = e30();
  state.takasia = {player:1,index:3};
  const move = E.legalMoves(state).find(candidate => {
    const result = E.applyMove(state, candidate);
    return result.events.some(event => event.kind === "takasia" && event.action === "expire");
  });
  assert.ok(move);
  const result = E.applyMove(state, move);
  assert.ok(result.events.some(event => event.kind === "takasia" && event.action === "expire"));
  if (result.state.takasia) assert.equal(result.state.takasia.player, result.state.player);
});

test("v0.10.0 records use version 9 and preserve takasia fields", () => {
  const game = S.apply(S.initialGame(), S.moveVariants(S.initialGame())[0]);
  const record = S.record(game, {mode:"computer"});
  assert.equal(record.version, 9);
  assert.equal(record.rulesVersion, "0.10.0");
  assert.equal(record.takasia, true);
  assert.equal(record.baseRulesRevision, "BAO-RULES-V0.2.0-TAKASIA-001");
  assert.equal(record.computer.id, "nyakua-takasia-simple-v2");
  assert.deepEqual(S.replay(record), game);
});

test("v0.9.0/version 8 records are not silently reinterpreted with takasia", () => {
  const game = S.apply(S.initialGame(), S.moveVariants(S.initialGame())[0]);
  const record = S.record(game);
  record.version = 8;
  record.rulesVersion = "0.9.0";
  delete record.takasia;
  assert.throws(() => S.replay(record), /v0\.10\.0/);
});
