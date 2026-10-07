"use strict";

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
      houseOwned: [true, true],
      player: 0,
      phase: "namua",
      winner: null,
      reason: "",
      turn: 1,
      pending: [0, 0],
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

  function wouldCapture(state, player, row, index, direction) {
    const seeds = state.pits[player][row][index];
    if (seeds < 2 || seeds > 15) return false;
    let cursor = pit(player, row, index);
    for (let i = 0; i < seeds; i += 1) cursor = nextPit(player, cursor, direction);
    return cursor.row === FRONT
      && state.pits[player][FRONT][cursor.index] > 0
      && opposite(state, player, cursor.index) > 0;
  }

  function legalMoves(state) {
    if (state.winner !== null) return [];
    const player = state.player;
    if (state.phase === "namua") return legalNamuaMoves(state, player);
    return legalMtajiMoves(state, player);
  }

  // A nyumba reached during a capturing namua move may either stop the move or
  // be emptied and continue.  Both choices share the same physical opening
  // move, so expand them here for UI and AI consumers.
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
    if (state.reserve[player] <= 0) return [{ type: "pass" }];
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
        for (const direction of ["left", "right"]) {
          candidates.push({ row, index, direction });
        }
      }
    }
    const captures = candidates.filter((move) => wouldCapture(
      state, player, move.row, move.index, move.direction,
    ));
    if (captures.length) return captures.map((move) => ({ ...move, type: "capture", phase: "mtaji" }));
    const hasFront = candidates.some((move) => move.row === FRONT);
    return candidates.filter((move) => !hasFront || move.row === FRONT)
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
    const events = [];
    if (recording?.snapshots === false) compactEventLists.add(events);
    if (!legalMoves(source).some((candidate) => sameMove(candidate, move))) {
      throw new Error("Illegal move");
    }
    const player = state.player;
    if (move.type === "pass") {
      finishTurn(state, events);
      return { state, events };
    }
    let cursor = pit(player, move.row, move.index);
    let direction = move.direction;
    let captureTurn = move.type === "capture";
    let wasEmpty = false;

    if (state.phase === "namua") {
      state.reserve[player] -= 1;
      setAt(state, cursor, countAt(state, cursor) + 1);
      snapshotEvent(events, state, "reserve", { position: cursor });
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
    while (relays < MAX_RELAY && !wasEmpty) {
      relays += 1;
      if (!frontOccupied(state, 1 - player)) {
        state.winner = player;
        state.reason = "front-empty";
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

    if (relays >= MAX_RELAY && !wasEmpty) {
      state.winner = 1 - player;
      state.reason = "relay-limit";
      snapshotEvent(events, state, "limit");
      return { state, events };
    }
    finishTurn(state, events);
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
    snapshotEvent(events, state, "win");
    return true;
  }

  function finishTurn(state, events) {
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
    if (state.phase === "namua" && state.reserve[0] === 0 && state.reserve[1] === 0) {
      state.phase = "mtaji";
      snapshotEvent(events, state, "phase");
    }
    state.player = 1 - state.player;
    state.turn += 1;
    const nextMoves = legalMoves(state);
    if (!nextMoves.length) {
      state.winner = 1 - state.player;
      state.reason = "no-move";
      snapshotEvent(events, state, "win");
      return;
    }
    snapshotEvent(events, state, "turn");
  }

  function sameMove(a, b) {
    return a.type === b.type && a.row === b.row && a.index === b.index
      && a.direction === b.direction && a.side === b.side && Boolean(a.houseTwo) === Boolean(b.houseTwo);
  }

  // Search uses the same rules and event metadata, without display snapshots.
  function applyMoveForSearch(source, move) {
    return applyMove(source, move, SEARCH_RECORDING);
  }

  function moveVariantsForSearch(state, moves = legalMoves(state)) {
    return moveVariants(state, moves, SEARCH_RECORDING);
  }

  const api = { applyMoveForSearch, moveVariantsForSearch, initialState, legalMoves, moveVariants, applyMove, ring, nextPit, clone, FRONT, BACK, HOUSE };
  root.BaoEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
}(typeof window !== "undefined" ? window : globalThis));
