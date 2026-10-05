"use strict";
// MIT. Feasibility revision before formal matches; retains v1 and all pilot measurements.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const O=require('./equal-time-openings.cjs'),M=require('./equal-time-match.cjs'),I=require('./learning-input.cjs');
const spec=require('./equal-time-formal-v2-spec.json'),root=path.resolve(__dirname,'../..'),hash=O.hash;
const shaBytes=data=>crypto.createHash('sha256').update(data).digest('hex');
function design(){const d={...M.spec.formalDesign};for(const k of ['id','candidateSeedStart','candidateSeedCount','policies','pairsPerPolicyAndStartingSide','pairs','games','shards','orderingSalt'])d[k]=spec[k];
 assert.equal(d.policies.length*2*d.pairsPerPolicyAndStartingSide,d.pairs);assert.equal(d.games,2*d.pairs);
 for(const k of spec.inheritedDecisionFields)assert.deepEqual(d[k],M.spec.formalDesign[k]);return d;}
function preflight(){const p=M.preflight(),sourceHashes={...p.sourceHashes,...Object.fromEntries([
 'tools/ai-integration/equal-time-formal-v2.cjs','tools/ai-integration/equal-time-formal-v2-spec.json',
 'tools/ai-integration/formal-collection-spec.json','tools/ai-integration/formal-learning-spec.json'
 ].map(file=>[file,shaBytes(fs.readFileSync(path.join(root,file)))]))};
 return {pilotFingerprint:p.fingerprint,sourceHashes,fingerprint:hash(sourceHashes),connection:p.connection};}
function context({progress=()=>{}}={}){const r=O.registry(),old=O.oldGroups({progress});return {r,old,
 groups:new Set([...r.openingGroups,...old.groups]),positions:new Set(r.positionHashes),inputs:new Set(r.inputHashes)};}
function indexes(policy,first,d){return Array.from({length:d.candidateSeedCount},(_,i)=>d.candidateSeedStart+i).filter(i=>i%2===first)
 .map(index=>({index,key:hash([d.orderingSalt,policy,index])})).sort((a,b)=>a.key.localeCompare(b.key,'en')).map(x=>x.index);}
function independent(t,c){if(!t.complete)return 'short';if(c.groups.has(t.group))return 'excludedGroup';
 const state=t.states.at(-1);if(c.positions.has(hash(I.positionKey(state)))||c.inputs.has(hash(I.encode(state))))return 'excludedRoot';return null;}
function v1Hold(c){const d=M.spec.formalDesign,counts={short:0,excludedGroup:0,excludedRoot:0,eligible:0};
 for(const index of indexes('greedy',0,d)){const reason=independent(O.prefix('greedy',index),c);counts[reason||'eligible']++;}
 assert.ok(counts.eligible<d.pairsPerPolicyAndStartingSide,'v1 feasibility diagnosis changed');
 return {id:d.id,status:'HOLD-INSUFFICIENT-INDEPENDENT-OPENINGS',failedStratum:{policy:'greedy',first:0,required:d.pairsPerPolicyAndStartingSide,
  candidates:d.candidateSeedCount/2,counts},originalOpeningGroupsSha256:c.old.digest,developmentDigest:c.r.digest,
  originalGeneratorPrefixes:c.old.valid+c.old.short,formalGamesPlayed:0,pilotStrengthScoresRead:false,
  seedRangeExpanded:false,exclusionsRelaxed:false,originalSpecPreserved:true};}
