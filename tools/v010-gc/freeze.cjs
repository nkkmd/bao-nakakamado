'use strict';
// MIT. Freeze efficiency changes and staged certificate inputs before outcomes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),C=require('../v010-balance/core.cjs'),S=require('./study.cjs'),I=require('./inputs.cjs');
const body={contract:{id:'NAKAKAMADO-V010-PROOF-GC-STUDY-003',baseline:'126f088b1a6e41fa6277df8961081c3afd0220a1',rulesVersion:'0.10.0',maxDepth:80,maxNodes:10000000,wallMs:1200000,
 maxCache:100000,maxStoredNodes:500000,maxHeapBytes:1610612736,collectAt:400000,collectTarget:300000,newGames:0,unknownIsNotDraw:true,normalWinsOnly:true},sources:S.fingerprint(),roots:I.roots(),
 phases:[{id:'back21',indices:[14],dependencies:[]},{id:'back19',indices:[15],dependencies:[14]},{id:'back17',indices:[16],dependencies:[14,15]},
 {id:'openings',indices:Array.from({length:14},(_,i)=>i),dependencies:[14,15,16]}]};
const m={...body,digest:C.hash(body)},file=path.join(__dirname,'manifest.json');if(fs.existsSync(file))assert.deepEqual(JSON.parse(fs.readFileSync(file)),m);else fs.writeFileSync(file,JSON.stringify(m,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({digest:m.digest,roots:m.roots.length,jobs:m.roots.length*2}));
