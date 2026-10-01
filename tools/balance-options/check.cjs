"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs');
const {createCore}=require('./core.cjs'),{config,standard}=require('./configs.cjs');
const original=require('../hand-balance/balance.cjs');
const equivalent=(a,b)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
const control=config('control',[12,12]),core=createCore(control);
let transitions=0,selections=0;
for(let i=0;i<8;i++){
 const game=original.play(12,['random','random'],original.seedAt(1000+i),0,true);
 for(const step of game.path){
  equivalent(core.variants(step.before),original.variants(step.before));
  for(const m of original.variants(step.before)){equivalent(core.advance(step.before,m),original.advance(step.before,m));transitions++;}
 }
 for(const policy of ['reply','search3','search4','search6','search4-mobility']){
  const b=game.path[Math.floor(game.path.length/2)].before;
  equivalent(core.select(b,policy,core.rng(456),{searchNodes:0}),original.select(b,policy,original.rng(456),{searchNodes:0}));selections++;
 }
}
const four=createCore(config('four',[12,12],standard,4));
const b=four.initial(null);b.pits[0][0]=[0,0,0,0,4,0,2,0];b.pits[1][0]=[0,0,0,0,4,0,2,0];
assert.ok(!four.E.legalMoves(b).some(m=>m.index===4&&m.type==='takata'));
const six=core.E.clone(b);assert.ok(core.E.legalMoves(six).some(m=>m.index===4&&m.type==='takata'));
b.pits[0][0]=[0,0,0,0,4,0,0,0];
const houseMove=four.E.legalMoves(b).find(m=>m.houseTwo);assert.ok(houseMove);
const t=four.S.applyWithEvents({board:b,history:[]},houseMove);
assert.equal(t.events.find(e=>e.kind==='lift').count,2);
const asym=createCore(config('asym',[9,10]));equivalent(asym.initial(null,1).reserve,[10,9]);
const result={status:'PASS',controlTransitionsMatched:transitions,controlSelectionsMatched:selections,threshold4StartRestriction:true,houseTwoPreserved:true,asymmetricRoleMapping:true};
fs.writeFileSync(process.argv[2]||'checks.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
