"use strict";
const assert=require('node:assert/strict');
const test=require('node:test');
const S=require('./fixed-pit-bulk-study.cjs');

function bulkAt(seedIndex,type){
  const g=S.game(S.seedAt(seedIndex),'random','fixed',0,true,true);
  const action=g.trace.find(t=>t.bulk && t.move.type===type);
  assert.ok(action,`Missing ${type} bulk fixture at seed index ${seedIndex}`);
  return action;
}

test('one selected hole receives the full reserve before normal capture or takata',()=>{
  for(const [index,type] of [[2,'capture'],[32,'takata']]){
    const t=bulkAt(index,type),p=t.before.player;
    assert.equal(t.before.reserve[1-p],0);
    const {state,events}=S.fixed.applyMove(t.before,t.move);
    const placement=events.find(event=>event.kind==='reserve');
    assert.ok(placement);
    assert.equal(placement.state.reserve[p],0);
    assert.equal(placement.state.pits[p][t.move.row][t.move.index],
      t.before.pits[p][t.move.row][t.move.index]+t.bulk);
    assert.deepEqual(JSON.parse(JSON.stringify(state)),JSON.parse(JSON.stringify(t.after)));
    assert.ok(events.some(event=>event.kind==='capture' || event.kind==='lift'));
  }
});

test('an exhausted opponent with one own KETE follows the original single placement',()=>{
  let fixture;
  for(let i=0;i<300 && !fixture;i++){
    const g=S.game(S.seedAt(i),'random','current',0,true,true);
    fixture=g.trace.find(t=>t.before.phase==='namua' && t.before.reserve[t.before.player]===1
      && t.before.reserve[1-t.before.player]===0 && t.move.type!=='pass');
  }
  assert.ok(fixture);
  const a=S.step(S.original,fixture.before,fixture.move);
  const b=S.step(S.fixed,fixture.before,fixture.move);
  assert.deepEqual(JSON.parse(JSON.stringify(a.state)),JSON.parse(JSON.stringify(b.state)));
  assert.equal(b.bulk,0);
});

test('direct no-move after bulk is a real lack of MTAJI options; some alternatives avoid it',()=>{
  const t=bulkAt(23,'capture');
  assert.equal(t.after.reason,'no-move');
  assert.equal(t.after.winner,t.before.player);
  assert.deepEqual(Array.from(t.after.reserve),[0,0]);
  assert.equal(t.after.phase,'mtaji');
  const open=S.fixed.clone(t.after);
  open.winner=null;open.reason='';
  assert.equal(S.fixed.legalMoves(open).length,0);
  const options=S.fixed.moveVariantsForSearch(t.before);
  assert.ok(options.some(move=>S.step(S.fixed,t.before,move).state.reason!=='no-move'));
});

test('large placement and nyumba choice remain valid in reachable positions',()=>{
  const large=S.game(S.seedAt(171),'random','fixed',0,true,true).trace.find(t=>t.bulk===15);
  assert.ok(large);
  assert.equal(large.after.reserve[large.before.player],0);
  const use=S.game(S.seedAt(47),'random','fixed',0,true,true).trace.find(t=>t.bulk && t.move.houseChoice==='use');
  assert.ok(use);
  const stop={...use.move,houseChoice:'stop'};
  const a=S.step(S.fixed,use.before,use.move).state;
  const b=S.step(S.fixed,use.before,stop).state;
  assert.notDeepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
});

test('without KETE theft the control play is identical under both engines',()=>{
  for(let i=0;i<50;i++){
    const a=S.game(S.seedAt(i),'random','current',0,false);
    const b=S.game(S.seedAt(i),'random','fixed',0,false);
    assert.deepEqual(JSON.parse(JSON.stringify(b.board)),JSON.parse(JSON.stringify(a.board)));
  }
});
