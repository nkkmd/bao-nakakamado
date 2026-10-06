"use strict";
// MIT; see ../../LICENSE. Additional research, never changes the public engine.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const crypto = require('node:crypto'), assert = require('node:assert/strict');
const c = require('../nyakua-end-pit/core.cjs'), proof = require('../nyakua-end-pit/proof.cjs');
const ring = require('./ring.cjs');
const BASE = 'a0a6514f54a53b463f9c514f0b278400fa6662cd';
const OUT = path.join(__dirname, 'results');
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const clone = x => JSON.parse(JSON.stringify(x));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function save(name, value) { fs.mkdirSync(OUT, {recursive: true}); fs.writeFileSync(path.join(OUT, name), JSON.stringify(value, null, 2) + '\n'); }
function sourceTrace(b, m) {
  let s = fs.readFileSync(c.R.sourcePath, 'utf8');
  const before = '      relays += 1;'; assert.equal(s.split(before).length, 2);
  s = s.replace(before, before + '\n      snapshotEvent(events,state,"trace-cycle",{cursor,direction,captureTurn,relays});');
  const ctx = {module: {exports: {}}}; vm.runInNewContext(s, ctx);
  const r = ctx.module.exports.applyMove(b, m);
  return {r, trace: r.events.filter(e => e.kind === 'trace-cycle')};
}
function inputs() {
  const root = path.join(__dirname, '../nyakua-continue/results/search4');
  const files = fs.readdirSync(root).filter(f => /^anomaly-A-\d+-[01]\.json$/.test(f)).sort();
  assert.equal(files.length, 11);
  const cases = files.map(file => { const raw = fs.readFileSync(path.join(root, file)); return {file, sha256: sha(raw), game: JSON.parse(raw)}; });
  const before = cases[0].game.history.at(-2).after, move = cases[0].game.history.at(-1).move;
  assert.equal(before.phase, 'mtaji'); assert.equal(before.turn, 40); assert.equal(before.player, 1);
  assert.ok(before.reserve.every(n => n === 0) && before.nyakuaReserve.every(n => n === 0));
  for (const x of cases) {
    assert.ok(same(x.game.history.at(-2).after, before)); assert.ok(same(x.game.history.at(-1).move, move));
    let b = c.R.engine('A').initialState();
    for (const h of x.game.history) { b = c.R.advance('A', b, h.move).b; assert.ok(same(b, h.after)); c.validate(b); }
  }
  return {cases, before, move};
}
function fixedValues(b, depth) {
  const p = b.player, memo = new Map(); let nodes = 0;
  function solve(b, d) {
    nodes++; if (b.winner !== null || !d) return c.score('A', b, p);
    const k = d + ':' + c.key(b); if (memo.has(k)) return memo.get(k);
    const values = c.children('A', b).map(x => solve(x.b, d - 1));
    const v = b.player === p ? Math.max(...values) : Math.min(...values); memo.set(k, v); return v;
  }
  const openings = c.children('A', b).map(x => ({move: x.m, value: solve(x.b, depth - 1)}));
  return {depth, nodes, openings};
}
function replayCounterfactual(game, mode) {
  let b = c.R.engine(mode === 'none' ? 'none' : 'A').initialState();
  let firstDifference = null, illegalAt = null, phaseAt = null;
  const bonuses = [], history = [];
  for (let i = 0; i < game.history.length; i++) {
    const h = game.history[i], model = mode === 'none' || mode === i + 1 ? 'none' : 'A';
    try {
      const r = c.R.advance(model, b, h.move); b = r.b; c.validate(b); history.push({move: h.move, after: b});
      if (r.entry.stolen) bonuses.push(i + 1);
      if (firstDifference === null && !same(b, h.after)) firstDifference = i + 1;
      if (phaseAt === null && b.phase === 'mtaji') phaseAt = i + 1;
      if (b.winner !== null) break;
    } catch (e) { if (e.message !== 'Illegal move') throw e; illegalAt = i + 1; break; }
  }
  return {mode, firstDifference, movesReplayed: history.length, illegalAt, phaseAt, bonuses,
    final: b, targetReached: same(b, game.history.at(-2).after)};
}
function structure() {
  const {cases, before, move} = inputs(), source = sourceTrace(before, move);
  const independent = ring.simulate(ring.flatten(before.pits[before.player]), ring.index(move), move.direction, {trace: true});
  assert.equal(independent.status, 'cycle'); assert.equal(independent.period, 272);
  for (let i = 0; i < independent.states.length; i++) {
    const a = independent.states[i], e = source.trace[i];
    assert.ok(same(a.ring, ring.flatten(e.state.pits[before.player])));
    assert.equal(a.cursor, ring.index(e.cursor)); assert.equal(a.direction, e.direction); assert.equal(e.captureTurn, false);
    assert.ok(same(e.state.pits[1-before.player], before.pits[1-before.player]));
  }
  const repeat = source.trace[independent.repeatBatch - 1], first = source.trace[independent.firstBatch - 1];
  assert.ok(same(first.state.pits, repeat.state.pits)); assert.ok(same(first.cursor, repeat.cursor));
  for (const k of ['reserve','nyakuaReserve','houseOwned','pending','player','phase']) assert.ok(same(first.state[k],repeat.state[k]));
  const outcomes = ['A','current','none'].map(model => ({model, after: c.R.advance(model, before, move).b}));
  assert.ok(outcomes.every(x => same(x.after, outcomes[0].after)));
  const alternatives = c.children('A', before).map(x => {
    assert.equal(x.m.type, 'takata');
    const r = ring.simulate(ring.flatten(before.pits[before.player]), ring.index(x.m), x.m.direction);
    if (r.status === 'finite') assert.ok(same(r.final, ring.flatten(x.b.pits[before.player])));
    return {move: x.m, independent: r, after: x.b, score: c.score('A', x.b, before.player)};
  });
  const sensitivity = [], a = ring.flatten(before.pits[before.player]);
  for (let from = 0; from < 16; from++) if (a[from] > 0) for (let to = 0; to < 16; to++) if (to !== from) {
    const changed = a.slice(); changed[from]--; changed[to]++;
    if (changed[ring.index(move)] < 2) continue;
    const b = clone(before); b.pits[b.player] = ring.rows(changed); c.validate(b);
    const legal = c.R.engine('A').legalMoves(b).some(m => same(m, move));
    const r = ring.simulate(changed, ring.index(move), move.direction);
    if (legal && r.status === 'finite') {
      const after = c.R.advance('A', b, move).b;
      if (r.relays < 512) assert.ok(same(r.final, ring.flatten(after.pits[b.player])));
    }
    sensitivity.push({from, to, legal, status: r.status, batches: r.batches, period: r.period || null});
  }
  const history = cases[0].game.history, bonusTurns = history.flatMap((h, i) => h.entry.stolen ? [i + 1] : []);
  const paths = cases.map(x => sha(JSON.stringify(x.game.history.map(h => h.move))));
  const provenance = ['prototype/next-turn-engine.js','prototype/steal.js','tools/nyakua-end-pit/engine.cjs','tools/nyakua-end-pit/core.cjs','tools/nyakua-end-pit/proof.cjs'].map(p => ({path: p, sha256: sha(fs.readFileSync(path.join(__dirname, '../..', p)))}));
  const result = {status: 'PASS',baseCommit: BASE,node: process.version,provenance,
    cases: cases.map(x => ({file: '../nyakua-continue/results/search4/' + x.file,sha256:x.sha256,seed:x.game.seed,swapStreams:x.game.swapStreams})),
    paths: {observations: cases.length, uniqueMoveSequences: new Set(paths).size, pathHash: paths[0], bonusTurns,
      mtajiAfterPly: history.findIndex(h => h.after.phase === 'mtaji') + 1},
    before, move, independent: {...independent, states: undefined}, comparedSnapshots: independent.states.length,
    captures: source.r.events.filter(e => e.kind === 'capture').length, additions: source.r.events.filter(e => e.kind === 'reserve').length,
    sameMoveThreeModels: true, alternatives, fixedSearch4: fixedValues(before, 4),
    counterfactuals: ['none', ...bonusTurns].map(mode => replayCounterfactual(cases[0].game, mode)), sensitivity};
  save('structure.json', result); save('cycle-trace.json', independent.states);
  console.log(JSON.stringify({status: result.status,cycle:result.independent,paths:result.paths,search:result.fixedSearch4,
    alternatives:alternatives.map(x=>({move:x.move,independent:x.independent,score:x.score})),
    counterfactuals:result.counterfactuals.map(x=>({...x,final:undefined})),
    sensitivity:sensitivity.reduce((a,x)=>{const k=(x.legal?'legal:':'illegal:')+x.status;a[k]=(a[k]||0)+1;return a;},{})}));
  return result;
}
function alternatives() {
  const s = JSON.parse(fs.readFileSync(path.join(OUT, 'structure.json'))), records = [];
  for (const [i, x] of s.alternatives.entries()) {
    if (x.independent.status !== 'finite') continue;
    const name = 'alternative-' + i + '.json', file = path.join(OUT, name);
    if (fs.existsSync(file)) {
      const record = JSON.parse(fs.readFileSync(file));
      assert.ok(same(record.root,x.after)); assert.ok(same(record.provenance,s.provenance));
      assert.equal(record.maxDepth,14); assert.equal(record.budget,100000); records.push(record); continue;
    }
    const r = proof.bounded('A', x.after, {maxDepth: 14, budget: 100000, deadlineMs: 45000});
    if (r.certificate) { proof.verify(r.certificate); save('certificate-' + i + '.json', r.certificate); }
    const record = {provenance:s.provenance,maxDepth:14,budget:100000,move: x.move, root: x.after, records: r.records, certificate: r.certificate ? 'certificate-' + i + '.json' : null};
    save(name, record); records.push(record); console.log(JSON.stringify({move:x.move,completed:r.records.filter(x=>x.result==='UNKNOWN').at(-1)?.depth,last:r.records.at(-1).result,certificate:record.certificate}));
  }
  save('alternatives.json', {status:'PASS',maxDepth:14,nodesPerDepth:100000,deadlineMsPerAlternative:45000,records});
}
function continuations() {
  const s = JSON.parse(fs.readFileSync(path.join(OUT, 'structure.json'))), records = [];
  const seed = 2026100601, policy = 'search4';
  for (const [i,x] of s.alternatives.entries()) {
    if (x.independent.status !== 'finite') continue;
    let b = x.after, cutoff = null;
    const random = c.rng(seed), seen = new Set([c.key(b)]), history = [];
    const stats = {searchNodes:0,budgetStops:0,completedDepthSum:0,searchDecisions:0};
    while (b.winner === null && history.length < 200) {
      const r = c.choose('A',b,policy,random,stats); b = r.b; c.validate(b);
      history.push({move:r.m,after:b});
      if (b.reason === 'relay-limit') {cutoff='relay-limit'; break;}
      if (b.winner === null && seen.has(c.key(b))) {cutoff='repetition'; break;} seen.add(c.key(b));
    }
    if (b.winner === null && !cutoff) cutoff='200-ply';
    let replay = x.after;
    for (const h of history) {replay=c.R.advance('A',replay,h.move).b; assert.ok(same(replay,h.after));}
    const record = {move40:x.move,seed,policy,randomStream:'one shared xorshift32 stream; descriptive continuation only',
      pliesAfter40:history.length,winner:cutoff?null:b.winner,reason:cutoff||b.reason,stats,history};
    save('continuation-'+i+'.json',record);records.push({...record,history:undefined});
  }
  save('continuations.json',{status:'PASS',records});console.log(JSON.stringify(records));
}
if (require.main === module) {
  if (process.argv[2] === 'structure') structure();
  else if (process.argv[2] === 'alternatives') alternatives();
  else if (process.argv[2] === 'continuations') continuations();
  else throw Error('Use: node tools/nyakua-mtaji-cycle/run.cjs structure|alternatives|continuations');
}
module.exports = {structure,alternatives,continuations,sourceTrace,inputs,fixedValues};
