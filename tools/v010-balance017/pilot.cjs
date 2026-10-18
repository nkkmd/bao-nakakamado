'use strict';
// MIT. Operational pilot only. Separate seed domain; not a formal sample.
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),assert=require('node:assert/strict');
const T=require('./study.cjs'),K=require('../v010-followup/core.cjs'),R=require('../v010-followup/registry.cjs'),{C}=K;
const out=process.argv[2];fs.mkdirSync(out,{recursive:true});assert.ok(!fs.existsSync(path.join(out,'pilot.json')));
const rows=[];for(const profile of T.profiles){const opening=R.openings()[0],seed=parseInt(C.hash(['BALANCE017-OPERATIONAL-PILOT',profile.id]).slice(0,8),16),start=performance.now();
 const games=[0,1].map(side=>K.play(opening,[profile,profile],seed,side));assert.equal(games[0].trajectory,games[1].trajectory);assert.deepEqual(games[1].final,C.mirror(games[0].final));
 const name=profile.id+'.json.gz';fs.writeFileSync(path.join(out,name),z.gzipSync(JSON.stringify({classification:'OPERATIONAL-PILOT-NOT-FORMAL',seed,profile,games}),{level:9}));
 rows.push({profile:profile.id,pairElapsedMs:performance.now()-start,sha256:C.hash(fs.readFileSync(path.join(out,name))),file:name,operations:C.operations(games)});
}
const receipt={classification:'OPERATIONAL-PILOT-NOT-FORMAL',node:process.version,cpu:require('node:os').cpus()[0]?.model,rows,newGames:12,notUsedForWinRateOrPolicySelection:true};fs.writeFileSync(path.join(out,'pilot.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
