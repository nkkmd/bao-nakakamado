"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const E = require("../../prototype/next-turn-engine.js"), Q = require("../../prototype/search-transition.js").createForEngine(E);
const Factory = require("../../prototype/search-ai.js"), A = Factory.createAI(Q, {now: () => 0});
const C = require("../nyakua-three/core.cjs"), Oracle = require("./search-oracle.cjs");
const spec = require("./search-verification-spec.json");
const plain = x => JSON.parse(JSON.stringify(x));
const freeze = x => { if (x && typeof x === "object") {Object.values(x).forEach(freeze);Object.freeze(x);}return x; };
function verify() {
  const samples = new Map();
  for (const policy of spec.policies) for (let i = 0; i < spec.seedsPerPolicy; i++) {
    const seed = C.seedAt(spec.seedStartIndex + i), game = C.play("three", [policy, policy], seed, 0, true);
    const plies = [...spec.samplePlies, ...(spec.sampleLastNonTerminal ? [game.path.length - 1] : [])];
    for (const ply of plies) {
      const source = ply === 0 ? E.initialState() : game.path[ply - 1]?.after;
      if (!source || source.winner !== null) continue;
      const state = plain(source);
      const key = Q.stateKey(state); if (!samples.has(key)) samples.set(key, {policy, seed, ply, state});
    }
  }
  const positions = [...samples.values()], coverage = {namua: 0, mtaji: 0, southToMove: 0, northToMove: 0, ownReserved: 0, opponentReserved: 0};
  let comparisons = 0, oracleNodes = 0, candidateNodes = 0, cacheHits = 0, pvsResearches = 0, aspirationResearches = 0;
  const digest = crypto.createHash("sha256");
  for (const sample of positions) {
    const b = freeze(sample.state), before = JSON.stringify(b);
    coverage[b.phase]++;coverage.ownReserved += b.nyakuaReserve[b.player]>0;coverage.opponentReserved += b.nyakuaReserve[1-b.player]>0;
    coverage[b.player===0?"southToMove":"northToMove"]++;
    for (const depth of spec.depths) for (const q of spec.quiescenceDepths) {
      const expected = Oracle.solve(b, depth, q); oracleNodes += expected.nodes;
      for (let preset = 0; preset < spec.presets.length; preset++) {
        const result = A.analyzeMove(b, {...spec.presets[preset], maxDepth: depth, quiescenceDepth: q});
        assert.equal(result.stats.completedDepth, depth);assert.equal(result.stats.timedOut, false);
        assert.equal(result.stats.rootScore, expected.score);
        assert.ok(expected.bestMoves.some(m => A.moveKey(m) === A.moveKey(result.move)));
        assert.ok(Q.moveVariants(b).some(m => A.moveKey(m) === A.moveKey(result.move)));
        assert.equal(JSON.stringify(b), before);
        comparisons++; candidateNodes += result.stats.nodes; cacheHits += result.stats.cacheHits;
        pvsResearches += result.stats.pvsResearches; aspirationResearches += result.stats.aspirationResearches;
        const row = {policy: sample.policy, seed: sample.seed, ply: sample.ply, depth, quiescenceDepth: q, preset,
          score: expected.score, selected: result.move, nodes: result.stats.nodes, safetyStops: result.stats.safetyStops};
        digest.update(JSON.stringify(row)+"\n");
      }
    }
  }
  for(const [name,n] of Object.entries(coverage))assert.ok(n>0,"Missing coverage: "+name);
  assert.ok(cacheHits>0&&pvsResearches>0&&aspirationResearches>0);
  const timings=[];
  const timed=Factory.createAI(Q);
  for(const sample of positions.slice(0,spec.timingSmoke.positions))for(const limit of spec.timingSmoke.timeLimitMs){
    const r=timed.analyzeMove(sample.state,{maxDepth:spec.timingSmoke.maxDepth,timeLimitMs:limit});
    assert.ok(Q.moveVariants(sample.state).some(m=>A.moveKey(m)===A.moveKey(r.move)));
    if(r.stats.completedDepth===0)assert.equal(r.stats.rootScore,null);
    timings.push({policy:sample.policy,seed:sample.seed,ply:sample.ply,timeLimitMs:limit,elapsedMs:r.stats.elapsedMs,
      completedDepth:r.stats.completedDepth,timedOut:r.stats.timedOut});
  }
  const sources={};
  for(const file of ["prototype/search-ai.js","prototype/search-evaluator.js","prototype/search-ai.test.cjs",
    "prototype/search-transition.js","prototype/steal.js","prototype/next-turn-engine.js",
    "tools/ai-integration/search-oracle.cjs","tools/ai-integration/verify-search.cjs","tools/ai-integration/search-verification-spec.json"]){
    sources[file]=crypto.createHash("sha256").update(fs.readFileSync(path.join(__dirname,"../..",file))).digest("hex");
  }
  return {status:"PASS",verificationId:spec.verificationId,scope:spec.scope,rulesVersion:E.RULES_VERSION,
    searchId:Factory.SEARCH_ID,evaluatorId:require("../../prototype/search-evaluator.js").ID,
    positions:positions.length,comparisons,coverage,scoreMismatches:0,nonOptimalMoves:0,illegalMoves:0,inputMutations:0,
    oracleNodes,candidateNodes,cacheHits,pvsResearches,aspirationResearches,traceSha256:digest.digest("hex"),sources,
    samples:positions.map(({state,...meta})=>meta),timings};
}
if(require.main===module){const result=verify();if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+"\n");
  const {sources,samples,timings,...summary}=result;console.log(JSON.stringify({...summary,timingRuns:timings.length},null,2));}
module.exports={verify};
