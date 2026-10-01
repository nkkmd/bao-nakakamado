"use strict";
// Paired, reproducible progression checks; this is not a balance proof.
const fs = require("node:fs"), crypto = require("node:crypto");
const assert = require("node:assert/strict");
const E = require("../prototype/bounce-engine.js");
const S = require("../prototype/steal.js");
const legacy = S.createForEngine(E, { protectLast: false });
const T = require("./one-row-bounce-study.cjs");
const n = Number(process.argv[2] || 1000);
assert.ok(Number.isSafeInteger(n) && n > 0);
const output = process.argv[3] || "tools/nyakua-protect-last-results.json";
const policies = ["random", "noisy", "greedy", "reply"];
const result = { baseCommit: "2321e0caec0784f6aebd84f2e0248d9ba5cd976e",
  rulesVersion: "0.6.1", variantRule: E.RULE_ID, initialHand: 12, totalKete: 44,
  seedStartIndex: 1000, gamesPerPolicyAndRule: n, maxPlies: 400, rows: [],
  checkedTransitions: 0, protectedCandidates: 0, mirrorGames: 0, replayGames: 0,
  sourceSha256: {}, examples: {} };
for (const path of ["prototype/bounce-engine.js", "prototype/steal.js",
  "tools/one-row-bounce-study.cjs", "tools/nyakua-protect-last-study.cjs"]) {
  result.sourceSha256[path] = crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex");
}
for (const policy of policies) for (const [rule, layer] of [["legacy", legacy], ["protect-last", S]]) {
  const row = { policy, rule, games: n, firstWins: 0, plies: 0, maxPlies: 0,
    nyakuaGames: 0, bulkGames: 0, mtajiGames: 0, mtajiMoveGames: 0, passGames: 0,
    reasons: {} };
  for (let i = 0; i < n; i++) {
    const seedIndex = 1000+i, seed = T.seedAt(seedIndex);
    const g = T.game(seed, policy, 0, true, layer);
    row.firstWins += g.winner === 0; row.plies += g.plies;
    row.maxPlies = Math.max(row.maxPlies, g.plies);
    row.nyakuaGames += g.stolen > 0; row.bulkGames += g.bulk > 0;
    row.mtajiGames += g.mtaji;
    row.mtajiMoveGames += g.trace.some(t=>t.before.phase === "mtaji");
    row.passGames += g.trace.some(t=>t.move.type === "pass");
    row.reasons[g.reason] = (row.reasons[g.reason] || 0)+1;
    assert.ok(["front-empty", "no-move"].includes(g.reason));
    if (rule === "protect-last") {
      assert.ok(!g.trace.some(t=>t.move.type === "pass"));
      for (const t of g.trace) {
        const b = t.after, values = [...b.reserve, ...b.pending, ...b.pits.flat(2)];
        assert.ok(values.every(v=>Number.isSafeInteger(v)&&v>=0));
        assert.equal(T.total(b),44);
        if (t.before.phase === "namua" && t.before.reserve[1-t.player] <= 1)
          assert.equal(t.stolen,0);
        if (t.stolen) assert.ok(b.reserve[1-t.player] >= 1);
        if (b.winner === null) assert.ok(S.moveVariants({board:b,history:[]}).length);
        if (t.before.phase === "namua" && t.captures >= 2 && t.before.reserve[1-t.player] === 1
          && !result.examples.protected) result.examples.protected = { seedIndex,policy,trace:g.trace };
        if (t.placed > 1 && !result.examples.bulk) result.examples.bulk = { seedIndex,policy,trace:g.trace };
      }
      if (i < 50) {
        assert.deepEqual(S.replay(g.trace).board, g.board); result.replayGames++;
        const mirror = T.game(seed,policy,1,false,S);
        const swapped = E.clone(g.board);
        [swapped.pits[0],swapped.pits[1]] = [swapped.pits[1],swapped.pits[0]];
        swapped.reserve.reverse(); swapped.houseOwned.reverse(); swapped.pending.reverse();
        swapped.player=1-swapped.player; swapped.winner=1-swapped.winner;
        assert.deepEqual(mirror.board,swapped); assert.equal(mirror.plies,g.plies);
        result.mirrorGames++;
        for (const t of g.trace) for (const move of S.moveVariants({board:t.before,history:[]})) {
          const before={board:t.before,history:[]}, original=E.clone(before);
          const next=S.apply(before,move), animation=S.applyWithEvents(before,move);
          assert.deepEqual(before,original); assert.deepEqual(animation.game,next);
          assert.deepEqual(animation.events.at(-1).state,next.board);
          const old=legacy.apply(before,move), entry=next.history[0];
          const protectedLast=t.before.phase === "namua" && entry.captures >= 2
            && t.before.reserve[1-t.before.player] === 1;
          if (protectedLast) {
            assert.equal(entry.stolen,0); assert.equal(old.history[0].stolen,1);
            old.board.reserve[t.before.player]--;
            old.board.reserve[1-t.before.player]++;
            old.history[0].stolen=0; result.protectedCandidates++;
          }
          assert.deepEqual(next,old); result.checkedTransitions++;
        }
      }
    }
  }
  row.avgPlies=row.plies/n; delete row.plies;
  result.rows.push(row); console.log(JSON.stringify(row));
}
result.status="PASS";
fs.writeFileSync(output,JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify({status:result.status,checkedTransitions:result.checkedTransitions,
  protectedCandidates:result.protectedCandidates,mirrorGames:result.mirrorGames,replayGames:result.replayGames}));
