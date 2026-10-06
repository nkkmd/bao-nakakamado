"use strict";
// MIT. Follow-up of the 160/160 mobility result; original trials stay frozen.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module'),assert=require('node:assert/strict'),crypto=require('node:crypto'),c=require('../core.cjs');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function run(){
  const out=path.join(__dirname,'../results'),mobility=JSON.parse(fs.readFileSync(path.join(out,'mobility-diagnostic.json'))),opening=mobility.traces[0].decisions[0].selected;
  const counters=[];
  // This is a counterexample search with early stopping, not a win-rate sample.
  for(const defender of ['greedy','reply','search3','search4']){
    const games=[];let counterexample=null;
    for(let i=0;i<10;i++){
      const seed=c.seedAt(1070000+i),role=Boolean(i%2),g=c.play('B-early',['search4-mobility',defender],seed,role,false);
      const {final,...compact}=g;games.push({...compact,finalHash:hash(JSON.stringify(final))});
      if(g.winner===1){const traced=c.play('B-early',g.policies,seed,role,true);assert.equal(JSON.stringify(traced.final),JSON.stringify(final));counterexample='counter-'+defender+'.json';fs.writeFileSync(path.join(out,counterexample),JSON.stringify(traced,null,2)+'\n');break;}
    }
    counters.push({defender,maxGames:10,stoppingRule:'Stop at first normal second-player win',counterexample,games});
    console.log(JSON.stringify({defender,games:games.length,counterexample}));
  }
  let source=fs.readFileSync(path.join(__dirname,'../proof.cjs'),'utf8');const originalProofHash=hash(source);
  assert.equal(source.split('      if(value!==0){').length,2);source=source.replace('      if(value!==0){','      if(value===1){');
  const context={module:{exports:{}},require:Module.createRequire(path.join(__dirname,'../proof.cjs'))};vm.runInNewContext(source,context);const proof=context.module.exports;
  const root=c.R.engine('B-early').initialState(),k=c.key(root),originalChildren=c.children;let result;
  try{
    // Restrict only the first player's opening. Every defender response remains.
    c.children=(model,b)=>{const xs=originalChildren(model,b);return model==='B-early'&&c.key(b)===k?xs.filter(x=>JSON.stringify(x.m)===JSON.stringify(opening)):xs;};
    result=proof.bounded('B-early',root,{maxDepth:16,budget:1500000,deadlineMs:120000});
  }finally{c.children=originalChildren;}
  let certificate=null;if(result.certificate){proof.verify(result.certificate);certificate='mobility-opening-certificate.json';fs.writeFileSync(path.join(out,certificate),JSON.stringify(result.certificate,null,2)+'\n');}
  const output={status:'PASS',studySource:'de32fb1c4712620e8598241d7894209c25f3a1cc',studyRunId:37401153919,opening,originalProofHash,instrumentedProofHash:hash(source),
    budgetPerDepth:1500000,deadlineMs:120000,maxDepth:16,records:result.records,certificate,counters,
    interpretation:'Only the mobility-selected opening is fixed in the extended AND/OR search. FIRST_FORCED_WIN with a verified certificate would prove a first-player win. SECOND_FORCED_WIN here concerns that fixed opening only. UNKNOWN does not exclude a longer winning route. Counterexample searches do not estimate win rates.'};
  fs.writeFileSync(path.join(out,'opening-followup.json'),JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({...output,counters:counters.map(x=>({...x,games:x.games.length}))}));return output;
}
if(require.main===module)run();
module.exports={run};
