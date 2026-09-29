"use strict";
(function () {
  const E = window.BaoEngine;
  const C = window.NakakamadoChance;
  const $ = (id) => document.getElementById(id);
  let game = C.initialGame();
  let started = false;
  let mode = "local";
  let human = 0;
  let selected = null;
  let busy = false;
  let generation = 0;
  let lastResult = "まだ抽選はありません。";

  function random() {
    if (!window.crypto?.getRandomValues) return Math.random();
    const value = new Uint32Array(1);
    window.crypto.getRandomValues(value);
    return value[0] / 4294967296;
  }

  function name(player) { return player === 0 ? "SOUTH" : "NORTH"; }
  function humanTurn() { return mode === "local" || game.board.player === human; }
  function variants() { return E.moveVariantsForSearch(game.board); }
  function key(move) { return `${move.row}:${move.index}`; }
  function selectable() { return started && !busy && game.board.winner === null && humanTurn(); }

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
    const rows = [
      [1, E.BACK, [7, 6, 5, 4, 3, 2, 1, 0]],
      [1, E.FRONT, [7, 6, 5, 4, 3, 2, 1, 0]],
      [0, E.FRONT, [0, 1, 2, 3, 4, 5, 6, 7]],
      [0, E.BACK, [0, 1, 2, 3, 4, 5, 6, 7]],
    ];
    const available = new Set(moves.filter((m) => m.type !== "pass").map(key));
    for (const [player, row, indices] of rows) {
      for (const index of indices) {
        const count = game.board.pits[player][row][index];
        const pit = document.createElement("button");
        pit.type = "button";
        pit.className = "pit";
        if (!count) pit.classList.add("empty");
        if (row === E.FRONT && index === E.HOUSE && game.board.houseOwned[player]) pit.classList.add("house");
        const legal = selectable() && player === game.board.player && available.has(`${row}:${index}`);
        if (legal) pit.classList.add("legal");
        if (selected?.row === row && selected?.index === index && player === game.board.player) pit.classList.add("selected");
        pit.disabled = !legal;
        pit.setAttribute("aria-label", `${name(player)} ${row === E.FRONT ? "前列" : "後列"} ${index + 1}番 ${count}個${legal ? " 選択可能" : ""}`);
        const number = document.createElement("span");
        number.className = "count";
        number.textContent = count;
        const coord = document.createElement("small");
        coord.textContent = `${player === 0 ? "S" : "N"}${row === E.FRONT ? "F" : "B"}${index + 1}`;
        pit.append(number, coord);
        if (legal) pit.addEventListener("click", () => {
          selected = { row, index };
          render();
        });
        board.append(pit);
      }
    }
  }

  function render() {
    const state = game.board;
    const moves = state.winner === null ? variants() : [];
    $("turn-number").textContent = `TURN ${state.turn}`;
    $("turn-name").textContent = `${state.player === 0 ? "▼" : "▲"} ${name(state.player)}`;
    $("phase-name").textContent = state.phase.toUpperCase();
    $("north-hand").textContent = state.reserve[1];
    $("south-hand").textContent = state.reserve[0];
    $("gain-count").textContent = game.bag.gain;
    $("loss-count").textContent = game.bag.loss;
    const total = game.bag.gain + game.bag.loss;
    $("chance-percent").textContent = total ? `${Math.round(game.bag.gain / total * 100)}%` : "—";
    $("uses").textContent = `SOUTH ${game.chances[0]}回 ／ NORTH ${game.chances[1]}回`;
    $("draw-result").textContent = lastResult;
    $("download").disabled = !started || !game.history.length;
    const canChooseRisk = selectable() && moves.some((m) => C.canGamble(game, m));
    $("gamble").disabled = !canChooseRisk;
    if (!canChooseRisk) $("gamble").checked = false;
    renderBoard(moves);
    const choices = $("move-choices");
    choices.replaceChildren();
    if (!started) $("status").textContent = "対局設定から開始してください。";
    else if (state.winner !== null) $("status").textContent = `${name(state.winner)} の勝ち（${state.reason}）。`;
    else if (busy) $("status").textContent = "コンピューターが考えています…";
    else if (!humanTurn()) $("status").textContent = `${name(state.player)} の手番です。待機中…`;
    else if (game.bonusTurn) $("status").textContent = `${name(state.player)} の追加手番です。穴を選んでください。`;
    else if (game.repeatAfterNext === state.player) $("status").textContent = `${name(state.player)} はこの手の後、もう一手指せます。`;
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
      button.textContent = moveLabel(move);
      button.addEventListener("click", () => play(move));
      choices.append(button);
    }
  }

  function play(move, aiRisk = false) {
    try {
      const gamble = mode === "computer" && !humanTurn() ? aiRisk : $("gamble").checked;
      const before = game.board.player;
      game = C.apply(game, move, gamble, undefined, random);
      selected = null;
      $("gamble").checked = false;
      const result = game.history.at(-1).result;
      if (result) lastResult = `${name(before)} の勝負：${result === "gain" ? "当たり！ 自分に追加の一手" : "外れ。相手に追加の一手"}。残り 当たり${game.bag.gain}／外れ${game.bag.loss}`;
      busy = false;
      render();
      scheduleComputer();
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
    let best = [];
    let bestScore = -Infinity;
    for (const move of moves) {
      let score = evaluate(E.applyMoveForSearch(game.board, move).state, player);
      score += move.type === "capture" ? 2 : 0;
      if (score > bestScore) { bestScore = score; best = [move]; }
      else if (score === bestScore) best.push(move);
    }
    const move = best[Math.floor(random() * best.length)];
    // A simple bounded policy: spend the one chance when immediate tempo is valuable.
    const risk = C.canGamble(game, move)
      && game.bag.gain / (game.bag.gain + game.bag.loss) >= 0.5
      && (move.type === "capture" || game.board.turn > 20);
    return { move, risk };
  }

  function scheduleComputer() {
    if (!started || mode !== "computer" || game.board.winner !== null || game.board.player === human) return;
    busy = true;
    render();
    const scheduledFor = generation;
    window.setTimeout(() => {
      if (scheduledFor !== generation) return;
      if (!started || mode !== "computer" || game.board.winner !== null || game.board.player === human) { busy = false; return; }
      const { move, risk } = chooseComputerMove();
      play(move, risk);
    }, 260);
  }

  function start() {
    generation += 1;
    game = C.initialGame();
    mode = $("mode").value;
    human = Number($("side").value);
    started = true;
    selected = null;
    busy = false;
    lastResult = "まだ抽選はありません。";
    $("gamble").checked = false;
    $("setup").hidden = true;
    render();
    scheduleComputer();
  }

  $("start").addEventListener("click", start);
  $("new-game").addEventListener("click", () => { generation += 1; started = false; busy = false; selected = null; $("setup").hidden = false; render(); });
  $("download").addEventListener("click", () => {
    if (!started || !game.history.length) return;
    const record = { format: "bao-nakakamado-prototype", version: 1, baseRules: "R-002", chanceRule: "once-each-3-gain-3-loss-extra-turn", mode, history: game.history, final: game.board };
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
