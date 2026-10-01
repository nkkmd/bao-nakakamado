"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const Study = require("../tools/one-row-bounce-study.cjs");

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

test("one-row replay shows reflection, NYAKUA and all seven bulk KETE at once", () => {
  const ids = ["board", "turn-number", "turn-name", "phase-name", "north-hand", "south-hand",
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
    window.BaoEngine = require("./bounce-engine.js");
    const S = require("./steal.js");
    window.NakakamadoSteal = S;
    require("./app.js");
    elements.start.click();
    let reference = S.initialGame();
    assert.equal(elements.board.children.length, 16);
    assert.equal(Number(elements["south-hand"].textContent), 12);
    const trace = Study.game(Study.seedAt(0), "random", 0, true).trace;
    const bulkIndex = trace.findIndex((entry) => entry.placed > 1);
    assert.ok(bulkIndex >= 0);
    for (let i = 0; i <= bulkIndex; i += 1) {
      const move = trace[i].move;
      if (i === bulkIndex) assert.match(elements.status.textContent, /7個を選んだ一穴へ全投入/);
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
        if (i === bulkIndex) assert.match(choice.textContent, /ハンドの7個を一穴へ全投入/);
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
        assert.equal(descriptions.filter((message) => message.includes("一度に全投入")).length, 1);
        assert.ok(descriptions.some((message) => message.includes("KETE 7個")));
      }
      assert.equal(Number(elements["south-hand"].textContent), reference.board.reserve[0]);
      assert.equal(Number(elements["north-hand"].textContent), reference.board.reserve[1]);
    }
    elements.download.click();
    assert.equal(savedRecord.version, 4);
    assert.equal(savedRecord.rulesVersion, "0.6.0");
    assert.equal(savedRecord.initialHand, 12);
    assert.equal(savedRecord.totalKete, 44);
    assert.equal(savedRecord.boardRowsPerPlayer, 1);
    assert.equal(savedRecord.sowingPath, "bounce");
    assert.equal(savedRecord.variantRule, window.BaoEngine.RULE_ID);
    assert.deepEqual(JSON.parse(JSON.stringify(S.replay(savedRecord.history).board)), savedRecord.final);

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
    assert.equal(elements.board.children.length, 16);
    assert.ok(elements.board.children.some(pit => !pit.disabled));
    // Resetting to a human SOUTH restores all initial counts and controls.
    elements["new-game"].click(); elements.side.value = "0"; elements.start.click();
    assert.equal(elements["turn-name"].textContent, "▼ SOUTH");
    assert.equal(Number(elements["south-hand"].textContent), 12);
    assert.equal(Number(elements["north-hand"].textContent), 12);
    assert.ok(elements.board.children.some(pit => !pit.disabled));
  } finally {
    global.Blob = NativeBlob;
    URL.createObjectURL = createURL;
    URL.revokeObjectURL = revokeURL;
    delete global.document;
    delete global.window;
  }
});
