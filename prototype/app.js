"use strict";
(function () {
  const E = window.BaoEngine;
  const S = window.NakakamadoSteal;
  const Q = window.NakakamadoEndPitSearchTransition.createForEngine(E);
  const C = window.NakakamadoEndPitComputerClient;
  const simpleAI = window.NakakamadoEndPitSimpleAI.createAI(Q);
  const computerClient = C.createClient(Q);
  let difficulty = "normal";
  let diagnostics = [];
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
  let fast = false;
  let sound = false;
  let audio = null;
  let computerTimer = null;
  let lastResult = "NYAKUAはまだ発動していません。";

  function tone(frequency = 300) {
    if (!sound) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audio ||= new Audio();
      if (audio.state === "suspended") void audio.resume().catch(() => {});
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "square";
      oscillator.frequency.value = frequency;
      gain.gain.value = .025;
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
      gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .05);
      oscillator.stop(audio.currentTime + .05);
    } catch { /* Audio is optional; a blocked device must not interrupt play. */ }
  }
  function updateSetup() {
    const computer = $("mode").value !== "local";
    $("side").disabled = !computer;
    $("side-field").hidden = !computer;
    const searching = $("mode").value === "search-computer";
    $("difficulty-field").hidden = !searching;
    $("difficulty").disabled = !searching;
    $("opponent-badge").textContent = searching ? "探索コンピューター（試験）" : computer ? "簡易コンピューター" : "2人対戦";
  }
  function focusBoard() {
    const first = Array.from($("board").children).find((pit) => !pit.disabled);
    (first || $("move-choices").children[0])?.focus({ preventScroll: true });
  }

  function name(player) { return player === 0 ? "SOUTH" : "NORTH"; }
  function humanTurn() { return mode === "local" || game.board.player === human; }
  function variants() { return S.moveVariants(game); }
  function key(move) { return `${move.row}:${move.index}`; }
  function selectable() { return started && !busy && game.board.winner === null && humanTurn(); }
  function pitName(position) {
    return `${position.player === 0 ? "S" : "N"}${position.row === E.FRONT ? "F" : "B"}${position.index + 1}`;
  }
  function takasiaName(target) {
    return target ? pitName({player: target.player, row: E.FRONT, index: target.index}) : "";
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
    const direction = move.direction === "left" ? "左へ蒔く" : "右へ蒔く";
    const house = move.houseChoice ? `・nyumbaを${move.houseChoice === "use" ? "使う" : "止める"}` : "";
    return `${move.type === "capture" ? "捕獲" : "種まき"}・${direction}${side}${house}`;
  }

  function renderBoard(moves) {
    const board = $("board");
    board.replaceChildren();
    board.setAttribute("aria-busy", String(busy));
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
        if (player === 1) pit.classList.add("north");
        if (row === E.FRONT && index === E.HOUSE) {
          pit.classList.add("house-position");
          if (view.houseOwned[player]) pit.classList.add("house");
        }
        const takasiaTarget = view.takasia?.player === player && row === E.FRONT && view.takasia.index === index;
        if (takasiaTarget) pit.setAttribute("data-takasia", "true");
        if (active?.player === player && active.row === row && active.index === index) {
          pit.classList.add("active-step");
          if (animation.events[animation.index - 1].kind === "capture") pit.classList.add("capture-step");
        }
        const legal = selectable() && player === game.board.player && available.has(`${row}:${index}`);
        if (legal) pit.classList.add("legal");
        if (selected?.row === row && selected?.index === index && player === game.board.player) pit.classList.add("selected");
        pit.disabled = !legal;
        pit.setAttribute("aria-label", `${name(player)} ${row === E.FRONT ? "前列" : "後列"} ${index + 1}番 ${count}個${takasiaTarget ? " TAKASIA対象" : ""}${legal ? " 選択可能" : ""}`);
        const number = document.createElement("span");
        number.className = "count";
        number.textContent = count;
        const coord = document.createElement("small");
        coord.textContent = pitName({ player, row, index });
        pit.append(number, coord);
        if (legal) pit.addEventListener("click", () => {
          selected = { row, index };
          render();
          $("move-choices").children[0]?.focus({ preventScroll: true });
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
      case "end-pit-add": return `NYAKUA！ 両者のハンドから1個ずつ取り、蒔き終わりの ${place} に計2個追加しました。`;
      case "takasia": {
        const target = takasiaName(event.target);
        if (event.action === "activate") return `TAKASIAが成立しました。${target} は次の手で開始穴にできず、最後のKETEが入ればそこで停止します。`;
        if (event.action === "stop") return `TAKASIAにより ${target} で連続種まきを停止しました。`;
        return `TAKASIAの制約が失効しました。`;
      }
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
      hand.toggle("active-hand", (event?.kind === "reserve" && event.position.player === player) || event?.kind === "end-pit-add");
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
    if (result?.stolen) lastResult = `NYAKUA！ ${name(result.player)} が${result.captures}回捕獲し、両者のハンドから1個ずつ ${pitName(result.endpoint)} へ計2個追加しました。`;
    render();
    if (selectable()) focusBoard();
    scheduleComputer();
  }

  function animationDelay() {
    const event = animation.events[animation.index - 1];
    if (fast) return 40;
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
        tone(current.events[current.index - 1].kind === "capture" ? 420 : 300);
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
    $("steal-count").textContent = `SOUTH ${shownHistory.filter((entry) => entry.player === 0 && entry.stolen).length}回 ／ NORTH ${shownHistory.filter((entry) => entry.player === 1 && entry.stolen).length}回`;
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
    else if (state.reason === "relay-limit") $("status").textContent = "連続種まきの安全上限に達したため対局を停止しました。通常の勝敗は未判定です。";
    else if (state.winner !== null) $("status").textContent = `${name(state.winner)} の勝ち（${state.reason === "front-empty" ? "前列が全空" : "合法手なし"}）。`;
    else if (busy) $("status").textContent = state.takasia
      ? `コンピューターが考えています… TAKASIA対象は ${takasiaName(state.takasia)} です。`
      : "コンピューターが考えています…";
    else if (!humanTurn()) $("status").textContent = state.takasia
      ? `${name(state.player)} の手番です。TAKASIA対象は ${takasiaName(state.takasia)} です。`
      : `${name(state.player)} の手番です。待機中…`;
    else if (moves.length === 1 && moves[0].type === "pass") $("status").textContent = `${name(state.player)} のハンドが0です。パスして相手へ手番を渡してください。`;
    else if (selected) $("status").textContent = `${pitName({ player: state.player, ...selected })} を選択しました。方向・入口を選んでください。`;
    else if (state.takasia) $("status").textContent = `${name(state.player)} の手番。TAKASIA対象 ${takasiaName(state.takasia)} からは開始できません。光る穴を選んでください。`;
    else $("status").textContent = `${name(state.player)} の手番。光る穴を選んでください。`;
    if (!selectable()) return;
    const candidates = selected ? moves.filter((m) => m.row === selected.row && m.index === selected.index) : [];
    if (moves.length === 1 && moves[0].type === "pass") {
      const button = document.createElement("button");
      button.textContent = "ハンド0・パス";
      button.addEventListener("click", () => play(moves[0]));
      choices.append(button);
    }
    for (const move of candidates) {
      const button = document.createElement("button");
      button.type = "button";
      const preview = S.apply(game, move).history.at(-1);
      const takasia = preview.takasiaAfter ? `・TAKASIA（${takasiaName(preview.takasiaAfter)}）` : "";
      button.textContent = `${moveLabel(move)}${preview.stolen ? `・NYAKUA（${pitName(preview.endpoint)}へ2個追加）` : ""}${takasia}`;
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
      if (game.board.reason === "relay-limit") {
        view = game.board;
        busy = false;
        render();
        return;
      }
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

  function chooseComputerMove() { return simpleAI.chooseMove(game.board); }

  function scheduleComputer() {
    if (!started || mode === "local" || game.board.winner !== null || game.board.player === human) return;
    busy = true;
    render();
    const scheduledFor = generation;
    computerTimer = window.setTimeout(async () => {
      computerTimer = null;
      if (scheduledFor !== generation) return;
      if (!started || mode === "local" || game.board.winner !== null || game.board.player === human) { busy = false; return; }
      const expectedKey = Q.stateKey(game.board);
      if (mode === "search-computer") {
        const answer = await computerClient.request(game.board, difficulty);
        if (!answer || scheduledFor !== generation || !started || mode !== "search-computer"
          || game.board.player === human || game.board.winner !== null || Q.stateKey(game.board) !== expectedKey) return;
        const move = variants().find(m => C.moveKey(m) === C.moveKey(answer.move));
        if (!move) { busy = false; $("status").textContent = "コンピューターの着手を確認できませんでした。新しい対局を開始してください。"; return; }
        const ply = game.history.length;
        play(move);
        if (game.history.length === ply + 1) diagnostics.push({...answer.diagnostic, ply: ply + 1});
        $("opponent-badge").textContent = answer.diagnostic.fallback
          ? "探索コンピューター（簡易方式で代替）"
          : answer.diagnostic.searchFallback ? "探索コンピューター（時間切れ代替）" : "探索コンピューター（試験）";
      } else play(chooseComputerMove());
    }, 260);
  }

  function cancelComputer() {
    if (computerTimer !== null) window.clearTimeout(computerTimer);
    computerTimer = null;
    computerClient.cancel();
  }

  function start() {
    generation += 1;
    cancelComputer();
    clearAnimationTimer();
    animation = null;
    game = S.initialGame();
    view = game.board;
    mode = $("mode").value;
    difficulty = $("difficulty").value;
    diagnostics = [];
    human = Number($("side").value);
    updateSetup();
    started = true;
    selected = null;
    busy = false;
    lastResult = "NYAKUAはまだ発動していません。";
    $("setup").hidden = true;
    tone();
    render();
    if (selectable()) focusBoard();
    scheduleComputer();
  }

  $("start").addEventListener("click", start);
  $("new-game").addEventListener("click", () => {
    generation += 1;
    cancelComputer();
    clearAnimationTimer();
    animation = null;
    view = game.board;
    started = false; busy = false; selected = null;
    $("setup").hidden = false;
    render();
    $("mode").focus({ preventScroll: true });
  });
  $("download").addEventListener("click", () => {
    if (!started || !game.history.length) return;
    const record = S.record(game, {mode: mode === "search-computer" ? "computer" : mode,
      ...(mode === "search-computer" ? {computer: {id:C.AI_ID, releaseId:C.RELEASE_ID,
        publicAdopted:C.PUBLIC_ADOPTED, learnedModel:false, evaluatorId:C.EVALUATOR_ID,
        searchId:C.SEARCH_ID, difficulty, budgetMs:C.BUDGETS[difficulty], diagnostics}} : {})});
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "bao-nakakamado-v0.10.0-game.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $("mode").addEventListener("change", updateSetup);
  $("sound").addEventListener("click", () => {
    sound = !sound;
    $("sound").textContent = `サウンド ${sound ? "ON" : "OFF"}`;
    $("sound").setAttribute("aria-pressed", String(sound));
    tone();
  });
  $("speed").addEventListener("click", () => {
    fast = !fast;
    $("speed").textContent = `高速 ${fast ? "ON" : "OFF"}`;
    $("speed").setAttribute("aria-pressed", String(fast));
  });
  updateSetup();
  render();
}());