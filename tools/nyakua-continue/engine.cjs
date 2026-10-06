"use strict";
// MIT; research adaptation only. Historical sowing primitives are shared.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sourcePath=path.join(__dirname,'../../prototype/next-turn-engine.js');
const source=fs.readFileSync(sourcePath,'utf8');
function replace(s,a,b){if(s.split(a).length!==2)throw Error('Source guard: '+a);return s.replace(a,b);}
function load(s){const x={module:{exports:{}}};vm.runInNewContext(s,x);return x.module.exports;}
let plain=replace(source,'const ordinaryCount = Math.min(state.reserve[player], nyakuaCount ? 2 : 1);','const ordinaryCount = Math.min(state.reserve[player], 1);');
plain=replace(plain,'const nyakuaCount = state.nyakuaReserve[player];','const nyakuaCount = 0;');
const helper=`
  function addEndpoint(state, player, cursor, events) {
    if (state.phase !== "namua" || events.some(e => e.kind === "end-pit-add")
      || events.filter(e => e.kind === "capture").length < 2
      || state.reserve[player] < 1 || state.reserve[1-player] < 2) return false;
    state.reserve[player]--; state.reserve[1-player]--;
    setAt(state, cursor, countAt(state, cursor) + 2);
    snapshotEvent(events, state, "end-pit-add", {position: cursor, count: 2});
    return true;
  }
`;
function adapted(model){
  let s=replace(plain,'  function applyMove(source, move, recording) {',helper+'\n  function applyMove(source, move, recording) {');
  if(model==='B-early')s=replace(s,'    return { cursor, wasEmpty };','    if (addEndpoint(state, player, cursor, events)) wasEmpty = false;\n    return { cursor, wasEmpty };');
  else if(model==='B-end'){
    s=replace(s,'    while (relays < MAX_RELAY && !wasEmpty) {','    while (relays < MAX_RELAY) {\n      if (wasEmpty) {\n        if (!addEndpoint(state, player, cursor, events)) break;\n        wasEmpty = false;\n      }');
    s=replace(s,'      if (isHouse && !captureTurn) break;','      if (isHouse && !captureTurn) { addEndpoint(state, player, cursor, events); break; }');
    s=replace(s,'      if (isHouse && captureTurn && move.houseChoice !== "use") break;','      if (isHouse && captureTurn && move.houseChoice !== "use") { addEndpoint(state, player, cursor, events); break; }');
    s=replace(s,'    if (relays >= MAX_RELAY && !wasEmpty) {','    if (relays >= MAX_RELAY && wasEmpty && addEndpoint(state, player, cursor, events)) wasEmpty = false;\n    if (relays >= MAX_RELAY && !wasEmpty) {');
  }else throw Error('Unknown B model');
  return s;
}
const sources=Object.fromEntries(['B-early','B-end'].map(m=>[m,adapted(m)]));
const engines=Object.fromEntries(Object.entries(sources).map(([m,s])=>[m,load(s)]));
const internals='sow, pit, countAt, setAt, entryPit, directionForSide, forcedCaptureSide, frontOccupied, opposite, takeOpposite, finishOnEmptyFront, loseHouseIfEmptied, finishTurn, sameMove, snapshotEvent, compact: events => compactEventLists.add(events), ';
const P=load(replace(plain,'const api = Object.freeze({','const api = Object.freeze({ '+internals));
// Reference: a separately written move state machine. It shares only historical
// legal-move/sowing/capture/turn-finalization primitives, not the bonus hooks.
function oracle(model,board,move){
  if(!P.legalMoves(board).some(m=>P.sameMove(m,move)))throw Error('Illegal move');
  const s=P.clone(board),p=s.player,events=[];P.compact(events);
  let captures=0,added=false,cursor=P.pit(p,move.row,move.index),direction=move.direction,empty=false;
  const capturing=move.type==='capture';
  function bonus(){
    if(s.phase!=='namua'||added||captures<2||s.reserve[p]<=0||s.reserve[1-p]<=1)return false;
    s.reserve[p]-=1;s.reserve[1-p]-=1;s.pits[p][cursor.row][cursor.index]+=2;added=true;empty=false;return true;
  }
  function sow(start,n,d,include){const r=P.sow(s,p,start,n,d,include,events);cursor=r.cursor;empty=r.wasEmpty;if(model==='B-early')bonus();}
  function capture(index){captures++;const n=P.takeOpposite(s,p,index,events);return {n,finished:P.finishOnEmptyFront(s,p,n,events)};}
  if(move.type==='pass'){P.finishTurn(s,events);return s;}
  if(s.phase==='namua'){
    const n=Math.min(s.reserve[p],1);s.reserve[p]-=n;s.nyakuaReserve[p]=0;P.setAt(s,cursor,P.countAt(s,cursor)+n);
    if(capturing){const r=capture(cursor.index);if(r.finished)return s;direction=P.directionForSide(move.side);sow(P.entryPit(p,move.side),r.n,direction,true);}
    else {const n=move.houseTwo?2:P.countAt(s,cursor);P.setAt(s,cursor,P.countAt(s,cursor)-n);sow(cursor,n,direction,false);}
  }else {const n=P.countAt(s,cursor);P.setAt(s,cursor,0);P.loseHouseIfEmptied(s,cursor);sow(cursor,n,direction,false);}
  let relays=0;
  for(;;){
    if(relays>=512)break;
    if(empty){if(model!=='B-end'||!bonus())break;}
    relays++;
    if(!P.frontOccupied(s,1-p)){s.winner=p;s.reason='front-empty';return s;}
    if(capturing&&cursor.row===0&&P.opposite(s,p,cursor.index)>0){
      const r=capture(cursor.index);if(s.phase==='mtaji')s.houseOwned[p]=false;if(r.finished)return s;
      direction=P.directionForSide(P.forcedCaptureSide(cursor.index,direction));sow(P.entryPit(p,direction==='right'?'left':'right'),r.n,direction,true);continue;
    }
    const house=s.phase==='namua'&&cursor.row===0&&cursor.index===P.HOUSE&&s.houseOwned[p]&&P.countAt(s,cursor)>=6;
    if(house&&(!capturing||move.houseChoice!=='use')){if(model==='B-end')bonus();break;}
    if(house&&capturing)s.houseOwned[p]=false;
    const n=P.countAt(s,cursor);P.setAt(s,cursor,0);P.loseHouseIfEmptied(s,cursor);sow(cursor,n,direction,false);
  }
  if(model==='B-end'&&relays>=512&&empty)bonus();
  if(relays>=512&&!empty){s.winner=1-p;s.reason='relay-limit';return s;}
  P.finishTurn(s,events);return s;
}
function loopSource(s,extended){
  if(extended){s=replace(s,'const MAX_RELAY = 512;','const MAX_RELAY = 65536;');s=replace(s,'    let relays = 0;','    let relays = 0;\n    const studySeen = new Map();');}
  return replace(s,'      relays += 1;',`      relays += 1;
      const studyKey = JSON.stringify([state.pits,state.reserve,state.nyakuaReserve,state.pending,state.houseOwned,state.player,state.phase,cursor,direction,captureTurn,Math.min(2,events.filter(e=>e.kind==="capture").length),events.some(e=>e.kind==="end-pit-add")]);
      snapshotEvent(events, state, "study-loop", {loopKey:studyKey,relays});
      ${extended?'if(studySeen.has(studyKey)){state.winner=null;state.reason="proven-cycle";snapshotEvent(events,state,"cycle",{first:studySeen.get(studyKey),again:relays,period:relays-studySeen.get(studyKey)});return {state,events};} studySeen.set(studyKey,relays);':''}`);
}
function advance(model,b,m,snapshots=false,diagnose=false){
  const E=diagnose?load(loopSource(sources[model],false)):engines[model];
  const {state,events}=E.applyMove(b,m,{snapshots});const add=events.find(e=>e.kind==='end-pit-add');
  return {b:state,events,entry:{player:b.player,move:m,placed:events.find(e=>e.kind==='reserve')?.count||0,captures:events.filter(e=>e.kind==='capture').length,stolen:Number(Boolean(add)),endpoint:add?.position||null}};
}
function extended(model,b,m){return load(loopSource(sources[model],true)).applyMove(b,m,{snapshots:false});}
module.exports={engine:model=>engines[model],advance,oracle,extended,sourcePath};
