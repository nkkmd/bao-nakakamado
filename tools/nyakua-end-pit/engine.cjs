"use strict";
// MIT; see ../../LICENSE and ../../prototype/ENGINE_LICENSE.txt.
// Research only. Load guarded adaptations without changing the playable engine.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const sourcePath = path.join(__dirname, '../../prototype/next-turn-engine.js');
const source = fs.readFileSync(sourcePath, 'utf8');
function replaceOnce(s, before, after) {
  if (s.split(before).length !== 2) throw Error('Source guard: ' + before);
  return s.replace(before, after);
}
function load(s) {
  const context = {module: {exports: {}}};
  vm.runInNewContext(s, context);
  return context.module.exports;
}
let plain = replaceOnce(source,
  'const ordinaryCount = Math.min(state.reserve[player], nyakuaCount ? 2 : 1);',
  'const ordinaryCount = Math.min(state.reserve[player], 1);');
plain = replaceOnce(plain, 'const nyakuaCount = state.nyakuaReserve[player];', 'const nyakuaCount = 0;');
const normal = load(plain);
let adapted = replaceOnce(plain, 'finishTurn(state, events);\n    return { state, events };\n  }\n\n  function takeOpposite',
  'finishTurn(state, events, cursor);\n    return { state, events };\n  }\n\n  function takeOpposite');
adapted = replaceOnce(adapted, 'function finishTurn(state, events) {', 'function finishTurn(state, events, endpoint) {');
adapted = replaceOnce(adapted,
  '    if (state.phase === "namua" && state.reserve[0] + state.nyakuaReserve[0] === 0',
  '    const mover = state.player, opponent = 1 - mover;\n'
  + '    const captures = events.filter(e => e.kind === "capture").length;\n'
  + '    if (state.phase === "namua" && endpoint && captures >= 2\n'
  + '      && state.reserve[mover] >= 1 && state.reserve[opponent] >= 2) {\n'
  + '      state.reserve[mover]--; state.reserve[opponent]--;\n'
  + '      setAt(state, endpoint, countAt(state, endpoint) + 2);\n'
  + '      snapshotEvent(events, state, "end-pit-add", {position: endpoint, count: 2});\n'
  + '    }\n'
  + '    if (state.phase === "namua" && state.reserve[0] + state.nyakuaReserve[0] === 0');
const candidate = load(adapted);
function diagnostic(engineSource) {
  return load(replaceOnce(engineSource, '      relays += 1;',
    '      relays += 1;\n'
    + '      snapshotEvent(events, state, "study-loop", {cursor, direction, captureTurn, relays,\n'
    + '        loopKey: JSON.stringify([state.pits,state.reserve,state.houseOwned,state.pending,state.player,state.phase,cursor,direction,captureTurn])});'));
}
const current = require('../../prototype/next-turn-engine.js');
const currentRules = require('../../prototype/steal.js').createForEngine(current);
function advance(model, b, m, snapshots = false, diagnose = false) {
  if (model === 'current') {
    const r = currentRules.applyMoveForSearch(b, m);
    return {b: r.state, events: r.events, entry: r.summary};
  }
  const E = diagnose ? diagnostic(model === 'A' ? adapted : plain) : model === 'A' ? candidate : normal;
  const {state: after, events} = E.applyMove(b, m, {snapshots});
  return {b: after, events, entry: {player: b.player, move: m,
    placed: events.find(e => e.kind === 'reserve')?.count || 0,
    captures: events.filter(e => e.kind === 'capture').length,
    stolen: Number(events.some(e => e.kind === 'end-pit-add')),
    endpoint: events.find(e => e.kind === 'end-pit-add')?.position || null}};
}
// Independent end-of-turn accounting on the unmodified post-sowing baseline.
// It shares the historical sowing engine, not an independent implementation of Bao.
function oracle(b, m) {
  const r = normal.applyMove(b, m, {snapshots: false});
  const after = r.state, p = b.player, o = 1 - p;
  if (after.winner !== null && after.reason !== 'no-move') return after;
  after.player = p; after.turn = b.turn; after.phase = b.phase;
  after.winner = null; after.reason = '';
  const captures = r.events.filter(e => e.kind === 'capture').length;
  const endpoint = r.events.filter(e => e.kind === 'sow').at(-1)?.position;
  if (b.phase === 'namua' && m.type !== 'pass' && endpoint && captures >= 2
    && after.reserve[p] > 0 && after.reserve[o] > 1) {
    after.reserve[p]--; after.reserve[o]--;
    after.pits[p][endpoint.row][endpoint.index] += 2;
  }
  if (after.phase === 'namua' && after.reserve.every(n => n === 0)) after.phase = 'mtaji';
  after.player = o; after.turn++;
  if (!normal.legalMoves(after).length) {after.winner = p; after.reason = 'no-move';}
  return after;
}
function engine(model) {return model === 'A' ? candidate : model === 'none' ? normal : current;}
module.exports = {engine, advance, oracle, sourcePath};
