"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs');
const {E,S}=require('./capped-engine.cjs');
const T=require('../one-row-bounce-study.cjs');
const outputDir=require('node:path').resolve(__dirname,process.env.BAO_CAP_OUTPUT_DIR||'runs');
fs.mkdirSync(outputDir,{recursive:true});
const out={status:'PASS',cases:[]};
for(const h of [0,1,6])for(const target of [1,6,10]){
 const b=E.initialState();b.reserve=[1,1];b.houseOwned=[h>0,true];
 b.pits[0][0]=[1,1,0,0,h,0,0,0];b.pits[1][0]=[38-h-target,0,0,0,0,0,target,2];
 assert.equal(T.total(b),44);
 const m={type:'capture',phase:'namua',row:0,index:0,direction:'right',side:'left'};
 const r=S.applyWithEvents({board:b,history:[]},m),c=r.events.filter(e=>e.kind==='capture');
 assert.equal(c[0].count,2);assert.equal(c[1].count,Math.min(target,Math.max(1,h)));
 assert.equal(c[1].remaining,target-c[1].count);assert.equal(T.total(r.game.board),44);
 out.cases.push({nyumba:h,target,captured:c[1].count,remainingImmediately:c[1].remaining,finalReason:r.game.board.reason});
}
// First capture has no ceiling even when own NYUMBA is empty.
const b=E.initialState();b.reserve=[1,1];b.houseOwned=[false,false];b.pits[0][0]=[1,0,0,0,0,0,0,31];b.pits[1][0]=[0,0,0,0,0,0,0,10];
const r=S.applyWithEvents({board:b,history:[]},{type:'capture',phase:'namua',row:0,index:0,direction:'right',side:'left'});
assert.equal(r.events.find(e=>e.kind==='capture').count,10);assert.equal(r.game.board.reason,'front-empty');assert.equal(T.total(r.game.board),44);
out.firstUnlimited={nyumba:0,captured:10,reason:r.game.board.reason};
// A partially captured owned opponent NYUMBA remains owned below six.
const house=E.initialState();house.reserve=[1,1];house.houseOwned=[true,true];
house.pits[0][0]=[1,0,0,1,1,0,0,0];house.pits[1][0]=[29,0,0,0,6,0,0,4];
const hr=S.applyWithEvents({board:house,history:[]},{type:'capture',phase:'namua',row:0,index:0,direction:'right',side:'left'});
const hc=hr.events.filter(e=>e.kind==='capture')[1];assert.equal(hc.index,4);assert.equal(hc.remaining,5);assert.equal(hc.state.houseOwned[1],true);assert.equal(T.total(hr.game.board),44);
out.partialOwnedHouse={captured:hc.count,remaining:hc.remaining,owned:hc.state.houseOwned[1]};
// In MTAJI the first actual capture is counted as the first, after the initial sow.
const mt=E.initialState();mt.phase='mtaji';mt.reserve=[0,0];mt.houseOwned=[false,false];
mt.pits[0][0]=[0,0,3,0,0,0,0,31];mt.pits[1][0]=[0,0,0,0,0,0,10,0];
const mm=E.legalMoves(mt).find(m=>m.index===2&&m.direction==='left');assert.equal(mm.type,'capture');
const mr=S.applyWithEvents({board:mt,history:[]},mm),mc=mr.events.find(e=>e.kind==='capture');
assert.equal(mc.ordinal,1);assert.equal(mc.count,10);assert.equal(mr.game.board.reason,'front-empty');assert.equal(T.total(mr.game.board),44);
out.mtajiFirstUnlimited={nyumba:0,captured:10,reason:mr.game.board.reason};
fs.writeFileSync(require('node:path').join(outputDir,'boundaries.json'),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));
