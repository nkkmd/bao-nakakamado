"use strict";
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createCore}=require('./core.cjs');
const C=require('./configs.cjs');
const profiles={screen:{basic:1000,search:200,pairs:100,mirror:10,seedStart:1000,crossSeed:20000,proofDepth:16,proofBudget:300000},formal:{basic:5000,search:1000,pairs:500,mirror:100,seedStart:10000,crossSeed:30000,proofDepth:18,proofBudget:1000000}};
const policies=['random','noisy','greedy','reply','search3','search4','search6','search4-mobility'];
const cross=[['random','greedy'],['noisy','reply'],['reply','search4'],['search4','search6'],['search6','search4-mobility']];
const configurations=()=>[...C.equal,...C.asym,...C.nyumba,...(C.extra||[])];
function run(config,out,profile='screen'){
 const settings=profiles[profile];assert.ok(settings,'Unknown profile');fs.mkdirSync(out,{recursive:true});
 const core=createCore(config),{play,seedAt,summarize,mirrorCheck,boundedProof}=core;
 const sourceFiles=['core.cjs','variant-engine.cjs','run.cjs','../../prototype/bounce-engine.js','../../prototype/steal.js'];
 const hashes=Object.fromEntries(sourceFiles.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,f))).digest('hex')]));
 const signature=crypto.createHash('sha256').update(JSON.stringify({config,settings,hashes})).digest('hex');
 const save=(file,data)=>{const p=path.join(out,file);fs.writeFileSync(p+'.tmp',JSON.stringify(data,null,2)+'\n');fs.renameSync(p+'.tmp',p);};
 const cached=file=>{const p=path.join(out,file);if(!fs.existsSync(p))return null;const v=JSON.parse(fs.readFileSync(p,'utf8'));assert.equal(v.signature,signature,'Checkpoint belongs to different configuration or code');return v;};
 const metadata={reference:core.REF,config,profile,settings,hashes,signature};save('metadata.json',metadata);
 const self=[];
 for(const policy of policies){
  const file='self-'+policy+'.json';let row=cached(file);
  if(!row){const n=policy.startsWith('search')?settings.search:settings.basic,games=[];
   for(let i=0;i<n;i++)games.push(play(config,[policy,policy],seedAt(settings.seedStart+i)));
   const blocks=[];for(let i=0;i<n;i+=Math.min(n,1000))blocks.push(summarize(games.slice(i,i+Math.min(n,1000))));
   row={signature,policy,...summarize(games),blocks};save(file,row);
  }
  self.push(row);console.log(JSON.stringify({config:config.id,policy,n:row.n,firstWinPct:row.firstWinPct}));
 }
 const pairs=[];
 for(const [a,b] of cross){
  const file='cross-'+a+'-'+b+'.json';let row=cached(file);
  if(!row){const games=[],details=[];
   for(let i=0;i<settings.pairs;i++){const seed=seedAt(settings.crossSeed+i),x=play(config,[a,b],seed,0,false,true),y=play(config,[b,a],seed,0,false,'swap');
    games.push(x,y);details.push({seed,firstWins:Number(x.firstWon)+Number(y.firstWon),aWins:Number(x.firstWon)+Number(!y.firstWon)});}
   row={signature,a,b,...summarize(games),pairDetails:details};delete row.wilson95Pct;save(file,row);
  }
  pairs.push(row);console.log(JSON.stringify({config:config.id,cross:[a,b],firstWinPct:row.firstWinPct}));
 }
 const mirrors=[];
 for(const policy of policies){const file='mirror-'+policy+'.json';let row=cached(file);if(!row){row={signature,...mirrorCheck(config,policy,settings.mirror)};save(file,row);}mirrors.push(row);}
 let proof=cached('proof.json');if(!proof){proof={signature,...boundedProof(config,settings.proofDepth,settings.proofBudget)};save('proof.json',proof);}
 const summary={...metadata,completed:true,self,cross:pairs,mirrors,proof};save('summary.json',summary);return summary;
}
if(require.main===module){const [id,out,profile='screen']=process.argv.slice(2),config=configurations().find(c=>c.id===id);assert.ok(config,'Unknown configuration '+id);run(config,out||path.join(__dirname,'results',profile,id),profile);}
module.exports={run,profiles,policies,cross,configurations};
