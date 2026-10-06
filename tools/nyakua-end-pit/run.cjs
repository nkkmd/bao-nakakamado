"use strict";
// MIT; see ../../LICENSE. Atomic 20-pair checkpoints are source/config bound.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),c=require('./core.cjs');
const TASKS={random:{policies:['random','random'],pairs:1000},noisy:{policies:['noisy','noisy'],pairs:1000},greedy:{policies:['greedy','greedy'],pairs:500},reply:{policies:['reply','reply'],pairs:300},search3:{policies:['search3','search3'],pairs:120},search4:{policies:['search4','search4'],pairs:80},search6:{policies:['search6','search6'],pairs:40},mobility:{policies:['search4-mobility','search4-mobility'],pairs:80},'cross-0':{policies:['noisy','reply'],pairs:80},'cross-1':{policies:['reply','search4'],pairs:60}};
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function atomic(file,data){fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2)+'\n');fs.renameSync(file+'.tmp',file);}
function hashes(){return Object.fromEntries(['engine.cjs','core.cjs','run.cjs','proof.cjs','check.cjs','report.cjs','legacy-cycle.json','../../prototype/next-turn-engine.js','../../prototype/steal.js'].map(p=>[p,hash(fs.readFileSync(path.join(__dirname,p)))]));}
function run(task,out,override){
  if(task==='proof'){
    fs.mkdirSync(out,{recursive:true});const sourceHashes=hashes(),signature=hash(JSON.stringify({sourceHashes,budget:override||300000})),receipt=path.join(out,'receipt.json');
    if(fs.existsSync(receipt)){const saved=JSON.parse(fs.readFileSync(receipt));if(saved.signature!==signature)throw Error('Proof signature mismatch');if(saved.summaryHash!==hash(fs.readFileSync(path.join(out,'summary.json'))))throw Error('Proof summary mismatch');return JSON.parse(fs.readFileSync(path.join(out,'summary.json')));}
    const r=require('./proof.cjs').run(out,override||300000);atomic(receipt,{signature,sourceHashes,budget:override||300000,summaryHash:hash(fs.readFileSync(path.join(out,'summary.json'))),commit:process.env.GITHUB_SHA||null,runId:process.env.GITHUB_RUN_ID||null});return r;
  }
  const config=TASKS[task];if(!config)throw Error('Unknown task '+task);
  const n=override||config.pairs,sourceHashes=hashes(),signature=hash(JSON.stringify({study:'NYAKUA-END-PIT-A-20261006',task,n,config,sourceHashes}));
  const metadata={study:'NYAKUA-END-PIT-A-20261006',reference:'a093f527a9284184731bc44bde8ce8b62c39dc37',task,n,config,sourceHashes,node:process.version,commit:process.env.GITHUB_SHA||null,runId:process.env.GITHUB_RUN_ID||null};
  fs.mkdirSync(out,{recursive:true});const results=[];
  const index=Object.keys(TASKS).indexOf(task),seedOffset=1000000+index*10000;
  for(const model of ['A','current','none']){
    const pairs=[];
    for(let start=0;start<n;start+=20){
      const file=path.join(out,model+'-'+String(start).padStart(5,'0')+'.json');let block;
      if(fs.existsSync(file)){block=JSON.parse(fs.readFileSync(file));if(block.signature!==signature)throw Error('Checkpoint signature mismatch');}
      else {
        const rows=[];
        for(let i=start;i<Math.min(start+20,n);i++){
          const seed=c.seedAt(seedOffset+i),games=[];
          for(let role=0;role<2;role++){
            const policies=role?config.policies.slice().reverse():config.policies;
            const g=c.play(model,policies,seed,Boolean(role),i<2);
            if(g.history)atomic(path.join(out,'example-'+model+'-'+i+'-'+role+'.json'),g);
            if(g.winner===null&&!g.history){const trace=c.play(model,policies,seed,Boolean(role),true);if(JSON.stringify(trace.final)!==JSON.stringify(g.final))throw Error('Nondeterministic replay');atomic(path.join(out,'anomaly-'+model+'-'+i+'-'+role+'.json'),trace);}
            const {final,history,...compact}=g;games.push({...compact,finalHash:hash(JSON.stringify(final))});
          }
          rows.push({index:i,seed,games});
        }
        block={signature,model,start,rows};atomic(file,block);
      }
      pairs.push(...block.rows);console.log(JSON.stringify({task,model,completed:pairs.length,total:n}));
    }
    results.push({model,...c.summarize(pairs)});atomic(path.join(out,'summary.json'),{metadata,signature,completed:false,results});
  }
  const result={metadata,signature,completed:true,results};atomic(path.join(out,'summary.json'),result);console.log('RESULT '+JSON.stringify(result));return result;
}
if(require.main===module)run(process.argv[2],process.argv[3]||path.join(__dirname,'results',process.argv[2]),Number(process.argv[4])||null);
module.exports={TASKS,run,atomic,hash,hashes};
