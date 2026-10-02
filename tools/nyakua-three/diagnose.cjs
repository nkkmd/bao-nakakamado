"use strict";
// Replay a saved anomalous game and prove repeated within-move checkpoints.
const fs=require('node:fs'),vm=require('node:vm'),c=require('./core.cjs');
const input=process.argv[2],output=process.argv[3],game=JSON.parse(fs.readFileSync(input));
let b=c.engines[game.model].initial();b.player=game.first;
for(const step of game.path.slice(0,-1))b=c.engines[game.model].advance(b,step.move).b;
const last=game.path.at(-1),seen=new Map(),cycles=[];
let source=c.T.source.replace('const placement = state.reserve[1 - player] === 0 ? state.reserve[player] : 1;','const placement = state.studyPlacement;').replace('const MAX_RELAY = 512;','const MAX_RELAY = 65536;');
if(source===c.T.source)throw Error('Placement source guard');
source=source.replace('relays += 1;','relays += 1; observeRelay(state, cursor, direction, wasEmpty, captureTurn, relays);');
function observeRelay(state,cursor,direction,wasEmpty,captureTurn,relay){const key=JSON.stringify([state.pits,state.reserve,state.houseOwned,state.phase,state.pending,cursor,direction,wasEmpty,captureTurn]);
 if(seen.has(key)){cycles.push({firstRelay:seen.get(key),repeatedRelay:relay,period:relay-seen.get(key),checkpoint:{state:JSON.parse(JSON.stringify(state)),cursor,direction,wasEmpty,captureTurn}});throw Error('PROVEN_RELAY_CYCLE');}else seen.set(key,relay);
}
const ctx={module:{exports:{}},observeRelay};vm.runInNewContext(source,ctx);
const inputBoard=JSON.parse(JSON.stringify(b));inputBoard.reserve=b.reserve.map((n,i)=>n+(b.nyakuaReserve?.[i]||0));inputBoard.studyPlacement=last.entry.placed;
let raw,cycleDetected=false;try{raw=ctx.module.exports.applyMove(inputBoard,last.move,{snapshots:false});}catch(e){if(e.message!=='PROVEN_RELAY_CYCLE')throw e;cycleDetected=true;}
const alternatives=c.children(game.model,b).map(x=>({move:x.m,reason:x.b.reason,winner:x.b.winner}));
const legacy=c.engines.current.advance(b,last.move).b,trial=c.engines.three.advance({...b,nyakuaReserve:b.nyakuaReserve||[0,0]},last.move).b;
delete legacy.nyakuaReserve;delete trial.nyakuaReserve;
const mtajiSameInBothEngines=b.phase==='mtaji'&&JSON.stringify(legacy)===JSON.stringify(trial);
const result={model:game.model,seed:game.seed,policies:game.policies,plies:game.plies,phase:b.phase,move:last.move,placed:last.entry.placed,reason:game.reason,mtajiSameInBothEngines,extendedLimit:65536,extendedRelaysObserved:seen.size,extendedReason:cycleDetected?'PROVEN_RELAY_CYCLE':raw.state.reason,extendedWinner:cycleDetected?null:raw.state.winner,extendedFinishedNormally:!cycleDetected&&raw.state.reason!=='relay-limit',cycles,alternatives,nonLimitAlternatives:alternatives.filter(x=>x.reason!=='relay-limit').length,before:b};
if(output)fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,cycles:cycles.map(({checkpoint,...x})=>x),before:undefined}));
