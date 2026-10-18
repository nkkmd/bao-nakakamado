'use strict';
// MIT. Descriptive reanalysis of immutable records; never calls play/search.
const fs=require('node:fs'),z=require('node:zlib'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('../v010-balance/core.cjs'),F=require('../v010-balance/formal.cjs'),R=require('../v010-followup/registry.cjs');
const m=F.manifest(),groups={};const quant=(xs,p)=>[...xs].sort((a,b)=>a-b)[Math.ceil(xs.length*p)-1];
for(const t of F.tasks(m)){
 const raw=fs.readFileSync(path.join(process.argv[2],t.id+'.json.gz')),row=JSON.parse(z.gunzipSync(raw));
 assert.equal(row.id,t.id);assert.equal(row.digest,m.digest);assert.equal(row.checksum,C.hash(row.games));
 const a=groups[t.profile.id]??={profile:t.profile,pairs:0,games:0,wins:[0,0],stops:{},openings:{},trajectories:new Map(),prefixes:new Map(),seeds:new Set(),symmetryFailures:0,nodes:[],depths:[],elapsed:[],maxNodes:0,depthZero:0};
 a.pairs++;a.seeds.add(row.seed);
 assert.equal(row.games.length,2);a.symmetryFailures+=Number(row.games[0].trajectory!==row.games[1].trajectory||row.games[0].firstWin!==row.games[1].firstWin);
 row.games.forEach((g,side)=>{assert.equal(g.firstPlayer,side);a.games++;a.stops[g.stop]=(a.stops[g.stop]||0)+1;if(g.firstWin!==null)a.wins[g.firstWin?0:1]++;
  const opening=g.turns.slice(0,2).map(t=>C.Public.moveKey(t.move)).join(' -> ');a.openings[opening]=(a.openings[opening]||0)+1;
  if(!side){a.trajectories.set(g.trajectory,(a.trajectories.get(g.trajectory)||0)+1);const seq=g.turns.map(t=>C.Public.moveKey(t.move));seq.forEach((_,i)=>{if(!a.prefixes.has(i))a.prefixes.set(i,new Set());a.prefixes.get(i).add(C.hash(seq.slice(0,i+1)));});}
  for(const tr of g.turns){a.nodes.push(tr.stats.nodes);a.depths.push(tr.stats.completedDepth);a.elapsed.push(tr.elapsedMs);a.maxNodes=Math.max(a.maxNodes,tr.stats.nodes);a.depthZero+=Number(!tr.stats.completedDepth);}
 });
}
const profiles=Object.values(groups).map(a=>({profile:a.profile,pairs:a.pairs,games:a.games,firstWins:a.wins[0],secondWins:a.wins[1],stops:a.stops,
 naturalOpenings:a.openings,uniqueSeeds:a.seeds.size,seedCollisions:a.pairs-a.seeds.size,seatSymmetryFailures:a.symmetryFailures,
 distinctNormalizedTrajectories:a.trajectories.size,largestTrajectoryClusterPairs:Math.max(...a.trajectories.values()),duplicateTrajectoryPairs:a.pairs-a.trajectories.size,
 firstDivergentPrefixPly:[...a.prefixes].find(([i,s])=>s.size>1)?.[0]+1,
 actualSearch:{turns:a.nodes.length,medianNodes:quant(a.nodes,.5),maxNodes:a.maxNodes,medianDepth:quant(a.depths,.5),depthZero:a.depthZero,elapsedP50Ms:quant(a.elapsed,.5),elapsedP95Ms:quant(a.elapsed,.95)}}));
const openings=R.openings();assert.equal(openings.length,15);
const old=JSON.parse(fs.readFileSync('doc/v010-research-completed/study-001/summary.json'));
const report={classification:'EXPLORATORY-READONLY-NOT-CONFIRMATORY',baseline:'f8048a7f37f7ef63a2a0df5f022878fae798c230',formalManifest:m.digest,
 sourceArchiveSha256:C.hash(fs.readFileSync('doc/v010-balance/formal-original-artifacts.zip')),newGames:0,newProofSearches:0,profiles,
 openingCoverage:openings.filter(o=>o.forced).map(o=>({id:o.id,firstIndex:o.firstIndex,replyIndex:o.replyIndex,moves:o.moves,startKey:o.startKey,
 formal10240Games:profiles.reduce((n,p)=>n+(p.naturalOpenings[o.moves.map(C.Public.moveKey).join(' -> ')]||0),0),
 study001Cells:old.matrix.filter(c=>c.openingId===o.id)})),
 naturalStudy001:old.matrix.filter(c=>!c.forced),interpretation:'Seat mirrors are paired; trajectory duplicates are not independent opening evidence. Seed-conditioned intervals do not estimate game-wide fairness.'};
fs.writeFileSync('doc/v010-balance017/exploratory-reanalysis.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({profiles,newGames:0,newProofSearches:0}));
