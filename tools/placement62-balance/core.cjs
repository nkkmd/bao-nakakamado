"use strict";
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const referenceSources=require('./reference-sources.json');
for(const [file,expected] of Object.entries(referenceSources.sourceSha256)) {
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../..',file))).digest('hex'),expected,'Reference source changed: '+file);
}
const {createCore}=require('../balance-options/core.cjs');
const config={id:'placement62-hand12',hands:[12,12],pits:[0,0,0,0,6,2,0,0],threshold:6};
const reference=referenceSources.reference;
const core=createCore(config,{protectLast:true,reference});
module.exports={...core,config,reference};
