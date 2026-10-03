'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),c=require('./core.cjs'),{config}=require('./config.cjs');
const task=process.argv[2],out=process.argv[3]||path.join(__dirname,'results',task),cfg=config(task),override=Number(process.argv[4])||null;
if(override){if(cfg.kind==='proof')cfg.budget=override;else cfg.n=override;}
fs.mkdirSync(out,{recursive:true});
const files=['core.cjs','config.cjs','run.cjs','check.cjs','../../prototype/next-turn-engine.js','../../prototype/steal.js'];
const hashes=Object.fromEntries(files.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,p))).digest('hex')]));
const metadata={study:'V080-BALANCE-20261003',rules:c.E.RULES_VERSION,task,cfg,hashes,node:process.version,runId:process.env.GITHUB_RUN_ID||null,commit:process.env.GITHUB_SHA||null};
const signature=crypto.createHash('sha256').update(JSON.stringify({...metadata,node:undefined,runId:undefined,commit:undefined})).digest('hex');
function save(name,data){const p=path.join(out,name);fs.writeFileSync(p+'.tmp',JSON.stringify(data)+'\n');fs.renameSync(p+'.tmp',p);}
function compact(g){const {final,path,...r}=g;return {...r,finalHash:crypto.createHash('sha256').update(JSON.stringify(final)).digest('hex')};}
function cached(file){const p=path.join(out,file);if(!fs.existsSync(p))return null;const r=JSON.parse(fs.readFileSync(p));if(r.signature!==signature)throw Error('Checkpoint signature mismatch');return r;}
function proof(){const root=c.E.initialState(),side=root.player,records=[],deadline=Date.now()+900000;
 for(let depth=1;depth<=cfg.maxDepth;depth++){let nodes=0,hits=0;const start=Date.now(),table=new Map();
 function solve(b,d){if(++nodes>cfg.budget)throw Error('NODE_BUDGET');if(nodes%1000===0&&Date.now()>deadline)throw Error('TIME_BUDGET');if(b.reason==='relay-limit')return 0;if(b.winner!==null)return b.winner===side?1:-1;if(!d)return 0;
 const k=d+':'+c.key(b);if(table.has(k)){hits++;return table.get(k);}const max=b.player===side;let best=max?-1:1;const cs=c.children('live',b);if(!cs.length)throw Error('Unresolved no-move');cs.sort((a,b)=>(max?-1:1)*(c.score(a.b,side)-c.score(b.b,side)));
 for(const x of cs){const v=solve(x.b,d-1);best=max?Math.max(best,v):Math.min(best,v);if(max&&best===1||!max&&best===-1)break;}table.set(k,best);return best;}
 try{const openings=c.children('live',root).map(x=>({move:x.m,value:solve(x.b,depth-1)})),value=Math.max(...openings.map(x=>x.value));records.push({depth,result:value===1?'FIRST_FORCED_WIN':value===-1?'SECOND_FORCED_WIN':'UNKNOWN',nodes,hits,elapsedMs:Date.now()-start,openings});save('proof-progress.json',{metadata,signature,records});console.log(JSON.stringify(records.at(-1)));if(value!==0)throw Error('Forced result requires independent certificate before publication');}
 catch(e){if(!['NODE_BUDGET','TIME_BUDGET'].includes(e.message))throw e;records.push({depth,result:e.message,nodes,hits,elapsedMs:Date.now()-start});break;}}
 return {metadata,signature,completed:true,records};}
let result;
if(cfg.kind==='proof')result=proof();else{const rows=[];for(let start=0;start<cfg.n;start+=20){const file='block-'+String(start).padStart(5,'0')+'.json';let block=cached(file);
 if(!block){const rs=[];for(let i=start;i<Math.min(start+20,cfg.n);i++){const seedIndex=cfg.offset+i,seed=c.seedAt(seedIndex),opening=cfg.kind==='opening'?i%4:null;
 const games=[c.play('live',cfg.policies,seed,0,false,false,opening)];if(cfg.kind==='cross')games.push(c.play('live',cfg.policies.slice().reverse(),seed,0,false,true));
 rs.push({seedIndex,seed,opening,games:games.map(compact)});}block={signature,start,rows:rs};save(file,block);}rows.push(...block.rows);console.log(JSON.stringify({task,completed:rows.length,total:cfg.n}));}
 const games=rows.flatMap(r=>r.games),summary=c.summarize(games);if(cfg.kind==='cross'){const valid=rows.filter(r=>r.games.every(g=>g.winner!==null)),v=valid.map(r=>r.games.filter(g=>g.firstWon).length/2),mean=v.reduce((a,n)=>a+n,0)/v.length,se=Math.sqrt(v.reduce((a,n)=>a+(n-mean)**2,0)/(v.length-1)/v.length);summary.completePairs=v.length;summary.pairedFirstWinPct=mean*100;summary.pairCluster95Pct=[Math.max(0,100*(mean-1.959964*se)),Math.min(100,100*(mean+1.959964*se))];summary.pairCounts=[0,1,2].map(n=>valid.filter(r=>r.games.filter(g=>g.firstWon).length===n).length);delete summary.wilson95Pct;}
 result={metadata,signature,completed:true,summary};}
save('summary.json',result);console.log('RESULT_JSON '+JSON.stringify(result));
module.exports={compact};
