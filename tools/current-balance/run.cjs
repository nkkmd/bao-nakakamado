"use strict";
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const c=require('./core.cjs');
const policies=['random','noisy','greedy','reply','search3','search4','search6','search4-mobility'];
const cross=[['random','greedy'],['noisy','reply'],['reply','search4'],['search4','search6'],['search6','search4-mobility']];
const task=process.argv[2],out=process.argv[3]||path.join(__dirname,'results',task);
const countOverride=process.argv[4]?Number(process.argv[4]):null;
fs.mkdirSync(out,{recursive:true});
const files=['../../prototype/bounce-engine.js','../../prototype/steal.js','../balance-options/core.cjs','../balance-options/variant-engine.cjs','core.cjs','check.cjs','run.cjs'];
const hashes=Object.fromEntries(files.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,p))).digest('hex')]));
const metadata={reference:c.reference,rulesVersion:'0.6.1',variantRule:c.E.RULE_ID,protectLast:true,
 config:c.config,task,countOverride,hashes,node:process.version,runnerCommit:process.env.GITHUB_SHA||null,
 runId:process.env.GITHUB_RUN_ID||null,attempt:process.env.GITHUB_RUN_ATTEMPT||null};
const signature=crypto.createHash('sha256').update(JSON.stringify({...metadata,node:undefined,runnerCommit:undefined,runId:undefined,attempt:undefined})).digest('hex');
function save(file,data){const p=path.join(out,file);fs.writeFileSync(p+'.tmp',JSON.stringify(data,null,2)+'\n');fs.renameSync(p+'.tmp',p);}
function cached(file){const p=path.join(out,file);if(!fs.existsSync(p))return null;const r=JSON.parse(fs.readFileSync(p));assert.equal(r.signature,signature);return r;}
save('metadata.json',{...metadata,signature});
function compact(g){const {final,path,...rest}=g;return {...rest,finalSha256:crypto.createHash('sha256').update(JSON.stringify(final)).digest('hex')};}
function verifyGame(g){assert.ok(['front-empty','no-move'].includes(g.reason));assert.equal(g.passes,0);}
function batches(n,unit){
 const all=[];
 for(let start=0;start<n;start+=100){
  const file='block-'+String(start).padStart(5,'0')+'.json';let block=cached(file);
  if(!block){const rows=[];for(let i=start;i<Math.min(n,start+100);i++)rows.push(unit(i));block={signature,start,rows};save(file,block);}
  all.push(...block.rows);console.log(JSON.stringify({task,completed:all.length,total:n}));
 }
 return all;
}
let summary;
if(task.startsWith('self-')){
 const policy=task.slice(5);assert.ok(policies.includes(policy));const n=countOverride||(policy.startsWith('search')?1000:5000);
 const games=batches(n,i=>{const g=c.play(c.config,[policy,policy],c.seedAt(10000+i));verifyGame(g);return compact(g);});
 const blocks=[];for(let i=0;i<n;i+=Math.min(1000,n))blocks.push(c.summarize(games.slice(i,i+Math.min(1000,n))));
 const mirror=c.mirrorCheck(c.config,policy,countOverride?Math.min(countOverride,10):100);
 summary={...metadata,signature,policy,seedStartIndex:10000,...c.summarize(games),blocks,mirror};
}else if(task.startsWith('cross-')){
 const index=Number(task.slice(6));assert.ok(Number.isInteger(index)&&cross[index]);const [a,b]=cross[index],n=countOverride||500;
 const pairs=batches(n,i=>{const seed=c.seedAt(30000+i),x=c.play(c.config,[a,b],seed,0,false,true),y=c.play(c.config,[b,a],seed,0,false,'swap');verifyGame(x);verifyGame(y);return {seedIndex:30000+i,seed,firstWins:Number(x.firstWon)+Number(y.firstWon),aWins:Number(x.firstWon)+Number(!y.firstWon),games:[compact(x),compact(y)]};});
 const games=pairs.flatMap(p=>p.games),both=pairs.filter(p=>p.firstWins===2).length,neither=pairs.filter(p=>p.firstWins===0).length;
 const samples=pairs.map(p=>p.firstWins/2),mean=samples.reduce((a,b)=>a+b,0)/n;
 const variance=n>1?samples.reduce((a,b)=>a+(b-mean)**2,0)/(n-1):0;
 const se=Math.sqrt(variance/n),cluster95Pct=[Math.max(0,100*(mean-1.959964*se)),Math.min(100,100*(mean+1.959964*se))];
 summary={...metadata,signature,a,b,pairs:n,seedStartIndex:30000,...c.summarize(games),pairFirstWins:{both,split:n-both-neither,neither},pairCluster95Pct:cluster95Pct};delete summary.wilson95Pct;
}else if(task==='proof'){
 summary={...metadata,signature,proof:c.boundedProof(c.config,18,countOverride||1000000)};
}else throw Error('Unknown task '+task);
summary.completed=true;save('summary.json',summary);console.log('RESULT_JSON '+JSON.stringify(summary));
