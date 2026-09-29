"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const Study = require("../tools/fixed-pit-bulk-study.cjs");

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
  click() { if (!this.disabled) this.handlers.get("click")?.(); }
}

test("automatic replay shows every KETE in a one-hole placement", () => {
  const ids = ["board", "turn-number", "turn-name", "phase-name", "north-hand", "south-hand",
    "steal-count", "steal-result", "download", "move-choices", "setup", "status",
    "start", "new-game", "mode", "side"];
  const elements = Object.fromEntries(ids.map((id) => [id, new Element()]));
  elements["north-hand"].parentElement = new Element();
  elements["south-hand"].parentElement = new Element();
  elements.mode.value = "local";
  elements.side.value = "0";
  const timers = new Map();
  let nextTimer = 0;
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
    require("./bulk-engine.js");
    const S = require("./steal.js");
    require("./app.js");
    elements.start.click();
    let reference = S.initialGame();
    const trace = Study.game(Study.seedAt(23), "random", "fixed", 0, true, true).trace;
    const bulkIndex = trace.findIndex((entry) => entry.bulk > 1);
    assert.ok(bulkIndex >= 0);
    for (let i = 0; i <= bulkIndex; i += 1) {
      const move = trace[i].move;
      if (i === bulkIndex) assert.match(elements.status.textContent, /6個を選んだ一穴へ全投入/);
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
        if (i === bulkIndex) assert.match(choice.textContent, /ハンドの6個を一穴へ全投入/);
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
        for (let n = 1; n <= 6; n += 1) {
          assert.ok(descriptions.some((message) => message.includes(`一穴全投入 ${n}/6`)));
        }
        assert.match(elements.status.textContent, /no-move/);
      }
      assert.equal(Number(elements["south-hand"].textContent), reference.board.reserve[0]);
      assert.equal(Number(elements["north-hand"].textContent), reference.board.reserve[1]);
    }
  } finally {
    delete global.document;
    delete global.window;
  }
});