function manifest(c,{progress=()=>{}}={}){
 const d=design(),rows=[],groups=new Set(),positions=new Set(),counts={short:0,excludedGroup:0,excludedRoot:0,duplicateGroup:0,duplicateRoot:0};
 for(const policy of d.policies)for(const first of [0,1]){
  let accepted=0;for(const index of indexes(policy,first,d)){
   const t=O.prefix(policy,index),reason=independent(t,c);if(reason){counts[reason]++;continue;}
   const position=hash(I.positionKey(t.states.at(-1)));
   if(groups.has(t.group)){counts.duplicateGroup++;continue;}if(positions.has(position)){counts.duplicateRoot++;continue;}
   groups.add(t.group);positions.add(position);rows.push(O.opening(t));accepted++;if(accepted===d.pairsPerPolicyAndStartingSide)break;
  }
  assert.equal(accepted,d.pairsPerPolicyAndStartingSide,'v2 independent openings insufficient: HOLD');progress({phase:'v2-openings',policy,first,accepted});
 }
 const openings=Array.from({length:d.pairsPerPolicyAndStartingSide},(_,k)=>Array.from({length:4},(_,s)=>rows[s*d.pairsPerPolicyAndStartingSide+k])).flat();
 return {id:d.id,openingPlies:M.spec.openingPlies,openings,exclusions:{developmentDigest:c.r.digest,originalSeedStart:900000,originalSeedCount:4096,
  originalPolicies:require('./formal-collection-spec.json').policies,originalValidPrefixes:c.old.valid,originalShortPrefixes:c.old.short,
  originalUniqueGroups:c.old.groups.size,originalGroupsSha256:c.old.digest,excludedOpeningGroups:c.groups.size,
  selectedUniqueGroups:groups.size,selectedUniqueRoots:positions.size,rejections:counts},
  scope:'independent-starting-prefixes-not-disjoint-future-game-states',formalRowsRead:0};
}
function auditManifest(m,c){const d=design();assert.equal(m.id,d.id);assert.equal(m.openingPlies,M.spec.openingPlies);assert.equal(m.openings.length,d.pairs);
 assert.equal(m.formalRowsRead,0);const groups=new Set(),positions=new Set(),strata={};
 for(let i=0;i<m.openings.length;i++){
  const o=m.openings[i];assert.ok(d.policies.includes(o.policy));assert.ok(o.seedIndex>=d.candidateSeedStart&&o.seedIndex<d.candidateSeedStart+d.candidateSeedCount);
  assert.equal(o.first,o.seedIndex%2);assert.equal(o.moves.length,M.spec.openingPlies);
  assert.equal(o.policy,d.policies[Math.floor((i%4)/2)]);assert.equal(o.first,i%2,'Interleaved starting-side schedule');
  const t=O.prefix(o.policy,o.seedIndex);assert.deepEqual(O.opening(t),o);assert.equal(independent(t,c),null);
  const p=hash(I.positionKey(O.replayOpening(o).board));assert.ok(!groups.has(o.group)&&!positions.has(p),'Duplicate independent opening');
  groups.add(o.group);positions.add(p);const key=o.policy+'-'+o.first;strata[key]=(strata[key]||0)+1;
 }
 assert.deepEqual(Object.keys(strata).sort(),d.policies.flatMap(p=>[p+'-0',p+'-1']).sort());
 assert.ok(Object.values(strata).every(n=>n===d.pairsPerPolicyAndStartingSide));
 assert.equal(m.exclusions.originalGroupsSha256,c.old.digest);assert.equal(m.exclusions.developmentDigest,c.r.digest);
 assert.equal(m.exclusions.selectedUniqueGroups,groups.size);assert.equal(m.exclusions.selectedUniqueRoots,positions.size);return {strata,groups:groups.size,roots:positions.size};
}
function auditPilots(directories){assert.equal(directories.length,3);
 const summaries=directories.map((dir,i)=>M.auditPilot(dir,M.spec.budgetsMs[i]));
 for(const s of summaries)for(const o of s.origins){assert.equal(o.repository,'nkkmd/bao-nakakamado');assert.equal(o.runId,spec.pilotRunId);
  assert.equal(o.attempt,spec.pilotAttempt);assert.equal(o.headSha,spec.pilotCheckoutSha);}
 return summaries;
}
function checkPilotArchives(){return spec.pilotArtifacts.map(a=>{const file='doc/equal-time-pilot/pilot-'+a.budgetMs+'.zip',b=fs.readFileSync(path.join(root,file));
 assert.equal(b.length,a.bytes);assert.equal('sha256:'+shaBytes(b),a.digest);return {...a,file};});}
function buildContract(m,summaries,p){const budget=M.selectBudget(summaries),d=design();return {
 id:d.id,dateJST:'2026-10-05',status:'conditions-frozen-formal-matches-not-started',supersedes:spec.supersedes,
 modelSha256:p.connection.modelSha256,baselineEvaluatorId:M.IDs.baseline,searchId:require('../../prototype/model-search-ai.js').SEARCH_ID,
 fingerprint:p.fingerprint,pilotFingerprint:p.pilotFingerprint,sourceHashes:p.sourceHashes,
 clock:'real-monotonic-per-move-cooperative-deadline',timeLimitMs:budget,search:M.options(budget),maximumPlies:M.spec.maximumPlies,
 openingManifestSha256:hash(m),design:d,gameAssignment:'same-root-two-games-model-south-and-model-north',
 executionOrder:'alternate-model-side-order-by-pair-index',shardAssignment:'pair-index-modulo-32',
 formalRuntime:{node:'v24.21.0',platform:'linux',arch:'x64',allowedCpuModels:['AMD EPYC 7763 64-Core Processor','AMD EPYC 9V74 80-Core Processor'],
  runnerImage:'20260927.320.1',policy:'each-pair-same-host-record-environment-HOLD-for-unregistered-environment'},
 pilotBindings:summaries.map(s=>({budgetMs:s.budgetMs,bindingSha256:hash(s.binding),recordsSha256:s.recordsSha256,environment:s.binding.environment,
  origin:s.origins[0],operationalPass:s.operationalPass})),pilotArtifacts:checkPilotArchives(),
 resumePolicy:'reuse-only-audited-completed-games-same-contract-source-environment-origin-and-checksum',
 interruptedGamePolicy:'HOLD-until-recorded-recovery-policy-no-silent-restart',
 stopPolicy:d.stopPolicy,formalRowsRead:0,formalGamesPlayed:0,publicAdopted:false};}
