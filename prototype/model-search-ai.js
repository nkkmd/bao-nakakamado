"use strict";

// Adapted from Bao la Kiswahili public/ai.js (enhancedSearch/phase2) at
// 8c87ed44c9b08f75456766f0a9bd9f76d06209d4.
// Copyright (c) 2026 cultivationdata.net. MIT; see ENGINE_LICENSE.txt.
// Fork of prototype/search-ai.js (SHA-256 d74569196382b0aea1bbf251454788b009d9962d249232a32c2e4c13f190dc65).
// Development-only evaluator injection; original teacher search stays frozen.
(function exposeModelSearchAI(root) {
  const SEARCH_ID = "NAKAKAMADO-MODEL-SEARCH-v1";
  const DEFAULTS = Object.freeze({maxDepth: 4, timeLimitMs: 500, quiescenceDepth: 1,
    maxTableEntries: 50_000, maxEvaluationCacheEntries: 2_048,
    transpositionTable: true, evaluationCache: true, pvs: true,
    ttMoveFirst: false, orderQuiescenceCaptures: false, historyHeuristic: false,
    aspirationWindow: 0});
  function moveKey(move) {
    if (!move) return "";
    return [move.type, move.phase, move.row, move.index, move.direction, move.side,
      move.houseChoice, Boolean(move.houseTwo)].join(":");
  }
  function optionsFor(options) {
    for (const k of Object.keys(options)) if (!Object.hasOwn(DEFAULTS, k)) throw new Error("Unknown search option: " + k);
    const o = {...DEFAULTS, ...options};
    for (const [k, low, high] of [["maxDepth", 1, 32], ["quiescenceDepth", 0, 8],
      ["maxTableEntries", 1, 100_000], ["maxEvaluationCacheEntries", 1, 100_000], ["aspirationWindow", 0, 100_000]]) {
      if (!Number.isSafeInteger(o[k]) || o[k] < low || o[k] > high) throw new Error("Invalid search option: " + k);
    }
    if (!Number.isFinite(o.timeLimitMs) || o.timeLimitMs < 0 || o.timeLimitMs > 60_000) throw new Error("Invalid search option: timeLimitMs");
    for (const k of ["transpositionTable", "evaluationCache", "pvs", "ttMoveFirst", "orderQuiescenceCaptures", "historyHeuristic"]) {
      if (typeof o[k] !== "boolean") throw new Error("Invalid search option: " + k);
    }
    return o;
  }
  function createAI(Q, {now = () => typeof performance !== "undefined" ? performance.now() : Date.now(), evaluator} = {}) {
    if (!Q.stateKey || !Q.outcome || !Q.NYAKUA_NEXT_TURN_THREE) throw new Error("NYAKUA search adapter required");
    if (!evaluator || typeof evaluator.ID !== "string" || evaluator.WIN !== 1_000_000
      || typeof evaluator.evaluate !== "function" || typeof evaluator.breakdown !== "function") {
      throw new Error("Integer evaluator with fixed terminal scale required");
    }
    const V = evaluator, WIN = V.WIN;
    function analyzeMove(state, options = {}) {
      const o = optionsFor(options), startedAt = now(), deadline = startedAt + o.timeLimitMs;
      const timeout = Symbol("search-timeout");
      const stats = {searchId: SEARCH_ID, evaluatorId: V.ID, nodes: 0, quiescenceNodes: 0,
        cutoffs: 0, cacheHits: 0, cacheStores: 0, evaluationRequests: 0, evaluations: 0,
        evaluationCacheHits: 0, evaluationCacheEvictions: 0, cachePeak: 0, evaluationCachePeak: 0,
        pvsResearches: 0, aspirationResearches: 0, historyUpdates: 0, safetyStops: 0,
        completedDepth: 0, rootScore: null, timedOut: false, elapsedMs: 0, allocatedTimeMs: o.timeLimitMs};
      const check = () => { if (now() >= deadline) throw timeout; };
      const table = new Map(), evaluationCache = new Map(), killers = new Map(), history = new Map();
      const player = state.player;
      function terminalScore(b, ply) {
        const status = Q.outcome(b);
        if (status === "safety-stop") { stats.safetyStops++; return 0; }
        if (status === "normal-terminal") return b.winner === player ? WIN - ply : -WIN + ply;
        return null;
      }
      function evaluate(b) {
        check(); stats.evaluationRequests++;
        const key = player + "|" + Q.stateKey(b);
        if (o.evaluationCache && evaluationCache.has(key)) {
          stats.evaluationCacheHits++; return evaluationCache.get(key);
        }
        const value = V.evaluate(b, player, check);
        const bound = Q.outcome(b) === "normal-terminal" ? WIN : 100_000;
        if (!Number.isSafeInteger(value) || Math.abs(value) > bound) throw new Error("Invalid heuristic integer score");
        stats.evaluations++; check();
        if (o.evaluationCache) {
          if (evaluationCache.size >= o.maxEvaluationCacheEntries) {
            evaluationCache.delete(evaluationCache.keys().next().value); stats.evaluationCacheEvictions++;
          }
          evaluationCache.set(key, value); stats.evaluationCachePeak = Math.max(stats.evaluationCachePeak, evaluationCache.size);
        }
        return value;
      }
      function ordered(b, ply, preferred, captureOnly = false) {
        check(); const moves = Q.moveVariants(b); check();
        const choices = [];
        for (const move of moves) {
          if (captureOnly && move.type !== "capture") continue;
          check(); const r = Q.applyMove(b, move); check();
          const normalWin = Q.outcome(r.state) === "normal-terminal" && r.state.winner === b.player;
          const captured = r.events.filter(e => e.kind === "capture").reduce((n, e) => n + e.count, 0);
          choices.push({move, next: r.state, immediateWin: Number(normalWin), captured,
            preferred: Number(moveKey(move) === preferred), killer: Number(moveKey(move) === killers.get(ply)),
            historyScore: o.historyHeuristic ? history.get(b.player + ":" + moveKey(move)) || 0 : 0,
            staticScore: captureOnly || normalWin || captured ? 0 : evaluate(r.state)});
        }
        if (captureOnly && !o.orderQuiescenceCaptures) return choices;
        const max = b.player === player;
        return choices.sort((a, z) => z.immediateWin - a.immediateWin
          || (o.ttMoveFirst ? z.preferred - a.preferred : 0) || z.captured - a.captured
          || (o.ttMoveFirst ? 0 : z.preferred - a.preferred) || z.killer - a.killer
          || z.historyScore - a.historyScore || (max ? z.staticScore - a.staticScore : a.staticScore - z.staticScore));
      }
      function quiescence(b, alpha, beta, ply, remaining) {
        check(); stats.nodes++; stats.quiescenceNodes++;
        const terminal = terminalScore(b, ply); if (terminal !== null) return terminal;
        if (remaining === 0) return evaluate(b);
        const captures = ordered(b, ply, "", true);
        if (!captures.length) return evaluate(b);
        const max = b.player === player; let best = max ? -Infinity : Infinity;
        // Captures are compulsory. There is no optional stand-pat branch.
        for (const c of captures) {
          const value = quiescence(c.next, alpha, beta, ply + 1, remaining - 1);
          best = max ? Math.max(best, value) : Math.min(best, value);
          if (max) alpha = Math.max(alpha, best); else beta = Math.min(beta, best);
          if (alpha >= beta) { stats.cutoffs++; break; }
        }
        return best;
      }
      let rootMove = null;
      function search(b, depth, alpha, beta, ply) {
        check(); stats.nodes++;
        const terminal = terminalScore(b, ply); if (terminal !== null) return terminal;
        if (depth === 0) return quiescence(b, alpha, beta, ply, o.quiescenceDepth);
        // Ply remains part of the key, preserving mate-distance scores.
        const key = Q.stateKey(b) + "@" + ply;
        const cached = o.transpositionTable ? table.get(key) : null;
        if (cached && cached.depth >= depth) {
          stats.cacheHits++;
          if (cached.flag === "exact") { if (ply === 0) rootMove = cached.move; return cached.value; }
          if (cached.flag === "lower") alpha = Math.max(alpha, cached.value); else beta = Math.min(beta, cached.value);
          if (alpha >= beta) return cached.value;
        }
        const windowAlpha = alpha, windowBeta = beta;
        const choices = ordered(b, ply, cached?.bestMove || "");
        if (!choices.length) return b.player === player ? -WIN + ply : WIN - ply;
        const max = b.player === player; let best = max ? -Infinity : Infinity, bestMove = choices[0].move;
        for (let i = 0; i < choices.length; i++) {
          const c = choices[i]; let value;
          if (!o.pvs || i === 0) value = search(c.next, depth - 1, alpha, beta, ply + 1);
          else if (max) {
            value = search(c.next, depth - 1, alpha, alpha + 1, ply + 1);
            if (value > alpha && value < beta) { stats.pvsResearches++; value = search(c.next, depth - 1, alpha, beta, ply + 1); }
          } else {
            value = search(c.next, depth - 1, beta - 1, beta, ply + 1);
            if (value < beta && value > alpha) { stats.pvsResearches++; value = search(c.next, depth - 1, alpha, beta, ply + 1); }
          }
          if ((max && value > best) || (!max && value < best)) { best = value; bestMove = c.move; }
          if (max) alpha = Math.max(alpha, best); else beta = Math.min(beta, best);
          if (alpha >= beta) {
            stats.cutoffs++;
            if (c.move.type !== "capture") {
              killers.set(ply, moveKey(c.move));
              if (o.historyHeuristic) { const k = b.player + ":" + moveKey(c.move);
                history.set(k, (history.get(k) || 0) + depth * depth); stats.historyUpdates++; }
            }
            break;
          }
        }
        if (o.transpositionTable) {
          if (table.size >= o.maxTableEntries && !table.has(key)) table.delete(table.keys().next().value);
          table.set(key, {depth, value: best, move: bestMove, bestMove: moveKey(bestMove),
            flag: best <= windowAlpha ? "upper" : best >= windowBeta ? "lower" : "exact"});
          stats.cacheStores++; stats.cachePeak = Math.max(stats.cachePeak, table.size);
        }
        if (ply === 0) rootMove = bestMove;
        return best;
      }
      const outcome = Q.outcome(state);
      let bestMove = null;
      if (outcome !== "ongoing") stats.rootScore = terminalScore(state, 0);
      else {
        // A legal fallback is available even when no depth finishes. Its score
        // stays null, so it cannot masquerade as a completed teacher label.
        const legal = Q.moveVariants(state); bestMove = legal[0] || null;
        if (legal.length) for (let depth = 1; depth <= o.maxDepth; depth++) {
          try {
            check(); let alpha = -Infinity, beta = Infinity;
            if (o.aspirationWindow > 0 && stats.rootScore !== null) {
              alpha = stats.rootScore - o.aspirationWindow; beta = stats.rootScore + o.aspirationWindow;
            }
            let score = search(state, depth, alpha, beta, 0);
            if (score <= alpha || score >= beta) {
              stats.aspirationResearches++; score = search(state, depth, -Infinity, Infinity, 0);
            }
            bestMove = rootMove; stats.rootScore = score; stats.completedDepth = depth;
          } catch (error) { if (error !== timeout) throw error; stats.timedOut = true; break; }
        }
      }
      stats.elapsedMs = Math.max(0, now() - startedAt);
      return {move: bestMove ? {...bestMove} : null, stats, outcome,
        scoreMeaning: outcome === "safety-stop" || stats.safetyStops > 0 ? "heuristic-with-unresolved-safety-stop"
          : stats.completedDepth ? "completed-depth-heuristic" : outcome === "normal-terminal" ? "terminal" : "unscored-fallback"};
    }
    return Object.freeze({SEARCH_ID, DEFAULTS, analyzeMove,
      chooseMove: (state, options) => analyzeMove(state, options).move,
      evaluate: V.evaluate, evaluationBreakdown: V.breakdown, moveKey, stateKey: Q.stateKey});
  }
  root.NakakamadoModelSearchAI = Object.freeze({createAI, SEARCH_ID, DEFAULTS, moveKey});
  if (typeof module !== "undefined" && module.exports) module.exports = root.NakakamadoModelSearchAI;
}(typeof window !== "undefined" ? window : globalThis));
