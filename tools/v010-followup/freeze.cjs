'use strict';
// MIT. Fix prospective follow-up sources, openings and budgets before measured outcomes.
const fs=require('node:fs'),path=require('node:path'),K=require('./core.cjs'),R=require('./registry.cjs');
const contract={id:'NAKAKAMADO-V010-OPENING-PROOF-STUDY-001',baseline:'e4929df7b15e9f9fb123346959a99f78dc827958',rulesVersion:'0.10.0',
  seedDomain:'NAKAKAMADO-V010-OPENING-PROOF-STUDY-001-NEW',seedBlocks:2,maxPlies:400,quiescenceDepth:1,exactRoot:true,
  matrixShards:32,proofDepth:40,proofNodes:1000000,proofWallMs:600000,
  descriptiveOnly:true,matrixCannotProveInitialWin:true,unknownIsNotDraw:true,normalWinsOnly:true};
const body={contract,sourceSha256:K.fingerprint(),openings:R.openings(),proofRoots:R.roots()},m={...body,digest:K.C.hash(body)};
const file=path.join(__dirname,'manifest.json');if(fs.existsSync(file))require('node:assert/strict').deepEqual(JSON.parse(fs.readFileSync(file)),m);
else fs.writeFileSync(file,JSON.stringify(m,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({digest:m.digest,openings:m.openings.length,proofRoots:m.proofRoots.length}));