function freeze(directories,output,{progress=()=>{}}={}){
 assert.ok(!fs.existsSync(output),'Frozen output already exists');const p=preflight(),summaries=auditPilots(directories),c=context({progress});
 const hold=v1Hold(c),m=manifest(c,{progress});auditManifest(m,c);const contract=buildContract(m,summaries,p);
 fs.mkdirSync(output,{recursive:true});M.save(path.join(output,'v1-hold.json'),hold);M.save(path.join(output,'openings.json'),m);M.save(path.join(output,'contract.json'),contract);
 return {status:'CONDITIONS-FROZEN-NOT-STRENGTH-RESULT',timeLimitMs:contract.timeLimitMs,contractSha256:hash(contract),openingManifestSha256:hash(m),
  fingerprint:p.fingerprint,pilotFingerprint:p.pilotFingerprint,pairs:m.openings.length,games:design().games,exclusions:m.exclusions,
  v1Hold:hold,formalRowsRead:0,formalGamesPlayed:0,publicAdopted:false};
}
function auditFrozen(directory,{regenerate=false,progress=()=>{}}={}){
 const p=preflight(),contract=JSON.parse(fs.readFileSync(path.join(directory,'contract.json'))),m=JSON.parse(fs.readFileSync(path.join(directory,'openings.json'))),
  hold=JSON.parse(fs.readFileSync(path.join(directory,'v1-hold.json')));
 assert.equal(contract.id,spec.id);assert.equal(contract.status,'conditions-frozen-formal-matches-not-started');assert.equal(contract.supersedes,spec.supersedes);
 assert.equal(contract.fingerprint,p.fingerprint);assert.deepEqual(contract.sourceHashes,p.sourceHashes);assert.equal(contract.pilotFingerprint,p.pilotFingerprint);
 assert.equal(contract.modelSha256,p.connection.modelSha256);assert.equal(contract.baselineEvaluatorId,M.IDs.baseline);
 assert.equal(contract.searchId,require('../../prototype/model-search-ai.js').SEARCH_ID);assert.equal(contract.dateJST,'2026-10-05');
 assert.deepEqual(contract.design,design());assert.deepEqual(contract.search,M.options(contract.timeLimitMs));assert.equal(contract.maximumPlies,M.spec.maximumPlies);
 assert.equal(contract.openingManifestSha256,hash(m));assert.equal(contract.formalRowsRead,0);assert.equal(contract.formalGamesPlayed,0);assert.equal(contract.publicAdopted,false);
 assert.deepEqual(contract.pilotArtifacts,checkPilotArchives());
 const c=context({progress}),audit=auditManifest(m,c);assert.deepEqual(hold,v1Hold(c));if(regenerate)assert.deepEqual(m,manifest(c,{progress}),'Frozen schedule regeneration');
 return {id:spec.id,status:'FROZEN-CONTRACT-AND-OPENINGS-PASS',contractSha256:hash(contract),openingManifestSha256:hash(m),
  fingerprint:p.fingerprint,pilotFingerprint:p.pilotFingerprint,timeLimitMs:contract.timeLimitMs,...audit,
  originalGeneratorPrefixes:c.old.valid+c.old.short,regenerated:regenerate,formalRowsRead:0,formalGamesPlayed:0,publicAdopted:false};
}
if(require.main===module){try{
 const [cmd,...args]=process.argv.slice(2),progress=x=>console.log(JSON.stringify(x));
 if(cmd==='freeze'&&args.length===4)console.log(JSON.stringify(freeze(args.slice(0,3).map(x=>path.resolve(x)),path.resolve(args[3]),{progress}),null,2));
 else if(cmd==='verify'&&args.length===1)console.log(JSON.stringify(auditFrozen(path.resolve(args[0]),{regenerate:true,progress}),null,2));
 else throw Error('Usage: freeze PILOT25 PILOT75 PILOT150 NEW_DIRECTORY | verify FROZEN_DIRECTORY');
 }catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={spec,design,preflight,context,indexes,independent,v1Hold,manifest,auditManifest,auditPilots,checkPilotArchives,buildContract,freeze,auditFrozen};
