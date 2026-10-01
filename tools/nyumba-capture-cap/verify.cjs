"use strict";
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {S}=require('./capped-engine.cjs');
const read=(file)=>JSON.parse(fs.readFileSync(file,'utf8'));
const outputDir=path.resolve(__dirname,process.env.BAO_CAP_OUTPUT_DIR||'runs');
const files=['results.json','boundaries.json','search-check.json'];
const original=Object.fromEntries(files.map(file=>[file,read(path.join(__dirname,file))]));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const provenance=read(path.join(__dirname,'provenance.json'));
for(const file of files){
 assert.equal(sha(fs.readFileSync(path.join(__dirname,file))),provenance.originalArtifactManifest['analysis/'+file],'Original result changed: '+file);
 assert.equal(original[file].status,'PASS');
 const rerun=read(path.join(outputDir,file));
 if(file==='results.json'){
   // Relocated source paths and byte fingerprints differ; all observations must match.
   delete rerun.sourceSha256;
   const {sourceSha256,...expected}=original[file];
   assert.deepEqual(rerun,expected);
 } else assert.deepEqual(rerun,original[file]);
}
const main=original['results.json'],search=original['search-check.json'];
assert.equal(main.rows.length,8);assert.equal(search.rows.length,2);
const all=[...main.rows,...search.rows];
assert.equal(all.reduce((n,row)=>n+row.n,0),8400);
for(const row of all){
 assert.equal(Object.values(row.reasons).reduce((n,v)=>n+v,0),row.n);
 assert.ok(Object.keys(row.reasons).every(reason=>['front-empty','no-move'].includes(reason)));
 assert.equal(row.firstWinPct,100*row.firstWins/row.n);
 assert.ok(row.maxPlies<400);
}
assert.equal(main.checks.transitions,45960);assert.equal(main.failures.length,0);
let examplesReplayed=0;
for(const example of Object.values(main.examples)){
 const actual=S.applyWithEvents({board:example.before,history:[]},example.move);
 assert.deepEqual(JSON.parse(JSON.stringify(actual.events)),example.events);
 examplesReplayed++;
}
const summary={status:'PASS',decision:'NOT_ADOPTED',reference:main.reference,
 originalResultFilesByteIdentical:true,fullRerunMatchesOriginal:true,
 totalMainAndSearchGames:8400,checkedTransitions:main.checks.transitions,
 partialCaptures:main.checks.partial,partialHouseCaptures:main.checks.partialHouse,
 replayGames:main.checks.replay,mirrorPairs:main.checks.mirror,examplesReplayed,
 failures:main.failures.length,
 note:'Comparison excludes only main-study sourceSha256, which changes when runners are relocated.'};
fs.writeFileSync(path.join(outputDir,'verification.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
