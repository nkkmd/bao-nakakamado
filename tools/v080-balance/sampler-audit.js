'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),c=require('./core.cjs');
function legacyRng(seed){let x=seed>>>0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return x>>>0;};}
const old=Array.from({length:5},()=>new Set()),fresh=Array.from({length:5},()=>new Set());
for(let i=0;i<128;i++){const seed=c.seedAt(100000+i),a=legacyRng(seed^0xa341316c),b=legacyRng(seed^0xc8013ea4),u=c.rng(seed+':role-A'),v=c.rng(seed+':role-B');for(let j=0;j<5;j++){old[j].add((a()^b())>>>0);fresh[j].add((Math.floor(u()*4294967296)^Math.floor(v()*4294967296))>>>0);}}
assert.ok(old.every(x=>x.size===1));assert.ok(fresh.every(x=>x.size>1));
const result={samples:128,drawsPerStream:5,legacySourceCommit:'0bdff41c2da126a3f46a4f8f90e326868c6aad9c',legacyFixedXorMasks:old.map(x=>[...x][0].toString(16).padStart(8,'0')),r2DistinctXorMasks:fresh.map(x=>x.size),independenceProofClaimed:false,hashes:Object.fromEntries(['sampler-audit.js','core.cjs'].map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,p))).digest('hex')]))};
const out=process.argv[2]||path.join(__dirname,'results','sampler-audit.json');fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
