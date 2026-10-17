'use strict';
// MIT. Frozen independent finite horizons; an unproved horizon never proves a loss.
const PN=require('./prover.cjs');
const SCHEDULE=[{depth:14,maxNodes:200000},{depth:18,maxNodes:400000},{depth:22,maxNodes:800000},{depth:30,maxNodes:1600000},{depth:46,maxNodes:3200000},{depth:76,maxNodes:3800000}];
function prove(start,target,{horizons=SCHEDULE,maxNodes=10000000,wallMs=300000,phaseWallMs=50000,tablePolicy='fifo',now=()=>performance.now(),onAttempt=()=>{},...options}={}){
 const began=now(),attempts=[];let totalVisits=0,totalTransitions=0,totalBook=0,totalCache=0,totalExpansions=0,totalEvictions=0,last=null,peakTable=0,peakStored=0;
 for(const phase of horizons){const remaining=wallMs-(now()-began);if(remaining<=0||totalVisits>=maxNodes)break;
 const r=PN.prove(start,target,{...options,tablePolicy,maxDepth:phase.depth,maxNodes:Math.min(phase.maxNodes,maxNodes-totalVisits),wallMs:Math.min(phaseWallMs,remaining),now});
 totalEvictions+=r.evictions;totalVisits+=r.visits;totalTransitions+=r.transitions;totalBook+=r.bookUses;totalCache+=r.cacheHits;totalExpansions+=r.expansions;peakTable=Math.max(peakTable,r.tableEntries);peakStored=Math.max(peakStored,r.storedNodes);
 const a={tablePolicy:r.tablePolicy,evictions:r.evictions,depth:phase.depth,status:r.status,visits:r.visits,totalVisits,elapsedMs:r.elapsedMs,tableEntries:r.tableEntries,storedNodes:r.storedNodes,finiteHorizonRefuted:r.finiteHorizonRefuted,proofNumber:r.proofNumber,disproofNumber:r.disproofNumber};attempts.push(a);onAttempt(a);last=r;if(r.certificate)break;
 if(typeof global.gc==='function')global.gc();
 }
 if(!last)last={tablePolicy,evictions:0,status:'WALL_BUDGET',target,winner:null,certificate:null,stopReason:'WALL_BUDGET'};
 return {...last,tablePolicy,evictions:totalEvictions,attempts,visits:totalVisits,transitions:totalTransitions,bookUses:totalBook,cacheHits:totalCache,expansions:totalExpansions,peakTable,peakStored,elapsedMs:now()-began};
}
module.exports={prove,SCHEDULE};
