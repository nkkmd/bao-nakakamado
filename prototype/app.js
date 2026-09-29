"use strict";
(function () {
  const E = window.BaoEngine;
  const S = window.NakakamadoSteal;
  const $ = (id) => document.getElementById(id);
  let game = S.initialGame();
  let started = false;
  let mode = "local";
  let human = 0;
  let selected = null;
  let busy = false;
  let generation = 0;
  let animation = null;
  let view = game.board;
  let lastResult = "連続捕獲によるKETEの移動はまだありません。";

  function name(player) { return player === 0 ? "SOUTH" : "NORTH"; }
  function humanTurn() { return mode === "local" || game.board.player === human; }
  function variants() { return S.moveVariants(game); }
  function key(move) { return `${move.row}:${move.index}`; }
  function selectable() { return started && !busy && game.board.winner === null && humanTurn(); }
  function pitName(position) {
    return `${position.player === 0 ? "S" : "N"}${position.row === E.FRONT ? "F" : "B"}${position.index + 1}`;
  }
  function activePit() {
    if (!animation || animation.index === 0) return null;
    const event = animation.events[animation.index - 1];
    return event.kind === "capture"
      ? { player: event.player, row: E.FRONT, index: event.index }
      : event.position || null;
  }

  function moveLabel(move) {
    if (move.type === "pass") return "パス";
    const side = move.side ? `・${move.side === "left" ? "左入口" : "右入口"}` : "";
    const direction = move.direction === "left" ? "左回り" : "右回り";
    const house = move.houseChoice ? `・nyumbaを${move.houseChoice === "use" ? "使う" : "止める"}` : "";
    return `${move.type === "capture" ? "捕獲" : "種まき"}・${direction}${side}${house}`;
  }

  function renderBoard(moves) {
    const board = $("board");
    board.replaceChildren();
    board.setAttribute("aria-busy", String(Boolean(animation)));
    const active = activePit();
    const rows = [
      [1, E.BACK, [7, 6, 5, 4, 3, 2, 1, 0]],
      [1, E.FRONT, [7, 6, 5, 4, 3, 2, 1, 0]],
      [0, E.FRONT, [0, 1, 2, 3, 4, 5, 6, 7]],
      [0, E.BACK, [0, 1, 2, 3, 4, 5, 6, 7]],
    ];
    const available = new Set(moves.filter((m) => m.type !== "pass").map(key));
    for (const [player, row, indices] of rows) {
      for (const index of indices) {
        const count = view.pits[player][row][index];
        const pit = document.createElement("button");
        pit.type = "button";
        pit.className = "pit";
        if (!count) pit.classList.add("empty");
        if (row === E.FRONT && index === E.HOUSE && view.houseOwned[player]) pit.classList.add("house");
        if (active?.player === player && active.row === row && active.index === index) pit.classList.add("active-step");
        const legal = selectable() && player === game.board.player && available.has(`${row}:${index}`);
        if (legal) pit.classList.add("legal");
        if (selected?.row === row && selected?.index === index && player === game.board.player) pit.classList.add("selected");
        pit.disabled = !legal;
        pit.setAttribute("aria-label", `${name(player)} ${row === E.FRONT ? "前列" : "後列"} ${index + 1}番 ${count}個${legal ? " 選択可能" : ""}`);
        const number = document.createElement("span");
        number.className = "count";
        number.textContent = count;
        const coord = document.createElement("small");
        coord.textContent = pitName({ player, row, index });
        pit.append(number, coord);
        if (legal) pit.addEventListener("click", () => {
          selected = { row, index };
          render();
        });
        board.append(pit);
      }
    }
  }

  function eventDescription(event) {
    const place = event.position ? pitName(event.position) : "";
    switch (event.kind) {
      case "reserve": return `${name(event.position.player)} のハンドから ${place} にKETEを1個置きました。`;
      case "lift": return `${place} からKETEを${event.count}個持ち上げました。`;
      case "sow": return `${place} にKETEを1個蒔きました。`;
      case "relay": return `${place} から${event.count}個で連続種まきします。`;
      case "capture": return `${name(animation.mover)} が ${name(event.player)} の ${pitName({ player: event.player, row: E.FRONT, index: event.index })} からKETEを${event.count}個捕獲しました。`;
      case "steal": return `${name(event.to)} が ${name(event.from)} のハンドからKETEを1個奪いました。`;
      case "phase": return "MTAJIに移りました。";
      case "win": return "終局しました。";
      case "limit": return "連続種まきの安全上限に達しました。";
      case "turn": return `${name(event.state.player)} の手番になりました。`;
      default: return "局面を更新しました。";
    }
  }

  function highlightHands() {
    const event = animation?.index ? animation.events[animation.index - 1] : null;
    for (const [player, id] of [[0, "south-hand"], [1, "north-hand"]]) {
      const hand = $(id).parentElement.classList;
      hand.toggle("active-hand", event?.kind === "reserve" && event.position.player === player);
      hand.toggle("donor-hand", event?.kind === "steal" && event.from === player);
      hand.toggle("recipient-hand", event?.kind === "steal" && event.to === player);
    }
  }

  function clearAnimationTimer() {
    if (animation && animation.timer !== null) window.clearTimeout(animation.timer);
    if (animation) animation.timer = null;
  }

  function finishAnimation() {
    clearAnimationTimer();
    animation = null;
    view = game.board;
    busy = false;
    const result = game.history.at(-1);
    if (result?.stolen) lastResult = `${name(result.player)} が同じ着手で${result.captures}回捕獲し、${name(1 - result.player)} のハンドからKETEを1個奪いました。`;
    render();
    scheduleComputer();
  }

  function animationDelay() {
    const event = animation.events[animation.index - 1];
    if (!event) return 80;
    const count = animation.events.length;
    const mobileScale = (window.innerWidth || 800) < 520 ? 1.6 : 1;
    const motionScale = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 1.25 : 1;
    const scale = mobileScale * motionScale;
    if (event.kind !== "sow" && event.kind !== "reserve") return (count > 120 ? 130 : 180) * scale;
    if (count > 160) return 100 * scale;
    if (count > 90) return 125 * scale;
    return 260 * scale;
  }

  function scheduleStep() {
    if (!animation) return;
    const current = animation;
    current.timer = window.setTimeout(() => {
      if (animation !== current || current.generation !== generation) return;
      current.timer = null;
      if (current.index === current.events.length) finishAnimation();
      else {
        current.index += 1;
        view = current.events[current.index - 1].state;
        render();
        scheduleStep();
      }
    }, animationDelay());
  }

  function render() {
    const state = view;
    const moves = selectable() ? variants() : [];
    $("turn-number").textContent = `TURN ${state.turn}`;
    $("turn-name").textContent = `${state.player === 0 ? "▼" : "▲"} ${name(state.player)}`;
    $("phase-name").textContent = state.phase.toUpperCase();
    $("north-hand").textContent = state.reserve[1];
    $("south-hand").textContent = state.reserve[0];
    const shownHistory = animation ? game.history.slice(0, -1) : game.history;
    $("steal-count").textContent = `SOUTH ${shownHistory.filter((entry) => entry.player === 0 && entry.stolen).length}個 ／ NORTH ${shownHistory.filter((entry) => entry.player === 1 && entry.stolen).length}個`;
    $("steal-result").textContent = lastResult;
    $("download").disabled = !started || Boolean(animation) || !game.history.length;
    renderBoard(moves);
    highlightHands();
    const choices = $("move-choices");
    choices.replaceChildren();
    if (!started) $("status").textContent = "対局設定から開始してください。";
    else if (animation) $("status").textContent = animation.index
      ? eventDescription(animation.events[animation.index - 1])
      : `${name(animation.mover)} の着手を再生しています…`;
    else if (state.winner !== null) $("status").textContent = `${name(state.winner)} の勝ち（${state.reason}）。`;
    else if (busy) $("status").textContent = "コンピューターが考えています…";
    else if (!humanTurn()) $("status").textContent = `${name(state.player)} の手番です。待機中…`;
    else $("status").textContent = `${name(state.player)} の手番。光る穴を選んでください。`;
    if (!selectable()) return;
    const candidates = selected ? moves.filter((m) => m.row === selected.row && m.index === selected.index) : [];
    if (moves.length === 1 && moves[0].type === "pass") {
      const button = document.createElement("button");
      button.textContent = "合法手なし・パス";
      button.addEventListener("click", () => play(moves[0]));
      choices.append(button);
    }
    for (const move of candidates) {
      const button = document.createElement("button");
      button.type = "button";
      const preview = S.apply(game, move).history.at(-1);
      button.textContent = `${moveLabel(move)}${preview.stolen ? "・相手のハンドからKETEを1個奪う" : ""}`;
      button.addEventListener("click", () => play(move));
      choices.append(button);
    }
  }

  function play(move) {
    if (animation) return;
    try {
      const initial = E.clone(game.board);
      const mover = game.board.player;
      const result = S.applyWithEvents(game, move);
      game = result.game;
      selected = null;
      busy = true;
      view = initial;
      animation = {
        events: result.events, mover, index: 0, generation, timer: null,
      };
      render();
      scheduleStep();
    } catch (error) {
      busy = false;
      $("status").textContent = `着手できません：${error.message}`;
    }
  }

  function evaluate(board, player) {
    if (board.winner !== null) return board.winner === player ? 100000 : -100000;
    const front = (side) => board.pits[side][E.FRONT].reduce((a, b) => a + b, 0);
    const all = (side) => board.reserve[side] + board.pits[side].flat().reduce((a, b) => a + b, 0);
    return 2 * (front(player) - front(1 - player)) + all(player) - all(1 - player);
  }

  function chooseComputerMove() {
    const player = game.board.player;
    const moves = variants();
    let best = null;
    let bestScore = -Infinity;
    for (const move of moves) {
      let score = evaluate(S.apply(game, move).board, player);
      score += move.type === "capture" ? 2 : 0;
      if (score > bestScore) { bestScore = score; best = move; }
    }
    return best;
  }

  function scheduleComputer() {
    if (!started || mode !== "computer" || game.board.winner !== null || game.board.player === human) return;
    busy = true;
    render();
    const scheduledFor = generation;
    window.setTimeout(() => {
      if (scheduledFor !== generation) return;
      if (!started || mode !== "computer" || game.board.winner !== null || game.board.player === human) { busy = false; return; }
      play(chooseComputerMove());
    }, 260);
  }

  function start() {
    generation += 1;
    clearAnimationTimer();
    animation = null;
    game = S.initialGame();
    view = game.board;
    mode = $("mode").value;
    human = Number($("side").value);
    started = true;
    selected = null;
    busy = false;
    lastResult = "連続捕獲によるKETEの移動はまだありません。";
    $("setup").hidden = true;
    render();
    scheduleComputer();
  }

  $("start").addEventListener("click", start);
  $("new-game").addEventListener("click", () => {
    generation += 1;
    clearAnimationTimer();
    animation = null;
    view = game.board;
    started = false; busy = false; selected = null;
    $("setup").hidden = false;
    render();
  });
  $("download").addEventListener("click", () => {
    if (!started || !game.history.length) return;
    const record = { format: "bao-nakakamado-prototype", version: 2, baseRules: "R-002", variantRule: "namua-multi-capture-steal-one", mode, history: game.history, final: game.board };
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "bao-nakakamado-game.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $("mode").addEventListener("change", () => { $("side").disabled = $("mode").value === "local"; });
  $("side").disabled = true;
  render();
}());
