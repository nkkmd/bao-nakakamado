"use strict";
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const c=require('./core.cjs');
const task=process.argv[2],out=process.argv[3]||path.join(__dirname,'results',task),override=Number(process.argv[4])||null;
fs.mkdirSync(out,{recursive:true});
const files=['engine.cjs','core.cjs','run.cjs','check.cjs','../../prototype/bulk-engine.js','../../prototype/four-row-engine.js','../../prototype/steal.js'];
const hashes=Object.fromEntries(files.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,p))).digest('hex')]));
const metadata={study:'NYAKUA-THREE-20261002',reference:'db84f8b431b80efb6fa072761a0968b293c50c04',task,override,hashes,node:process.version,runId:process.env.GITHUB_RUN_ID||null,commit:process.env.GITHUB_SHA||null};
const signature=crypto.createHash('sha256').update(JSON.stringify({...metadata,node:undefined,runId:undefined,commit:undefined})).digest('hex');
function save(name,data){const p=path.join(out,name);fs.writeFileSync(p+'.tmp',JSON.stringify(data,null,2)+'\n');fs.renameSync(p+'.tmp',p);}
function compact(g){const {final,path,...r}=g;return {...r,finalHash:crypto.createHash('sha256').update(JSON.stringify(final)).digest('hex')};}
function cached(file){const p=path.join(out,file);if(!fs.existsSync(p))return null;const r=JSON.parse(fs.readFileSync(p));if(r.signature!==signature)throw Error('Checkpoint signature mismatch');return r;}
function proof(model,maxDepth=16,budget=500000){
 const root=c.engines[model].initial(),side=root.player,records=[],deadline=Date.now()+550000;
 for(let depth=1;depth<=maxDepth;depth++){
  let nodes=0,hits=0;const start=Date.now(),table=new Map();
  function solve(b,d){if(++nodes>budget)throw Error('NODE_BUDGET');if(nodes%1000===0&&Date.now()>deadline)throw Error('TIME_BUDGET');if(b.reason==='relay-limit')return 0;if(b.winner!==null)return b.winner===side?1:-1;if(!d)return 0;
   const k=d+':'+c.key(b);if(table.has(k)){hits++;return table.get(k);}const max=b.player===side;let best=max?-1:1;const cs=c.children(model,b);cs.sort((a,b)=>(max?-1:1)*(c.score(a.b,side)-c.score(b.b,side)));
   for(const x of cs){const v=solve(x.b,d-1);best=max?Math.max(best,v):Math.min(best,v);if(max&&best===1||!max&&best===-1)break;}table.set(k,best);return best;
  }
  try{
   const openings=c.children(model,root).map(x=>({move:x.m,value:solve(x.b,depth-1)})),value=Math.max(...openings.map(x=>x.value));
   const r={depth,result:value===1?'FIRST_FORCED_WIN':value===-1?'SECOND_FORCED_WIN':'UNKNOWN',nodes,hits,elapsedMs:Date.now()-start,openings};records.push(r);save('proof-'+model+'-progress.json',{model,records});console.log(JSON.stringify({model,proof:r}));
   if(value!==0){
    const target=value===1?side:1-side,certificate={model,target,depth,nodes:[],root:null},memo=new Map();nodes=0;
    function certify(b,d){const k=d+':'+c.key(b);if(memo.has(k))return memo.get(k);const id=certificate.nodes.length;memo.set(k,id);const node={key:c.key(b),depth:d};certificate.nodes.push(node);
     if(b.winner!==null){if(b.winner!==target||b.reason==='relay-limit')throw Error('Invalid proof leaf');node.terminal=true;return id;}
     if(!d)throw Error('Unknown proof leaf');let cs=c.children(model,b);if(b.player===target){const chosen=cs.find(x=>solve(x.b,d-1)===(target===side?1:-1));if(!chosen)throw Error('Missing winning choice');cs=[chosen];}
     node.children=cs.map(x=>({move:x.m,node:certify(x.b,d-1)}));return id;
    }
    certificate.root=certify(root,depth);
    const checked=new Set();function verify(b,id){const n=certificate.nodes[id];if(c.key(b)!==n.key)throw Error('Proof key mismatch');if(checked.has(id))return;checked.add(id);if(n.terminal){if(b.winner!==target||b.reason==='relay-limit')throw Error('Bad leaf');return;}
     const cs=c.children(model,b);if(b.player!==target&&JSON.stringify(cs.map(x=>JSON.stringify(x.m)).sort())!==JSON.stringify(n.children.map(x=>JSON.stringify(x.move)).sort()))throw Error('Missing defense');if(b.player===target&&n.children.length!==1)throw Error('Missing strategy');
     for(const x of n.children){const match=cs.find(y=>JSON.stringify(y.m)===JSON.stringify(x.move));if(!match)throw Error('Illegal certificate edge');if(certificate.nodes[x.node].depth!==n.depth-1)throw Error('Invalid depth');verify(match.b,x.node);}
    }verify(root,certificate.root);save('certificate-'+model+'.json',certificate);r.certificateVerifiedNodes=checked.size;break;
   }
  }catch(e){if(!['NODE_BUDGET','TIME_BUDGET'].includes(e.message))throw e;records.push({depth,result:e.message,nodes,hits,elapsedMs:Date.now()-start});break;}
 }
 return {model,records};
}
let results=[];
if(task==='proof'){for(const model of ['current','three'])results.push(proof(model,16,override||500000));}
else{
 const cross=[['noisy','reply'],['reply','search4'],['search4','search6']];
 const policy=task.startsWith('self-')?task.slice(5):null;
 const counts={random:2000,noisy:2000,greedy:2000,reply:2000,search3:400,search4:300,search6:100,'search4-mobility':300};
 const index=task.startsWith('cross-')?Number(task.slice(6)):null;
 if(policy&&!counts[policy]||!policy&&!cross[index])throw Error('Unknown task');
 const n=override||(policy?counts[policy]:100);
 for(const model of ['current','three']){
  const records=[];
  for(let start=0;start<n;start+=20){const file=model+'-'+String(start).padStart(5,'0')+'.json';let block=cached(file);
   if(!block){const rows=[];for(let i=start;i<Math.min(start+20,n);i++){
    const seed=c.seedAt((policy?100000:200000)+i),policies=policy?[policy,policy]:cross[index];
    const games=[c.play(model,policies,seed,0,i<3)];if(!policy)games.push(c.play(model,policies.slice().reverse(),seed,0,i<3,true));
    for(const g of games)if(g.path)save('example-'+model+'-'+i+'-'+games.indexOf(g)+'.json',g);
    rows.push({seedIndex:(policy?100000:200000)+i,seed,games:games.map(compact)});
   }block={signature,model,start,rows};save(file,block);}
   records.push(...block.rows);console.log(JSON.stringify({task,model,completed:records.length,total:n}));
  }
  const games=records.flatMap(x=>x.games),summary={model,policy,pair:policy?null:cross[index],...c.summarize(games)};
  if(!policy){const values=records.filter(r=>r.games.every(g=>g.winner!==null)).map(r=>r.games.filter(g=>g.firstWon).length/2),mean=values.reduce((a,n)=>a+n,0)/values.length,se=Math.sqrt(values.reduce((a,n)=>a+(n-mean)**2,0)/(values.length-1)/values.length);summary.pairs=n;summary.pairCluster95Pct=[Math.max(0,100*(mean-1.959964*se)),Math.min(100,100*(mean+1.959964*se))];delete summary.wilson95Pct;}
  results.push(summary);save('summary.json',{metadata,signature,completed:false,results});
 }
}
const final={metadata,signature,completed:true,results};save('summary.json',final);console.log('RESULT_JSON '+JSON.stringify(final));
