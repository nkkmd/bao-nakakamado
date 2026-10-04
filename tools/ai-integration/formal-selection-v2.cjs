"use strict";
// MIT. Label-blind selection after the complete candidate universe is audited.
const assert=require('node:assert/strict'),T=require('./teacher-feasibility.cjs');
function select(rows,c,roundRobin){
 const s=c.selection;assert.equal(s.version,2);assert.deepEqual(s.splitOrder,['train','validation','final']);
 const {numerator,denominator}=s.targetMultiplier;
 assert.ok(Number.isSafeInteger(numerator)&&Number.isSafeInteger(denominator)&&numerator>=denominator&&denominator>0);
 const target=n=>Math.ceil(n*numerator/denominator),ordered=roundRobin(rows),chosen=[],ids=new Set();
 const buckets=Object.fromEntries(s.splitOrder.map(split=>[split,ordered.filter(r=>r.split===split).map(row=>({row,tags:T.tags(row.state)}))]));
 for(const split of s.splitOrder){
  const bucket=buckets[split],coverage=Object.fromEntries(s.coveragePriority.map(k=>[k,0])),groups=new Set();let count=0;
  const add=entry=>{if(ids.has(entry.row.id)||chosen.length>=c.maximumTeacherRequests)return false;
   chosen.push(entry.row);ids.add(entry.row.id);groups.add(entry.row.group);count++;
   for(const k of s.coveragePriority)if(entry.tags[k])coverage[k]++;return true;};
  for(const k of s.coveragePriority){assert.ok(k in c.minimumCoverage[split],'Unregistered coverage stratum');
   const goal=target(c.minimumCoverage[split][k]);for(const entry of bucket){if(coverage[k]>=goal)break;if(entry.tags[k])add(entry);}}
  const groupGoal=target(c.minimumOpeningGroups[split]);for(const entry of bucket){if(groups.size>=groupGoal)break;if(!groups.has(entry.row.group))add(entry);}
  const rowGoal=target(c.minimumAcceptedRows[split]);for(const entry of bucket){if(count>=rowGoal)break;add(entry);}
 }
 for(const row of ordered){if(chosen.length>=c.maximumTeacherRequests)break;if(!ids.has(row.id)){chosen.push(row);ids.add(row.id);}}
 return chosen;
}
module.exports={select};
