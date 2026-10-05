'use strict';
// Temporary read-only audit of pinned public match records using unchanged repository exports.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),W=require(root+'/tools/ai-integration/equal-time-worker.cjs'),A=require(root+'/tools/ai-integration/equal-time-worker-artifact.cjs');
async function audit(base){
 const metadata=JSON.parse(fs.readFileSync(path.join(base,'metadata.json'))),p=W.profile();
 assert.equal(p.binding.runnerFingerprint,'ce0cb9f7e7defc9c4b776a95188ca2e55d53eed8d69c755b5eb3e582117894d7');
 const receipts=A.receipts(JSON.stringify(metadata.receipts),p),refs=new Map(metadata.refs.map(r=>[r.ref,r])),tags=new Map(metadata.tags.map(t=>[t.sha,t]));
 const api=async(endpoint,method='GET',body,missing=false)=>{assert.equal(method,'GET');let value;
  if(endpoint.startsWith('/git/ref/'))value=refs.get('refs/'+endpoint.slice(9));else if(endpoint.startsWith('/git/tags/'))value=tags.get(endpoint.slice(10));else throw Error('Unexpected read');
  if(!value&&!missing)throw Error('Missing durable tag');return value||null;};
 const shards=[];
 for(const receipt of receipts){const origin=metadata.runs.find(r=>String(r.id)===receipt.runId&&String(r.run_attempt)===receipt.attempt);
  const artifact=metadata.artifacts.find(a=>String(a.id)===receipt.artifactId);A.checkMetadata(origin,artifact,receipt);
  const zip=path.join(base,'shard-'+receipt.shard+'.zip'),bytes=fs.readFileSync(zip);assert.equal(bytes.length,artifact.size_in_bytes);assert.equal('sha256:'+W.bytesHash(bytes),receipt.digest);
  const dir=path.join(base,'shard-'+receipt.shard);
  if(!fs.existsSync(dir))execFileSync('python3',[root+'/tools/ai-integration/equal-time-worker-unzip.py',zip,dir],{timeout:30000});
  const a=await W.auditDirectory(dir,p,api);assert.equal(a.lease.payload.shard,receipt.shard);shards.push({dir,receipt,a});
 }
 assert.equal(new Set(shards.map(x=>x.a.session.sha)).size,1);
 const report={scope:'READ-ONLY-PINNED-PUBLIC-RECORD-AUDIT',binding:p.binding,sessionSha:shards[0]?.a.session.sha,
  auditedShards:shards.length,completedPairs:shards.reduce((n,x)=>n+x.a.pairs.length,0),shards:shards.map(x=>({shard:x.receipt.shard,status:x.a.ledger.status,pairs:x.a.pairs.length,active:x.a.ledger.active,origin:x.a.lease.payload.origin,environment:x.a.lease.payload.environment})),
  formalRowsRead:0,newSearches:0,strengthScoresComputed:false,publicAdopted:false};
 if(shards.length===32&&shards.every(x=>x.a.ledger.status==='COMPLETE')){report.aggregate=await W.aggregate(shards.map(x=>x.dir),p,api);report.strengthScoresComputed=true;}
 fs.writeFileSync(path.join(base,'audit.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({auditedShards:report.auditedShards,completedPairs:report.completedPairs,allSealed:shards.every(x=>x.a.ledger.status==='COMPLETE'),strengthScoresComputed:report.strengthScoresComputed}));return report;
}
audit(process.argv[2]).catch(e=>{console.error(e.message);process.exitCode=1;});
