"use strict";
// MIT. Frozen contract integrity and pre-formal feasibility revision.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const V=require('./equal-time-formal-v2.cjs'),M=require('./equal-time-match.cjs'),O=require('./equal-time-openings.cjs'),A=require('./verify-equal-time-formal-v2.cjs');
const directory=path.resolve(__dirname,'../../doc/equal-time-formal-v2'),read=name=>JSON.parse(fs.readFileSync(path.join(directory,name+'.json'))),clone=O.clone;
test('v1 remains HOLD; v2 changes only opening distribution before formal games, retaining decision thresholds and seed range',()=>{
 const hold=read('v1-hold'),d=V.design();assert.equal(hold.status,'HOLD-INSUFFICIENT-INDEPENDENT-OPENINGS');assert.equal(hold.failedStratum.counts.eligible,0);
 assert.equal(hold.formalGamesPlayed,0);assert.equal(V.spec.formalGamesPlayedBeforeRevision,0);assert.equal(V.spec.pilotStrengthScoresRead,false);
 assert.deepEqual(M.spec.formalDesign.policies,['random','noisy','greedy','reply']);assert.deepEqual(d.policies,['random','noisy']);
 for(const k of V.spec.inheritedDecisionFields)assert.deepEqual(d[k],M.spec.formalDesign[k]);
 for(const k of ['candidateSeedStart','candidateSeedCount','pairs','games','shards'])assert.equal(d[k],M.spec.formalDesign[k]);
});
test('256 frozen roots are replayable, unique and interleaved across four exact strata; sources and manifest are bound',()=>{
 const contract=read('contract'),m=read('openings'),p=V.preflight(),counts={},groups=new Set(),roots=new Set();
 assert.equal(contract.fingerprint,p.fingerprint);assert.equal(contract.pilotFingerprint,p.pilotFingerprint);assert.equal(contract.openingManifestSha256,O.hash(m));
 assert.equal(contract.timeLimitMs,150);assert.equal(m.openings.length,256);
 for(let i=0;i<m.openings.length;i++){const x=m.openings[i];O.replayOpening(x);assert.equal(x.first,i%2);assert.equal(x.policy,V.design().policies[Math.floor((i%4)/2)]);
  const k=x.policy+'-'+x.first;counts[k]=(counts[k]||0)+1;groups.add(x.group);roots.add(x.rootSha256);}
 assert.deepEqual(counts,{'random-0':64,'random-1':64,'noisy-0':64,'noisy-1':64});assert.equal(groups.size,256);assert.equal(roots.size,256);
 assert.equal(contract.formalGamesPlayed,0);assert.equal(contract.publicAdopted,false);
});
test('Durable original ZIPs, all 24 game replays and every contract field are audited without search or strength scores',()=>{
 const summaries=A.archivedPilots(),contract=read('contract'),m=read('openings');assert.equal(summaries.reduce((n,s)=>n+s.games,0),24);
 assert.ok(summaries.every(s=>s.strengthScoresComputed===false&&s.operationalPass));A.verifyContract(contract,m,summaries);
 for(const change of [x=>x.timeLimitMs=75,x=>x.formalRuntime.allowedCpuModels.push('unregistered'),x=>x.resumePolicy='restart',
  x=>x.pilotBindings[0].origin.runId='1',x=>x.design.alpha=.2,x=>x.modelSha256='0'.repeat(64),x=>x.openingManifestSha256='0'.repeat(64)]){
  const bad=clone(contract);change(bad);assert.throws(()=>A.verifyContract(bad,m,summaries));}
});
test('No formal match launch is exposed; frozen output cannot be overwritten',()=>{
 assert.throws(()=>V.freeze([],directory),/already exists/);assert.equal(V.spec.seedRangeExpanded,false);assert.equal(V.spec.exclusionsRelaxed,false);
 const d=V.design();assert.equal(d.stopPolicy,'fixed-all-pairs-no-optional-stopping-no-retry-for-strength');
});
