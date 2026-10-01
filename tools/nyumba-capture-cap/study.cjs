"use strict";
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {E,S}=require('./capped-engine.cjs');
const BaseE=require('../../prototype/bounce-engine.js');
const BaseS=require('../../prototype/steal.js');
const T=require('../one-row-bounce-study.cjs');
const equal=(a,b)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
const outputDir=require('node:path').resolve(__dirname,process.env.BAO_CAP_OUTPUT_DIR||'runs');
fs.mkdirSync(outputDir,{recursive:true});
const results={reference:'3c8024cc57fb6dbe70eb525b3db004079ecb4024',interpretation:'Both phases; first capture unlimited; per-capture live own NYUMBA count, min 1; partial NYUMBA retains ownership',rows:[],checks:{transitions:0,partial:0,cap0:0,cap1:0,cap6:0,namuaPartial:0,mtajiPartial:0,partialHouse:0,dynamicLimit:0,replay:0,mirror:0,bulk:0,nyakua:0},examples:{},failures:[]};
function check(b,m,label){
 const original=E.clone(b),before={board:b,history:[]};
 const r=S.applyWithEvents(before,m),n=r.game.board,compact=S.apply(before,m);
 equal(b,original);equal(r.game,compact);equal(r.events.at(-1).state,n);
 assert.equal(T.total(n),T.total(b));assert.ok([...n.reserve,...n.pending,...n.pits.flat(2)].every(x=>Number.isSafeInteger(x)&&x>=0));
 const captures=r.events.filter(e=>e.kind==='capture');
 assert.equal(r.game.history[0].captures,captures.length);
 assert.equal(r.game.history[0].stolen,b.phase==='namua'&&captures.length>=2&&b.reserve[1-b.player]>=2?1:0);
 let previous=b,ordinal=0;
 for(const event of r.events){
  if(event.kind==='capture'){
   ordinal++;
   const available=previous.pits[event.player][0][event.index],h=previous.pits[b.player][0][4];
   assert.equal(event.ordinal,ordinal);assert.equal(event.count,ordinal===1?available:Math.min(available,Math.max(1,h)));
   assert.ok(event.count>=1);assert.equal(event.state.pits[event.player][0][event.index],available-event.count);
   if(ordinal>=2){if(h===0)results.checks.cap0++;if(h===1)results.checks.cap1++;if(h===6)results.checks.cap6++;}
   if(ordinal>=2&&event.limit!==Math.max(1,b.pits[b.player][0][4]))results.checks.dynamicLimit++;
   if(event.remaining>0){results.checks.partial++;results.checks[b.phase+'Partial']++;
    if(event.index===4){assert.equal(event.state.houseOwned[event.player],previous.houseOwned[event.player]);results.checks.partialHouse++;}
    for(const tag of ['partial',...(h===0?['cap0']:[]),...(h===1?['cap1']:[]),...(h===6?['cap6']:[]),...(event.index===4?['partialHouse']:[])])if(!results.examples[tag])results.examples[tag]={label,before:b,move:m,events:r.events};
   }
   if(event.index===4&&event.remaining===0)assert.equal(event.state.houseOwned[event.player],false);
  }
  previous=event.state;
 }
 if(n.winner===null)assert.ok(S.moveVariants({board:n,history:[]}).length);
 results.checks.transitions++;
 if(n.reason==='relay-limit')results.failures.push({label,before:b,move:m,reason:n.reason,baseReason:BaseS.apply(before,m).board.reason});
 return r;
}
const n=Number(process.argv[2]||1000);
for(const policy of ['random','noisy','greedy','reply'])for(const [rule,layer] of [['base',BaseS],['capped',S]]){
 const row={policy,rule,n,firstWins:0,avgPlies:0,maxPlies:0,nyakuaGames:0,bulkGames:0,mtajiMoveGames:0,reasons:{}};
 for(let i=0;i<n;i++){
  const seed=T.seedAt(20000+i),g=T.game(seed,policy,0,true,layer);
  row.firstWins+=g.winner===0;row.avgPlies+=g.plies/n;row.maxPlies=Math.max(row.maxPlies,g.plies);
  row.nyakuaGames+=g.stolen>0;row.bulkGames+=g.bulk>0;row.mtajiMoveGames+=g.trace.some(t=>t.before.phase==='mtaji');row.reasons[g.reason]=(row.reasons[g.reason]||0)+1;
  if(rule==='capped'){
   if(i<100)for(const t of g.trace){check(t.before,t.move,policy+':'+i);if(i<10)for(const m of S.moveVariants({board:t.before,history:[]}))check(t.before,m,'all-reachable:'+policy+':'+i);}
   if(i<50){equal(S.replay(g.trace).board,g.board);results.checks.replay++;
    const mirror=T.game(seed,policy,1,false,S),swapped=E.clone(g.board);swapped.pits.reverse();swapped.reserve.reverse();swapped.houseOwned.reverse();swapped.pending.reverse();swapped.player=1-swapped.player;swapped.winner=1-swapped.winner;
    equal(mirror.board,swapped);assert.equal(mirror.plies,g.plies);results.checks.mirror++;
   }
  }
 }
 row.firstWinPct=100*row.firstWins/n;results.rows.push(row);console.log(JSON.stringify(row));
 fs.writeFileSync(require('node:path').join(outputDir,'results.json'),JSON.stringify(results,null,2));
}
const random=T.rng(0x1ac47891);
for(const phase of ['namua','mtaji'])for(let i=0;i<2000;i++){
 const b=E.initialState();b.pits.forEach(p=>p[0].fill(0));b.reserve=[0,0];b.phase=phase;b.player=i%2;
 if(phase==='namua'){b.reserve=[Math.floor(random()*13),Math.floor(random()*13)];if(b.reserve[0]+b.reserve[1]===0)b.reserve[0]=1;}
 const stones=44-b.reserve[0]-b.reserve[1];
 for(let k=0;k<stones;k++)b.pits[Math.floor(random()*2)][0][Math.floor(random()*8)]++;
 b.houseOwned=b.pits.map(p=>p[0][4]>0&&random()<0.5);
 if(!b.pits.every(p=>p[0].some(x=>x>0)))continue;
 for(const m of S.moveVariants({board:b,history:[]}))check(b,m,'synthetic:'+phase+':'+i);
}
results.status=results.failures.length?'FAIL':'PASS';
results.sourceSha256={};for(const file of ['tools/nyumba-capture-cap/study.cjs','tools/nyumba-capture-cap/capped-engine.cjs','prototype/bounce-engine.js','prototype/steal.js'])results.sourceSha256[file]=crypto.createHash('sha256').update(fs.readFileSync(require('node:path').join(__dirname,'../..',file))).digest('hex');
fs.writeFileSync(require('node:path').join(outputDir,'results.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify({status:results.status,checks:results.checks,failures:results.failures.length}));
