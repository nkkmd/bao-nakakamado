"use strict";
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const c=require('./core.cjs'),dir=process.argv[2]||path.join(__dirname,'results'),out=path.join(dir,'anomalies');fs.mkdirSync(out,{recursive:true});
const anomalies=[];
for(const task of fs.readdirSync(dir).filter(n=>n!=='anomalies'&&fs.statSync(path.join(dir,n)).isDirectory())){
 const root=path.join(dir,task),s=JSON.parse(fs.readFileSync(path.join(root,'summary.json')));
 for(const [p,hash] of Object.entries(s.metadata.hashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,p))).digest('hex'),hash);
 for(const f of fs.readdirSync(root).filter(n=>/^(current|three)-\d+\.json$/.test(n)))for(const row of JSON.parse(fs.readFileSync(path.join(root,f))).rows)for(const [i,g] of row.games.entries()){
  if(['front-empty','no-move'].includes(g.reason))continue;
  const replay=c.play(g.model,g.policies,g.seed,g.first,true,task.startsWith('cross-')&&i===1);assert.equal(replay.reason,g.reason);assert.equal(crypto.createHash('sha256').update(JSON.stringify(replay.final)).digest('hex'),g.finalHash);
  const id=task+'-'+g.model+'-'+g.seed,file=path.join(out,id+'-game.json');fs.writeFileSync(file,JSON.stringify(replay,null,2)+'\n');
  if(g.reason==='relay-limit'){const diagnosisFile=path.join(out,id+'-diagnosis.json');execFileSync(process.execPath,[path.join(__dirname,'diagnose.cjs'),file,diagnosisFile]);const d=JSON.parse(fs.readFileSync(diagnosisFile));anomalies.push({id,task,model:g.model,seed:g.seed,phase:d.phase,plies:g.plies,reason:g.reason,extendedReason:d.extendedReason,period:d.cycles[0]?.period||null,mtajiSameInBothEngines:d.mtajiSameInBothEngines,nonLimitAlternatives:d.nonLimitAlternatives});}
  else anomalies.push({id,task,model:g.model,seed:g.seed,reason:g.reason});
 }
}
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({anomalies},null,2)+'\n');console.log(JSON.stringify({anomalies}));
