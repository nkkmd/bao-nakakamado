'use strict';
// MIT. Prospective finite budgets and exact quantifiers; no outcome selection.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),C=require('../v010-balance/core.cjs'),S=require('./study.cjs'),I=require('./inputs.cjs');
const body={contract:{id:'NAKAKAMADO-V010-INITIAL-PROOF-STUDY-002',baseline:'73af579145a4e8225010d61fe7a948abccffcf17',rulesVersion:'0.10.0',maxDepth:80,maxNodes:10000000,wallMs:1200000,
 maxCache:100000,maxStoredNodes:500000,maxHeapBytes:1610612736,newGames:0,unknownIsNotDraw:true,normalWinsOnly:true},sources:S.fingerprint(),roots:I.roots()};
const m={...body,digest:C.hash(body)},file=path.join(__dirname,'manifest.json');if(fs.existsSync(file))assert.deepEqual(JSON.parse(fs.readFileSync(file)),m);else fs.writeFileSync(file,JSON.stringify(m,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({digest:m.digest,roots:m.roots.length,jobs:m.roots.length*2}));
