'use strict';
// MIT. Atomic pair checkpoints; interrupted pairs are HOLD, never rerun silently.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('./core.cjs');
const pilotContract={id:'NAKAKAMADO-V010-BALANCE-PILOT-001',developmentOnly:true,
  baseline:'eb851e38750b74bda23aba7c462d7ff6f45447db',rulesVersion:'0.10.0',maxPlies:400,
  seedStart:2026101100,pairsPerProfile:4,profiles:[{id:'nodes-512',kind:'research',nodes:512},
    {id:'nodes-2048',kind:'research',nodes:2048},{id:'nodes-8192',kind:'research',nodes:8192},
    {id:'public-25',kind:'public',ms:25},{id:'public-75',kind:'public',ms:75},{id:'public-150',kind:'public',ms:150},
    {id:'simple',kind:'simple'}],selection:{depthZeroMaximum:.01,p95MaximumMs:2000,
    minimumUniqueResearchTrajectories:2,criterion:'operations and diversity only; never wins'}};
function atomic(file,value){fs.writeFileSync(file+'.tmp',JSON.stringify(value,null,2)+'\n',{flag:'wx'});fs.renameSync(file+'.tmp',file);}
function run(out,contract=pilotContract){fs.mkdirSync(out,{recursive:true});
  const manifest={contract,sourceSha256:C.fingerprint()},digest=C.hash(manifest),mf=path.join(out,'manifest.json');
  if(fs.existsSync(mf))assert.deepEqual(JSON.parse(fs.readFileSync(mf)),manifest);else atomic(mf,manifest);
  let newPairs=0,reusedPairs=0;const rows=[];
  for(const [p,profile] of contract.profiles.entries())for(let i=0;i<contract.pairsPerProfile;i++){
    const seed=contract.seedStart+p*100+i,id=`${profile.id}-${seed}`,file=path.join(out,id+'.json'),started=file+'.started';let row;
    if(fs.existsSync(file)) {row=JSON.parse(fs.readFileSync(file));assert.equal(row.digest,digest);assert.equal(row.id,id);assert.equal(row.profile,profile.id);
      assert.equal(row.seed,seed);assert.equal(row.checksum,C.hash(row.games));assert.equal(row.games.length,2);
      for(const [side,g] of row.games.entries()){assert.equal(g.firstPlayer,side);assert.equal(g.seed,seed);assert.equal(g.profile,profile.id);C.auditGame(g);}
      reusedPairs++;
    }else{
      if(fs.existsSync(started))throw Error('HOLD interrupted pair: '+id);
      fs.writeFileSync(started,JSON.stringify({id,digest,seed,profile:profile.id}),{flag:'wx'});
      const games=[0,1].map(side=>C.play(profile,seed,side,{maxPlies:contract.maxPlies}));games.forEach(g=>C.auditGame(g));
      row={id,digest,profile:profile.id,seed,games,checksum:C.hash(games)};atomic(file,row);newPairs++;
    }
    rows.push(row);console.log(JSON.stringify({id,newPairs,reusedPairs}));
  }
  const reports=contract.profiles.map(profile=>{
    const games=rows.filter(r=>r.profile===profile.id).flatMap(r=>r.games),r=C.operations(games);
    return {...profile,...r,operationalPass:r.searchTurns===0||(r.depthZero/r.searchTurns<=contract.selection.depthZeroMaximum&&r.p95Ms<=contract.selection.p95MaximumMs),
      diversityPass:profile.kind!=='research'||r.uniqueTrajectories>=contract.selection.minimumUniqueResearchTrajectories};});
  const eligible=reports.filter(r=>r.kind==='research'&&r.operationalPass&&r.diversityPass);
  const result={id:contract.id,status:'PASS',manifestDigest:digest,newPairs,reusedPairs,pairs:rows.length,games:rows.length*2,
    environment:{node:process.version,cpu:require('node:os').cpus()[0]?.model},reports,
    selectedNodes:eligible.at(-1)?.nodes??null,selectionStatus:eligible.length?'READY_TO_FREEZE':'HOLD',
    formalWinsInspected:false,technicalFailures:0};
  // Deliberately omit win counts from the operational selection report.
  const resultFile=path.join(out,'operations.json');if(fs.existsSync(resultFile))fs.unlinkSync(resultFile);atomic(resultFile,result);
  console.log(JSON.stringify(result));return result;
}
if(require.main===module){assert.equal(process.argv[2],'pilot');run(path.resolve(process.argv[3]||'/tmp/v010-balance-pilot'));}
module.exports={run,pilotContract,atomic};
