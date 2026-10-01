"use strict";
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
function restore(dir){
 const summary=JSON.parse(fs.readFileSync(path.join(dir,'summary.json'),'utf8'));assert.ok(summary.completed);
 const write=(name,data)=>{const p=path.join(dir,name);if(fs.existsSync(p))return;assert.equal(data.signature,summary.signature);fs.writeFileSync(p,JSON.stringify(data,null,2)+'\n');};
 for(const row of summary.self)write('self-'+row.policy+'.json',row);
 for(const row of summary.cross)write('cross-'+row.a+'-'+row.b+'.json',row);
 for(const row of summary.mirrors)write('mirror-'+row.policy+'.json',row);
 write('proof.json',summary.proof);
 console.log(JSON.stringify({status:'PASS',config:summary.config.id,restoredCheckpointFiles:summary.self.length+summary.cross.length+summary.mirrors.length+1}));
}
if(require.main===module)restore(process.argv[2]);
module.exports={restore};
