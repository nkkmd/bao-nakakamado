"use strict";
// MIT. Compare the playable trial with the preserved research implementation.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const R = require("../../tools/nyakua-end-pit/engine.cjs");
const E = require("./engine.js"), S = require("./rules.js");
const same = (a,b) => assert.equal(JSON.stringify(a), JSON.stringify(b));
const total = b => [...b.pits.flat(2), ...b.reserve, ...b.nyakuaReserve, ...b.pending].reduce((a,n)=>a+n,0);
const report = {status:"PASS", games:0, transitions:0, snapshots:0, additions:0, backAdditions:0,
  houseAdditions:0, frontEmpty:0, mtaji:0, passes:0, cycles:0, boundaryChecks:[]};
function compare(b,m,snapshots=false) {
  const input = E.clone(b), expected = R.advance("A",b,m);
  const result = snapshots ? S.applyWithEvents({board:b,history:[]},m)
    : {game:S.apply({board:b,history:[]},m)};
  const after = result.game.board, entry = result.game.history.at(-1);
  same(after,expected.b); same(b,input); assert.equal(total(after),total(b));
  assert.ok([...after.pits.flat(2),...after.reserve,...after.pending].every(n=>Number.isInteger(n)&&n>=0));
  same(after.nyakuaReserve,[0,0]);
  for (const k of ["player","placed","captures","stolen","endpoint"]) same(entry[k],expected.entry[k]);
  if (snapshots) {same(result.events.at(-1).state,after); report.snapshots++;}
  if (entry.stolen) {
    report.additions++; assert.equal(entry.added,2); assert.equal(entry.ownAdded,1); assert.equal(entry.opponentAdded,1);
    assert.equal(after.reserve[b.player],b.reserve[b.player]-2);
    assert.equal(after.reserve[1-b.player],b.reserve[1-b.player]-1);
    assert.ok(after.reserve[1-b.player]>=1);
    if(entry.endpoint.row===1)report.backAdditions++;
    if(entry.endpoint.row===0&&entry.endpoint.index===4)report.houseAdditions++;
    if(snapshots) assert.equal(result.events.filter(e=>e.kind==="end-pit-add").length,1);
  }
  if(after.reason==="front-empty"||after.reason==="relay-limit")assert.equal(entry.added,0);
  if(after.reason==="front-empty")report.frontEmpty++;
  if(b.phase==="mtaji") {same(after,R.advance("none",b,m).b); report.mtaji++;}
  if(m.type==="pass")report.passes++;
  report.transitions++;return result.game;
}
const fixtures = require("../../tools/nyakua-end-pit/results/checks.json").examples;
for(const [name,f] of Object.entries(fixtures)) {
  compare(f.before,f.move,true); report.boundaryChecks.push(name);
}
let seed=20261007;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(let i=0;i<100;i++) {
  let game=S.initialGame();
  for(let ply=0;ply<200&&game.board.winner===null;ply++) {
    const moves=S.moveVariants(game); assert.ok(moves.length);
    const results=moves.map(m=>compare(game.board,m,report.transitions%29===0));
    const n=Math.floor(random()*results.length);
    game={board:results[n].board,history:[...game.history,results[n].history[0]]};
  }
  same(S.replay(S.record(game)),game); report.games++;
}
assert.equal(report.passes,0);
assert.ok(report.backAdditions&&report.houseAdditions&&report.frontEmpty&&report.mtaji);
const dir=path.join(__dirname,"../../tools/nyakua-continue/results/search4");
for(const name of fs.readdirSync(dir).filter(n=>/^anomaly-A-.*\.json$/.test(n))) {
  const saved=JSON.parse(fs.readFileSync(path.join(dir,name))), game=saved.history.reduce((g,turn)=>{
    const next=compare(g.board,turn.move,true); same(next.board,turn.after);
    return {board:next.board,history:[...g.history,next.history[0]]};
  },S.initialGame());
  assert.equal(game.board.reason,"relay-limit");
  const record=S.record(game);assert.equal(record.adjudication,"safety-stop");assert.equal(record.outcome.winner,null);
  same(S.replay(record),game);report.cycles++;
}
const game=S.apply(S.initialGame(),S.moveVariants(S.initialGame())[0]);
const bad=S.record(game);bad.history[0].added++;assert.throws(()=>S.replay(bad),/mismatch/);
assert.throws(()=>S.replay({format:"bao-nakakamado-prototype",version:7,rulesVersion:"0.8.0",history:[]}),/supported/);
const reserved=E.initialState();reserved.nyakuaReserve[0]=1;
assert.throws(()=>S.apply({board:reserved,history:[]},E.legalMoves(reserved)[0]),/reserved hand/);
const out=process.argv[2];if(out)fs.writeFileSync(out,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report));
