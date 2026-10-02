"use strict";
// Research only. The playable v0.7.0 files are not changed.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../prototype/bulk-engine.js'),'utf8');
function replaceOnce(s,a,b){if(s.split(a).length!==2)throw Error('Source guard: '+a);return s.replace(a,b);}
function load(s){const ctx={module:{exports:{}},console};vm.runInNewContext(s,ctx);return ctx.module.exports;}
let changed=replaceOnce(source,'reserve: [22, 22],','reserve: [22, 22], nyakuaReserve: [0, 0],');
changed=replaceOnce(changed,'if (state.reserve[player] <= 0)','if (state.reserve[player] + state.nyakuaReserve[player] <= 0)');
changed=replaceOnce(changed,'const placement = state.reserve[1 - player] === 0 ? state.reserve[player] : 1;\n      state.reserve[player] -= placement;',
 'const extra = state.nyakuaReserve[player];\n      const ordinary = Math.min(state.reserve[player], extra ? 2 : 1);\n      const placement = ordinary + extra;\n      state.reserve[player] -= ordinary;\n      state.nyakuaReserve[player] = 0;');
changed=replaceOnce(changed,'state.reserve[0] === 0 && state.reserve[1] === 0','state.reserve[0] + state.nyakuaReserve[0] === 0 && state.reserve[1] + state.nyakuaReserve[1] === 0');
const E=load(changed);
// Independent accounting oracle: give the historical engine aggregate hand
// counts and override only its placement quantity, then split the counts back.
const oracle=load(replaceOnce(source,'const placement = state.reserve[1 - player] === 0 ? state.reserve[player] : 1;','const placement = state.studyPlacement;'));
function advance(b,m,reference=false){
 const p=b.player,o=1-p,extra=b.nyakuaReserve[p];
 const ordinary=b.phase==='namua'&&m.type!=='pass'?Math.min(b.reserve[p],extra?2:1):0;
 let input=b;
 if(reference){input=JSON.parse(JSON.stringify(b));input.reserve=b.reserve.map((n,i)=>n+b.nyakuaReserve[i]);input.studyPlacement=ordinary+extra;}
 const {state:c,events}= (reference?oracle:E).applyMove(input,m,{snapshots:false});
 if(reference){delete c.studyPlacement;c.reserve=b.reserve.slice();c.nyakuaReserve=b.nyakuaReserve.slice();if(b.phase==='namua'&&m.type!=='pass'){c.reserve[p]-=ordinary;c.nyakuaReserve[p]=0;}}
 const captures=events.filter(e=>e.kind==='capture').length;
 const stolen=b.phase==='namua'&&captures>=2&&c.reserve[o]>=2?1:0;
 if(stolen){c.reserve[o]--;c.nyakuaReserve[p]++;}
 const placed=events.find(e=>e.kind==='reserve')?.count||0;
 return {b:c,entry:{player:p,move:m,placed,ordinaryPlaced:ordinary,reservedPlaced:b.phase==='namua'&&m.type!=='pass'?extra:0,captures,stolen},events};
}
module.exports={E,advance,source};
