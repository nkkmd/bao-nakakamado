"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const Study = require("../tools/next-turn-live-check.cjs");

class Element {
  constructor() {
    this.children = [];
    this.handlers = new Map();
    this.attrs = new Map();
    this.classNames = new Set();
    this.classList = {
      add: (name) => this.classNames.add(name),
      toggle: (name, enabled) => enabled ? this.classNames.add(name) : this.classNames.delete(name),
    };
    this.disabled = false;
    this.textContent = "";
  }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
  setAttribute(name, value) { this.attrs.set(name, value); }
  addEventListener(name, fn) { this.handlers.set(name, fn); }
  focus() {}
  click() { if (!this.disabled) this.handlers.get("click")?.(); }
}

test("four-row replay handles rear moves, NYAKUA, next-turn three-KETE placement and record metadata", () => {
  const ids = ["board", "turn-number", "turn-name", "phase-name", "north-hand", "south-hand", "north-nyakua", "south-nyakua",
    "steal-count", "steal-result", "download", "move-choices", "setup", "status",
    "start", "new-game", "mode", "side", "side-field", "opponent-badge", "sound", "speed"];
  const elements = Object.fromEntries(ids.map((id) => [id, new Element()]));
  elements["north-hand"].parentElement = new Element();
  elements["south-hand"].parentElement = new Element();
  elements.mode.value = "local";
  elements.side.value = "0";
  const timers = new Map();
  let nextTimer = 0;
  const NativeBlob = global.Blob;
  const createURL = URL.createObjectURL;
  const revokeURL = URL.revokeObjectURL;
  let savedRecord = null;
  global.Blob = class { constructor(parts) { this.parts = parts; } };
  URL.createObjectURL = blob => { savedRecord = JSON.parse(blob.parts.join("")); return "blob:test"; };
  URL.revokeObjectURL = () => {};
  global.document = {
    getElementById: (id) => elements[id],
    createElement: () => new Element(),
  };
  global.window = {
    innerWidth: 800,
    matchMedia: () => ({ matches: false }),
    setTimeout: (fn) => { const id = ++nextTimer; timers.set(id, fn); return id; },
    clearTimeout: (id) => timers.delete(id),
  };
  try {
    window.BaoEngine = require("./next-turn-engine.js");
    const S = require("./steal.js").createForEngine(window.BaoEngine);
    window.NakakamadoSteal = S;
    require("./app.js");
    elements.start.click();
    let reference = S.initialGame();
    assert.equal(elements.board.children.length, 32);
    assert.equal(Number(elements["south-hand"].textContent), 22);
    const trace = Study.game(Study.seedAt(0), "random", 0, true).trace;
    const bulkIndex = trace.findIndex((entry) => entry.placed > 1);
    assert.ok(bulkIndex >= 0);
    const bulkHand = trace[bulkIndex].placed;
    assert.ok(trace.some(t => t.move.row === window.BaoEngine.BACK));
    assert.ok(trace.some(t => t.stolen));
    for (let i = 0; i < trace.length; i += 1) {
      const move = trace[i].move;
      if (i === bulkIndex) assert.ok(elements.status.textContent.includes(`計${bulkHand}個を一穴へ投入`));
      if (move.type === "pass") {
        assert.equal(elements["move-choices"].children.length, 1);
        elements["move-choices"].children[0].click();
      } else {
        const coordinate = `${reference.board.player === 0 ? "S" : "N"}${move.row === 0 ? "F" : "B"}${move.index + 1}`;
        const pit = elements.board.children.find((item) => item.children[1]?.textContent === coordinate);
        assert.ok(pit && !pit.disabled, `Missing selected pit ${coordinate}`);
        pit.click();
        const candidates = S.moveVariants(reference).filter((m) => m.row === move.row && m.index === move.index);
        const choiceIndex = candidates.findIndex((m) => JSON.stringify(m) === JSON.stringify(move));
        assert.ok(choiceIndex >= 0, `Missing choice for ${coordinate}`);
        const choice = elements["move-choices"].children[choiceIndex];
        if (i === bulkIndex) assert.ok(choice.textContent.includes(`計${bulkHand}個`));
        choice.click();
      }
      reference = S.apply(reference, move);
      const descriptions = [];
      let count = 0;
      while (timers.size) {
        if (++count > 5000) throw new Error("Animation did not finish");
        const [id, callback] = timers.entries().next().value;
        timers.delete(id);
        callback();
        descriptions.push(elements.status.textContent);
      }
      if (i === bulkIndex) {
        assert.equal(descriptions.filter((message) => message.includes("一度に投入")).length, 1);
        assert.ok(descriptions.some((message) => message.includes(`計${bulkHand}個`)));
      }
      assert.equal(Number(elements["south-hand"].textContent), reference.board.reserve[0]);
      assert.equal(Number(elements["north-hand"].textContent), reference.board.reserve[1]);
      assert.equal(Number(elements["south-nyakua"].textContent), reference.board.nyakuaReserve[0]);
      assert.equal(Number(elements["north-nyakua"].textContent), reference.board.nyakuaReserve[1]);
      for (const pit of elements.board.children) {
        const coord = pit.children[1].textContent;
        const player = coord[0] === "S" ? 0 : 1;
        const row = coord[1] === "F" ? 0 : 1;
        assert.equal(Number(pit.children[0].textContent), reference.board.pits[player][row][Number(coord.slice(2))-1]);
      }
    }
    elements.download.click();
    assert.equal(savedRecord.version, 7);
    assert.equal(savedRecord.rulesVersion, "0.8.0");
    assert.equal(savedRecord.nyakuaProtectLast, true);
    assert.equal(savedRecord.nyakuaFixedPitBulk, false);
    assert.equal(savedRecord.nyakuaNextTurnThree, true);
    assert.equal(savedRecord.nyakuaReservedProtected, true);
    assert.equal(savedRecord.adjudication, "normal");
    assert.equal(savedRecord.initialHand, 22);
    assert.equal(savedRecord.totalKete, 64);
    assert.equal(savedRecord.boardRowsPerPlayer, 2);
    assert.equal(savedRecord.sowingPath, "ring");
    assert.equal(savedRecord.variantRule, window.BaoEngine.RULE_ID);
    assert.deepEqual(JSON.parse(JSON.stringify(S.replay(savedRecord.history).board)), savedRecord.final);

    // A real reachable relay-limit counterexample stops without playing thousands of frames.
    const cycle = require("../tools/nyakua-three/results/anomalies/self-random-three-3435580265-game.json");
    const cycleHistory = cycle.path.map(step => step.entry);
    const beforeCycle = S.replay(cycleHistory.slice(0, -1));
    const originalInitial = S.initialGame;
    S.initialGame = () => window.BaoEngine.clone(beforeCycle);
    elements["new-game"].click(); elements.start.click();
    const cycleMove = cycleHistory.at(-1).move;
    const cycleCoord = `${beforeCycle.board.player === 0 ? "S" : "N"}F${cycleMove.index + 1}`;
    elements.board.children.find(item => item.children[1]?.textContent === cycleCoord).click();
    const cycleMoves = S.moveVariants(beforeCycle).filter(m => m.row === cycleMove.row && m.index === cycleMove.index);
    elements["move-choices"].children[cycleMoves.findIndex(m => JSON.stringify(m) === JSON.stringify(cycleMove))].click();
    assert.equal(elements.board.attrs.get("aria-busy"), "false");
    assert.match(elements.status.textContent, /対局を停止.*勝敗は未判定/);
    elements.download.click(); assert.equal(savedRecord.adjudication, "safety-stop");
    assert.equal(savedRecord.final.reason, "relay-limit");
    assert.deepEqual(JSON.parse(JSON.stringify(S.replay(savedRecord.history).board)), savedRecord.final);
    S.initialGame = originalInitial;

    // Cancelling a scheduled computer turn must leave the setup visible.
    elements["new-game"].click();
    elements.mode.value = "computer"; elements.side.value = "1";
    elements.start.click(); elements["new-game"].click();
    for (const callback of timers.values()) callback(); timers.clear();
    assert.equal(elements.setup.hidden, false);
    assert.equal(elements["turn-name"].textContent, "▼ SOUTH");
    // Computer as SOUTH finishes one move and returns control to human NORTH.
    elements.start.click();
    let count = 0;
    while (timers.size) {
      assert.ok(++count < 5000, "Computer animation did not finish");
      const [id, callback] = timers.entries().next().value; timers.delete(id); callback();
    }
    assert.equal(elements["turn-name"].textContent, "▲ NORTH");
    assert.equal(elements.setup.hidden, true);
    assert.equal(elements.board.children.length, 32);
    assert.ok(elements.board.children.some(pit => !pit.disabled));
    // Resetting to a human SOUTH restores all initial counts and controls.
    elements["new-game"].click(); elements.side.value = "0"; elements.start.click();
    assert.equal(elements["turn-name"].textContent, "▼ SOUTH");
    assert.equal(Number(elements["south-hand"].textContent), 22);
    assert.equal(Number(elements["north-hand"].textContent), 22);
    assert.ok(elements.board.children.some(pit => !pit.disabled));
  } finally {
    global.Blob = NativeBlob;
    URL.createObjectURL = createURL;
    URL.revokeObjectURL = revokeURL;
    delete global.document;
    delete global.window;
  }
});
