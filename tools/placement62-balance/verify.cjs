"use strict";
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const c=require('./core.cjs');
const directory=process.argv[2]||path.join(__dirname,'results');
const tasks=['self-random','self-noisy','self-greedy','self-reply','self-search3','self-search4','self-search6','self-search4-mobility','cross-0','cross-1','cross-2','cross-3','cross-4','proof'];
const equal=(a,b)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
const report={status:'PASS',tasks:[],mainGames:0,mirrorGames:0,reproducedGames:0};
function compact(g){const {final,path,...rest}=g;return {...rest,finalSha256:crypto.createHash('sha256').update(JSON.stringify(final)).digest('hex')};}
for(const task of tasks){
 const dir=path.join(directory,task),s=JSON.parse(fs.readFileSync(path.join(dir,'summary.json')));
 assert.equal(s.completed,true);assert.equal(s.countOverride,null);assert.equal(s.reference,c.reference);
 assert.equal(s.protectLast,true);assert.equal(s.totalKete,40);assert.equal(s.variantRule,c.E.RULE_ID);equal(s.config,c.config);
 for(const [file,hash]of Object.entries(s.hashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,file))).digest('hex'),hash);
 if(task==='proof'){report.tasks.push({task,records:s.proof.records.length,final:s.proof.records.at(-1).result});continue;}
 const expected=task.startsWith('self-')?(task.includes('search')?1000:5000):500;
 const files=fs.readdirSync(dir).filter(p=>/^block-\d+\.json$/.test(p)).sort();
 assert.equal(files.length,expected/100);
 const units=[];
 for(const file of files){const block=JSON.parse(fs.readFileSync(path.join(dir,file)));assert.equal(block.signature,s.signature);assert.equal(block.start,units.length);assert.equal(block.rows.length,100);units.push(...block.rows);}
 assert.equal(units.length,expected);
 const games=task.startsWith('self-')?units:units.flatMap(p=>p.games);
 for(let i=0;i<units.length;i++){
  const u=units[i],seed=c.seedAt(s.seedStartIndex+i);assert.equal(u.seed,seed);
  if(task.startsWith('cross-')){
   assert.equal(u.seedIndex,s.seedStartIndex+i);assert.equal(u.games.length,2);
   equal(u.games[0].policies,[s.a,s.b]);equal(u.games[1].policies,[s.b,s.a]);
   assert.ok(u.games.every(g=>g.seed===seed));
   assert.equal(u.firstWins,Number(u.games[0].firstWon)+Number(u.games[1].firstWon));
   assert.equal(u.aWins,Number(u.games[0].firstWon)+Number(!u.games[1].firstWon));
  }else equal(u.policies,[s.policy,s.policy]);
 }
 for(const g of games){assert.equal(g.first,0);assert.equal(g.firstWon,g.winner===0);assert.equal(g.passes,0);assert.ok(['front-empty','no-move'].includes(g.reason));assert.ok(g.plies>0&&g.plies<400);}
 const recomputed=c.summarize(games);
 for(const [key,value]of Object.entries(recomputed))if(key!=='wilson95Pct'||task.startsWith('self-'))equal(s[key],value);
 if(task.startsWith('self-')){
  assert.equal(s.mirror.mismatches,0);assert.equal(s.mirror.pairs,100);report.mirrorGames+=200;
 }else {
  const both=units.filter(u=>u.firstWins===2).length,neither=units.filter(u=>u.firstWins===0).length;
  equal(s.pairFirstWins,{both,split:expected-both-neither,neither});
  const x=units.map(u=>u.firstWins/2),mean=x.reduce((a,b)=>a+b,0)/expected;
  const variance=x.reduce((a,b)=>a+(b-mean)**2,0)/(expected-1),se=Math.sqrt(variance/expected);
  equal(s.pairCluster95Pct,[Math.max(0,100*(mean-1.959964*se)),Math.min(100,100*(mean+1.959964*se))]);
 }
 for(const i of [0,Math.floor(units.length/2),units.length-1]){
  const seed=c.seedAt(s.seedStartIndex+i);
  if(task.startsWith('self-')){equal(compact(c.play(c.config,[s.policy,s.policy],seed)),units[i]);report.reproducedGames++;}
  else {equal(compact(c.play(c.config,[s.a,s.b],seed,0,false,true)),units[i].games[0]);equal(compact(c.play(c.config,[s.b,s.a],seed,0,false,'swap')),units[i].games[1]);report.reproducedGames+=2;}
 }
 report.mainGames+=games.length;report.tasks.push({task,n:games.length,firstWinPct:s.firstWinPct});
}
assert.equal(report.mainGames,29000);assert.equal(report.mirrorGames,1600);
fs.writeFileSync(path.join(directory,'verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
