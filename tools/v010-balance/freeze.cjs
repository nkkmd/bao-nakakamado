'use strict';
// MIT. Freeze the prospective study from completed operational selection ONLY.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),C=require('./core.cjs');
const F=require('./formal.cjs'),{pilotContract}=require('./run.cjs');
const report=JSON.parse(fs.readFileSync(path.join(C.root,'doc/v010-balance/pilot-first-operations.json')));
assert.equal(report.selectionStatus,'READY_TO_FREEZE');assert.equal(report.games,56);assert.equal(report.formalWinsInspected,false);
assert.equal(report.selectedNodes,8192);assert.equal(report.technicalFailures,0);
const eligible=report.reports.filter(r=>r.kind==='research'&&r.operationalPass&&r.diversityPass);assert.equal(eligible.at(-1).nodes,report.selectedNodes);
const contract={id:'NAKAKAMADO-V010-FIRST-PLAYER-FORMAL-001',baseline:pilotContract.baseline,
  rulesVersion:'0.10.0',baseRulesRevision:C.E.BASE_RULES_REVISION,variantRule:C.E.RULE_ID,
  start:'standard initial board, both seats',maxPlies:400,maxDepth:32,quiescenceDepth:1,
  exactRoot:true,tiePolicy:'minimum SHA256 of seed, relative root position, and move key among EXACT equal best root scores',
  seedDomain:'NAKAKAMADO-V010-FIRST-PLAYER-FORMAL-001-INDEPENDENT',
  profiles:[{id:'primary-8192',kind:'research',role:'primary',nodes:8192,pairs:4096},
    {id:'low-512',kind:'research',role:'supplementary',nodes:512,pairs:512},
    {id:'middle-2048',kind:'research',role:'supplementary',nodes:2048,pairs:512}],
  shards:160,mainAlpha:.05,supplementaryFamilyAlpha:.05,confidence:'Hoeffding by seed pair; unresolved extremes',
  practicalRange:[.47,.53],depthZeroMaximum:.01,stopReasons:['normal-terminal','safety-stop','state-repeat','ply-limit'],
  selectionUsedWins:false,posthocChangesAllowed:false};
const seeds=F.tasks({contract}).filter(t=>t.profile.role==='primary').map(t=>t.seed);
assert.equal(new Set(seeds).size,seeds.length,'seed collision');
const pilot={operationsDigest:C.hash(report),pilotManifestDigest:report.manifestDigest,
  originalArchiveSha256:C.hash(fs.readFileSync(path.join(C.root,'doc/v010-balance/pilot-original.tar.gz')))};
const sourceSha256=F.sourceHashes(),body={contract,sourceSha256,pilot},result={...body,digest:C.hash(body)};
const file=path.join(__dirname,'formal-manifest.json');
if(fs.existsSync(file))assert.deepEqual(JSON.parse(fs.readFileSync(file)),result);else fs.writeFileSync(file,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({digest:result.digest,pairs:5120,games:10240,shards:160}));
