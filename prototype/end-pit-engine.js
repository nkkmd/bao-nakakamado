"use strict";

// Playable v0.10.0: NYAKUA proposal A plus the adopted takasia rule.
// Frozen v0.8.0 and the v0.9.0 adoption record are retained separately.
// NYAKUA adds one KETE from each hand to a qualifying completed NAMUA move endpoint.
// MIT; original attribution retained in ENGINE_LICENSE.txt.

(function exposeBaoEngine(root) {
  const FRONT = 0;
  const BACK = 1;
  const HOUSE = 4;
  const MAX_RELAY = 512;
  const compactEventLists = new WeakSet();
  const SEARCH_RECORDING = Object.freeze({ snapshots: false });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function initialState() {
    const empty = () => [Array(8).fill(0), Array(8).fill(0)];
    const pits = [empty(), empty()];
    for (let player = 0; player < 2; player += 1) {
      pits[player][FRONT][4] = 6;
      pits[player][FRONT][5] = 2;
      pits[player][FRONT][6] = 2;
    }
    return {
      pits,
      reserve: [22, 22],
      nyakuaReserve: [0, 0],
      houseOwned: [true, true],
      player: 0,
      phase: "namua",
      winner: null,
      reason: "",
      turn: 1,
      pending: [0, 0],
      takasia: null,
    };
  }

  function pit(player, row, index) {
    return { player, row, index };
  }

  function countAt(state, position) {
    return state.pits[position.player][position.row][position.index];
  }

  function setAt(state, position, value) {
    state.pits[position.player][position.row][position.index] = value;
  }

  function ring(direction) {
    const result = [];
    if (direction === "right") {
      for (let i = 0; i < 8; i += 1) result.push({ row: FRONT, index: i });
      for (let i = 7; i >= 0; i -= 1) result.push({ row: BACK, index: i });
    } else {
      for (let i = 7; i >= 0; i -= 1) result.push({ row: FRONT, index: i });
      for (let i = 0; i < 8; i += 1) result.push({ row: BACK, index: i });
    }
    return result;
  }

  function nextPit(player, position, direction) {
    const path = ring(direction);
    const at = path.findIndex((item) => item.row === position.row && item.index === position.index);
    const next = path[(at + 1) % path.length];
    return pit(player, next.row, next.index);
  }

  function entryPit(player, side) {
    return pit(player, FRONT, side === "left" ? 0 : 7);
  }

  function directionForSide(side) {
    return side === "left" ? "right" : "left";
  }

  function forcedCaptureSide(index, fallbackDirection) {
    if (index <= 1) return "left";
    if (index >= 6) return "right";
    return fallbackDirection === "right" ? "left" : "right";
  }

  function opposite(state, player, index) {
    // Pit numbers run left-to-right from each player's own viewpoint. North is
    // therefore mirrored on screen, so a physical facing pair sums to index 7.
    return state.pits[1 - player][FRONT][7 - index];
  }

  function frontOccupied(state, player) {
    return state.pits[player][FRONT].some((value) => value > 0);
  }

  function hasCaptureAt(state, player, index) {
    return state.pits[player][FRONT][index] > 0 && opposite(state, player, index) > 0;
  }

  function initialCaptureTarget(state, player, row, index, direction) {
    const seeds = state.pits[player][row][index];
    if (seeds < 2 || seeds > 15) return null;
    let cursor = pit(player, row, index);
    for (let i = 0; i < seeds; i += 1) cursor = nextPit(player, cursor, direction);
    return cursor.row === FRONT
      && state.pits[player][FRONT][cursor.index] > 0
      && opposite(state, player, cursor.index) > 0 ? 7 - cursor.index : null;
  }

  function wouldCapture(state, player, row, index, direction) {
    return initialCaptureTarget(state, player, row, index, direction) !== null;
  }

  // Takasia examines only the initial sowing of each possible MTAJI start.
  // It does not recursively apply moves and therefore cannot mutate the state.
  function captureTargets(state, player) {
    const targets = new Set();
    for (let row = 0; row < 2; row += 1) {
      for (let index = 0; index < 8; index += 1) {
        for (const direction of ["left", "right"]) {
          const target = initialCaptureTarget(state, player, row, index, direction);
          if (target !== null) targets.add(target);
        }
      }
    }
    return targets;
  }

  function detectTakasia(state, attacker, previousMove) {
    if (state.winner !== null || state.phase !== "mtaji"
      || previousMove?.phase !== "mtaji" || previousMove.type !== "takata") return null;
    const defender = 1 - attacker;
    if (captureTargets(state, defender).size) return null;
    const targets = captureTargets(state, attacker);
    if (targets.size !== 1) return null;
    const index = targets.values().next().value;
    const front = state.pits[defender][FRONT];
    if (front[index] <= 1 || front.filter((value) => value > 0).length === 1
      || front.filter((value) => value >= 2).length === 1
      || (index === HOUSE && state.houseOwned[defender])) return null;
    return { player: defender, index };
  }

  function activeTakasia(state, player) {
    const target = state.takasia;
    return state.phase === "mtaji" && target?.player === player
      && Number.isInteger(target.index) && target.index >= 0 && target.index < 8 ? target : null;
  }

  function clearTakasia(state, events) {
    const target = state.takasia;
    state.takasia = null;
    if (target) snapshotEvent(events, state, "takasia", { action: "expire", target });
  }

  function legalMoves(state) {
    if (state.winner !== null) return [];
    const player = state.player;
    if (state.phase === "namua") return legalNamuaMoves(state, player);
    return legalMtajiMoves(state, player);
  }

  // A nyumba reached during a capturing namua move may either stop the move or
  // be emptied and continue. Both choices share the same physical opening move.
  function moveVariants(state, moves = legalMoves(state), recording) {
    return moves.flatMap((move) => {
      if (move.phase !== "namua" || move.type !== "capture") return [move];
      const stop = { ...move, houseChoice: "stop" };
      const use = { ...move, houseChoice: "use" };
      try {
        const a = applyMove(state, stop, recording).state;
        const b = applyMove(state, use, recording).state;
        return JSON.stringify(a) === JSON.stringify(b) ? [move] : [stop, use];
      } catch {
        return [move];
      }
    });
  }

  function legalNamuaMoves(state, player) {
    if (state.reserve[player] + state.nyakuaReserve[player] <= 0) return [{ type: "pass" }];
    const captures = [];
    for (let index = 0; index < 8; index += 1) {
      if (!hasCaptureAt(state, player, index)) continue;
      const sides = index <= 1 ? ["left"] : index >= 6 ? ["right"] : ["left", "right"];
      for (const side of sides) captures.push({
        type: "capture", phase: "namua", row: FRONT, index,
        direction: directionForSide(side), side,
      });
    }
    if (captures.length) return captures;

    const front = state.pits[player][FRONT];
    const occupied = front.map((value, index) => ({ value, index })).filter((item) => item.value > 0);
    const nonHouse = occupied.filter((item) => !(item.index === HOUSE
      && state.houseOwned[player] && item.value >= 6));
    const onlyHouse = occupied.length === 1 && occupied[0].index === HOUSE && state.houseOwned[player];
    if (onlyHouse) return ["left", "right"].map((direction) => ({
      type: "takata", phase: "namua", row: FRONT, index: HOUSE, direction,
      houseTwo: true,
    }));
    const hasMulti = nonHouse.some((item) => item.value >= 2);
    let choices = nonHouse.filter((item) => item.value >= 2 || !hasMulti || state.houseOwned[player]);
    if (!choices.length) choices = occupied.filter((item) => item.index !== HOUSE || item.value < 6);
    return choices.flatMap((item) => ["left", "right"].map((direction) => ({
      type: "takata", phase: "namua", row: FRONT, index: item.index, direction,
    }))).filter((move) => !emptiesOwnFront(state, move));
  }

  function legalMtajiMoves(state, player) {
    const candidates = [];
    for (let row = 0; row < 2; row += 1) {
      for (let index = 0; index < 8; index += 1) {
        if (state.pits[player][row][index] < 2) continue;
        for (const direction of ["left", "right"]) candidates.push({ row, index, direction });
      }
    }
    const captures = candidates.filter((move) => wouldCapture(
      state, player, move.row, move.index, move.direction,
    ));
    if (captures.length) return captures.map((move) => ({ ...move, type: "capture", phase: "mtaji" }));
    const target = activeTakasia(state, player);
    const takata = candidates.filter((move) => !(target && move.row === FRONT && move.index === target.index));
    const hasFront = takata.some((move) => move.row === FRONT);
    return takata.filter((move) => !hasFront || move.row === FRONT)
      .map((move) => ({ ...move, type: "takata", phase: "mtaji" }))
      .filter((move) => !emptiesOwnFront(state, move));
  }

  function emptiesOwnFront(state, move) {
    const occupied = state.pits[state.player][FRONT].filter((value) => value > 0).length;
    if (move.row !== FRONT || occupied !== 1) return false;
    return (move.index === 0 && move.direction === "left")
      || (move.index === 7 && move.direction === "right");
  }

  function snapshotEvent(events, state, kind, data = {}) {
    events.push(compactEventLists.has(events)
      ? { kind, ...data }
      : { kind, ...data, state: clone(state) });
  }

  function sow(state, player, start, seeds, direction, includeStart, events) {
    let cursor = start;
    let wasEmpty = false;
    for (let i = 0; i < seeds; i += 1) {
      if (!includeStart || i > 0) cursor = nextPit(player, cursor, direction);
      wasEmpty = countAt(state, cursor) === 0;
      setAt(state, cursor, countAt(state, cursor) + 1);
      snapshotEvent(events, state, "sow", { position: cursor });
    }
    return { cursor, wasEmpty };
  }

  function applyMove(source, move, recording) {
    const state = clone(source);
    state.takasia ??= null;
    const events = [];
    if (recording?.snapshots === false) compactEventLists.add(events);
    if (!legalMoves(source).some((candidate) => sameMove(candidate, move))) throw new Error("Illegal move");
    const player = state.player;
    const previousMove = { type: move.type, phase: source.phase };
    if (move.type === "pass") {
      finishTurn(state, events, undefined, previousMove);
      return { state, events };
    }
    let cursor = pit(player, move.row, move.index);
    let direction = move.direction;
    const captureTurn = move.type === "capture";
    const target = captureTurn ? null : activeTakasia(state, player);
    let wasEmpty = false;

    if (state.phase === "namua") {
      const nyakuaCount = 0;
      const ordinaryCount = Math.min(state.reserve[player], 1);
      const placement = ordinaryCount + nyakuaCount;
      state.reserve[player] -= ordinaryCount;
      state.nyakuaReserve[player] = 0;
      setAt(state, cursor, countAt(state, cursor) + placement);
      snapshotEvent(events, state, "reserve", { position: cursor, count: placement, ordinaryCount, nyakuaCount });
      if (captureTurn) {
        const taken = takeOpposite(state, player, cursor.index, events);
        if (finishOnEmptyFront(state, player, taken, events)) return { state, events };
        const result = sow(state, player, entryPit(player, move.side), taken,
          directionForSide(move.side), true, events);
        cursor = result.cursor;
        wasEmpty = result.wasEmpty;
        direction = directionForSide(move.side);
      } else {
        const seeds = move.houseTwo ? 2 : countAt(state, cursor);
        setAt(state, cursor, countAt(state, cursor) - seeds);
        snapshotEvent(events, state, "lift", { position: cursor, count: seeds });
        const result = sow(state, player, cursor, seeds, direction, false, events);
        cursor = result.cursor;
        wasEmpty = result.wasEmpty;
      }
    } else {
      const seeds = countAt(state, cursor);
      setAt(state, cursor, 0);
      loseHouseIfEmptied(state, cursor);
      snapshotEvent(events, state, "lift", { position: cursor, count: seeds });
      const result = sow(state, player, cursor, seeds, direction, false, events);
      cursor = result.cursor;
      wasEmpty = result.wasEmpty;
    }

    let relays = 0;
    let takasiaStop = false;
    while (relays < MAX_RELAY && !wasEmpty) {
      if (target && cursor.row === FRONT && cursor.index === target.index) {
        takasiaStop = true;
        snapshotEvent(events, state, "takasia", { action: "stop", target });
        break;
      }
      relays += 1;
      if (!frontOccupied(state, 1 - player)) {
        state.winner = player;
        state.reason = "front-empty";
        clearTakasia(state, events);
        snapshotEvent(events, state, "win");
        return { state, events };
      }

      const canCapture = captureTurn && cursor.row === FRONT && opposite(state, player, cursor.index) > 0;
      if (canCapture) {
        const taken = takeOpposite(state, player, cursor.index, events);
        if (state.phase === "mtaji") state.houseOwned[player] = false;
        if (finishOnEmptyFront(state, player, taken, events)) return { state, events };
        const side = forcedCaptureSide(cursor.index, direction);
        direction = directionForSide(side);
        const result = sow(state, player, entryPit(player, side), taken, direction, true, events);
        cursor = result.cursor;
        wasEmpty = result.wasEmpty;
        continue;
      }

      const isHouse = state.phase === "namua" && cursor.row === FRONT && cursor.index === HOUSE
        && state.houseOwned[player] && countAt(state, cursor) >= 6;
      if (isHouse && !captureTurn) break;
      if (isHouse && captureTurn && move.houseChoice !== "use") break;
      if (isHouse && captureTurn) state.houseOwned[player] = false;

      const seeds = countAt(state, cursor);
      setAt(state, cursor, 0);
      loseHouseIfEmptied(state, cursor);
      snapshotEvent(events, state, "relay", { position: cursor, count: seeds });
      const result = sow(state, player, cursor, seeds, direction, false, events);
      cursor = result.cursor;
      wasEmpty = result.wasEmpty;
    }

    // If the final allowed sow lands on the takasia target, the rule-defined
    // stop takes precedence over the implementation relay safety limit.
    if (!wasEmpty && target && cursor.row === FRONT && cursor.index === target.index && !takasiaStop) {
      takasiaStop = true;
      snapshotEvent(events, state, "takasia", { action: "stop", target });
    }
    if (relays >= MAX_RELAY && !wasEmpty && !takasiaStop) {
      state.winner = 1 - player;
      state.reason = "relay-limit";
      clearTakasia(state, events);
      snapshotEvent(events, state, "limit");
      return { state, events };
    }
    finishTurn(state, events, cursor, previousMove);
    return { state, events };
  }

  function takeOpposite(state, player, index, events) {
    const opponentIndex = 7 - index;
    const taken = state.pits[1 - player][FRONT][opponentIndex];
    state.pits[1 - player][FRONT][opponentIndex] = 0;
    state.houseOwned[1 - player] = state.houseOwned[1 - player] && opponentIndex !== HOUSE;
    snapshotEvent(events, state, "capture", { player: 1 - player, index: opponentIndex, count: taken });
    return taken;
  }

  function loseHouseIfEmptied(state, position) {
    if (position.row === FRONT && position.index === HOUSE && countAt(state, position) === 0) {
      state.houseOwned[position.player] = false;
    }
  }

  function finishOnEmptyFront(state, player, captured, events) {
    if (frontOccupied(state, 1 - player)) return false;
    state.pending ||= [0, 0];
    state.pending[player] += captured;
    state.winner = player;
    state.reason = "front-empty";
    clearTakasia(state, events);
    snapshotEvent(events, state, "win");
    return true;
  }

  function finishTurn(state, events, endpoint, previousMove) {
    const attacker = state.player;
    clearTakasia(state, events);
    if (!frontOccupied(state, 1 - state.player)) {
      state.winner = state.player;
      state.reason = "front-empty";
      snapshotEvent(events, state, "win");
      return;
    }
    if (!frontOccupied(state, state.player)) {
      state.winner = 1 - state.player;
      state.reason = "front-empty";
      snapshotEvent(events, state, "win");
      return;
    }

    // NYAKUA remains a NAMUA-only post-move addition. Takasia is MTAJI-only,
    // so the two rules cannot compete for the same endpoint operation.
    const mover = state.player;
    const opponent = 1 - mover;
    const captures = events.filter((event) => event.kind === "capture").length;
    if (state.phase === "namua" && endpoint && captures >= 2
      && state.reserve[mover] >= 1 && state.reserve[opponent] >= 2) {
      state.reserve[mover] -= 1;
      state.reserve[opponent] -= 1;
      setAt(state, endpoint, countAt(state, endpoint) + 2);
      snapshotEvent(events, state, "end-pit-add", { position: endpoint, count: 2 });
    }
    if (state.phase === "namua" && state.reserve[0] + state.nyakuaReserve[0] === 0
      && state.reserve[1] + state.nyakuaReserve[1] === 0) {
      state.phase = "mtaji";
      snapshotEvent(events, state, "phase");
    }
    state.player = 1 - state.player;
    state.turn += 1;
    state.takasia = detectTakasia(state, attacker, previousMove);
    const nextMoves = legalMoves(state);
    if (!nextMoves.length) {
      state.winner = 1 - state.player;
      state.reason = "no-move";
      clearTakasia(state, events);
      snapshotEvent(events, state, "win");
      return;
    }
    if (state.takasia) snapshotEvent(events, state, "takasia", { action: "activate", target: state.takasia });
    snapshotEvent(events, state, "turn");
  }

  function sameMove(a, b) {
    return a.type === b.type && a.row === b.row && a.index === b.index
      && a.direction === b.direction && a.side === b.side && Boolean(a.houseTwo) === Boolean(b.houseTwo);
  }

  function applyMoveForSearch(source, move) {
    return applyMove(source, move, SEARCH_RECORDING);
  }

  function moveVariantsForSearch(state, moves = legalMoves(state)) {
    return moveVariants(state, moves, SEARCH_RECORDING);
  }

  const api = Object.freeze({
    detectTakasia, applyMoveForSearch, moveVariantsForSearch,
    initialState, legalMoves, moveVariants, applyMove, ring, nextPit, clone,
    FRONT, BACK, HOUSE,
    INITIAL_HAND: 22, TOTAL_KETE: 64, BOARD_ROWS_PER_PLAYER: 2, SOWING_PATH: "ring",
    RULES_VERSION: "0.10.0", BASE_RULES_VERSION: "0.2.0",
    BASE_RULES_REVISION: "BAO-RULES-V0.2.0-TAKASIA-001",
    TAKASIA: true,
    NYAKUA_END_PIT_ADD: true, NYAKUA_PROTECT_LAST: true, NYAKUA_FIXED_PIT_BULK: false,
    NYAKUA_NEXT_TURN_THREE: false, NYAKUA_RESERVED_PROTECTED: false,
    RULE_ID: "takasia-namua-end-pit-two-protect-last-two-row-ring-hand22",
  });
  root.BaoEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
}(typeof window !== "undefined" ? window : globalThis));