"use strict";
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'../..');
// Historical study only. Refuse silently running against changed game rules.
const reference=require('./reference-sources.json');
for(const [file,expected] of Object.entries(reference.sourceSha256)) {
 const actual=require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
 assert.equal(actual,expected,'Reference source changed: '+file+'; use '+reference.reference);
}
let source=fs.readFileSync(path.join(root,'prototype/bounce-engine.js'),'utf8');
function replace(a,b){assert.equal(source.split(a).length-1,1);source=source.replace(a,b);}
replace('let captureTurn = move.type === "capture";', 'let captureTurn = move.type === "capture";\n    let captureOrdinal = 0;');
assert.equal(source.split('takeOpposite(state, player, cursor.index, events)').length-1,2);
source=source.replaceAll('takeOpposite(state, player, cursor.index, events)','takeOpposite(state, player, cursor.index, events, ++captureOrdinal)');
replace('function takeOpposite(state, player, index, events) {','function takeOpposite(state, player, index, events, ordinal) {');
replace('const taken = state.pits[1 - player][FRONT][opponentIndex];\n    state.pits[1 - player][FRONT][opponentIndex] = 0;\n    state.houseOwned[1 - player] = state.houseOwned[1 - player] && opponentIndex !== HOUSE;\n    snapshotEvent(events, state, "capture", { player: 1 - player, index: opponentIndex, count: taken });',
'const available = state.pits[1 - player][FRONT][opponentIndex];\n    const limit = ordinal === 1 ? available : Math.max(1, state.pits[player][FRONT][HOUSE]);\n    const taken = Math.min(available, limit);\n    state.pits[1 - player][FRONT][opponentIndex] -= taken;\n    if (opponentIndex === HOUSE && state.pits[1 - player][FRONT][opponentIndex] === 0) state.houseOwned[1 - player] = false;\n    snapshotEvent(events, state, "capture", { player: 1 - player, index: opponentIndex, count: taken, ordinal, limit, available, remaining: available - taken });');
const ctx=vm.createContext({module:{exports:{}},WeakSet,JSON,Object,Array,Boolean});
vm.runInContext(source,ctx);const E=ctx.module.exports;ctx.module={exports:{}};
vm.runInContext(fs.readFileSync(path.join(root,'prototype/steal.js'),'utf8'),ctx);
module.exports={E,S:ctx.module.exports,source};
