"use strict";
// MIT; see ../../LICENSE. Independent noncapturing 16-pit relay calculator.
// This models one MTAJI takata move, not Bao's legal-move rules or takasia.
const assert = require('node:assert/strict');
function flatten(rows) { return [...rows[0], ...rows[1].slice().reverse()]; }
function rows(a) { return [a.slice(0, 8), a.slice(8).reverse()]; }
function index(position) { return position.row === 0 ? position.index : 15 - position.index; }
function simulate(input, start, direction, {limit = 65536, trace = false} = {}) {
  const a = input.slice(), total = a.reduce((s, n) => s + n, 0);
  assert.equal(a.length, 16); assert.ok(a.every(n => Number.isSafeInteger(n) && n >= 0));
  assert.ok(a[start] >= 2); assert.ok(['left', 'right'].includes(direction));
  const step = direction === 'right' ? 1 : -1;
  let cursor = start, batches = 0, drops = 0;
  const seen = new Map(), states = [];
  function sow() {
    const count = a[cursor]; a[cursor] = 0;
    for (let n = 0; n < count; n++) { cursor = (cursor + step + 16) % 16; a[cursor]++; }
    batches++; drops += count;
    assert.equal(a.reduce((s, n) => s + n, 0), total);
  }
  sow();
  while (a[cursor] > 1) {
    const key = JSON.stringify([a, cursor, direction]);
    if (seen.has(key)) {
      const first = seen.get(key);
      return {status: 'cycle', firstBatch: first.batch, repeatBatch: batches,
        period: batches - first.batch, dropsPerPeriod: drops - first.drops,
        batches, drops, endpoint: cursor, final: a, ...(trace ? {states} : {})};
    }
    if (trace) states.push({batch: batches, ring: a.slice(), cursor, direction, drops});
    seen.set(key, {batch: batches, drops});
    if (batches >= limit) return {status: 'unknown-limit', batches, drops};
    sow();
  }
  return {status: 'finite', batches, relays: batches - 1, drops, endpoint: cursor, final: a,
    ...(trace ? {states} : {})};
}
module.exports = {flatten, rows, index, simulate};
