'use strict';
// MIT. Read-only audit of the 26 completed proof jobs; no new games or search.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const S=require('./study.cjs'),C=require('../v010-balance/core.cjs');
const root=path.join(__dirname,'../../doc/v010-followup/proof-checkpoint');
const receipt=JSON.parse(fs.readFileSync(path.join(root,'receipt.json'))),m=S.manifest();
assert.equal(receipt.manifestDigest,m.digest);assert.equal(receipt.verifiedProofJobs,26);
const archive=path.join(root,receipt.archive.name),bytes=fs.readFileSync(archive);
assert.equal(bytes.length,receipt.archive.sizeBytes);assert.equal(C.hash(bytes),receipt.archive.sha256);
const python=`import sys,json,zipfile,hashlib,gzip,io
with zipfile.ZipFile(sys.argv[1]) as outer:
 out=[]
 for name in outer.namelist():
  b=outer.read(name)
  with zipfile.ZipFile(io.BytesIO(b)) as inner:
   files=[n for n in inner.namelist() if n.startswith("proof-") and n.endswith(".json.gz")]
   assert len(files)==1
   row=json.loads(gzip.decompress(inner.read(files[0])))
  out.append({"name":name,"bytes":len(b),"sha256":hashlib.sha256(b).hexdigest(),"row":row})
 print(json.dumps(out))`;
const unpacked=JSON.parse(cp.execFileSync('python3',['-c',python,archive],{maxBuffer:32*1024*1024}));
assert.equal(unpacked.length,26);assert.equal(receipt.artifacts.length,26);const by=new Map(),seen=new Set();
for(const item of unpacked){const a=receipt.artifacts.find(a=>a.name+'.zip'===item.name);assert.ok(a);
 assert.equal(item.bytes,a.sizeBytes);assert.equal('sha256:'+item.sha256,a.digest);
 const r=item.row;S.auditProof(r,r.index,r.target,m);const key=r.index+'-'+r.target;assert.ok(!seen.has(key));seen.add(key);by.set(key,r.result);}
const proofs=[];
for(let i=0;i<m.proofRoots.length;i++){const targets=[];
 for(const target of [0,1]){const v=by.get(i+'-'+target);assert.ok(v);targets.push({target,status:v.status,winner:v.winner,depth:v.certificate?.depth??null,nodes:v.certificate?Object.keys(v.certificate.nodes).length:0,visits:v.visits,bookUses:v.bookUses,completedDepth:Math.max(0,...v.attempts.filter(a=>a.status==='UNKNOWN'||a.status==='PROVED').map(a=>a.depth))});}
 const winners=targets.filter(t=>t.winner!==null);if(winners.length>1)assert.equal(winners[0].winner,winners[1].winner);
 proofs.push({root:m.proofRoots[i].id,targets});}
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'proof-progress.json'))),{manifestDigest:m.digest,proofs,status:'PROOF-ONLY-AUDITED; MATRIX-IN-PROGRESS'});
console.log(JSON.stringify({verifiedProofJobs:26,newGames:0,newSearches:0,initial:'UNKNOWN',proved:proofs.filter(r=>r.targets.some(t=>t.winner!==null))}));
