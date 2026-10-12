'use strict';
// MIT. Study 003: staged backwards proofs with collected immutable proof nodes.
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),assert=require('node:assert/strict');
const C=require('../v010-balance/core.cjs'),I=require('./inputs.cjs'),P=require('./prover.cjs'),V=require('../v010-balance/diagnostics/proof.cjs');
const S2=require('../v010-certainty/study.cjs');
const SOURCES=['tools/v010-gc/store.cjs','tools/v010-gc/inputs.cjs','tools/v010-gc/prover.cjs','tools/v010-gc/study.cjs','tools/v010-gc/freeze.cjs','tools/v010-gc/check.test.cjs',
 'tools/v010-gc/inputs/study002-records.zip','tools/v010-certainty/manifest.json','.github/workflows/v010-gc-study.yml'];
const fingerprint=()=>({...S2.fingerprint(),...Object.fromEntries(SOURCES.map(p=>[p,C.hash(fs.readFileSync(path.join(C.root,p)))]))});
function manifest(){const m=JSON.parse(fs.readFileSync(path.join(__dirname,'manifest.json'))),{digest,...body}=m;assert.equal(digest,C.hash(body));
 assert.deepEqual(m.sources,fingerprint());assert.deepEqual(m.roots,I.roots());assert.equal(m.contract.id,'NAKAKAMADO-V010-PROOF-GC-STUDY-003');return m;}
function write(file,row){fs.writeFileSync(file+'.tmp',z.gzipSync(JSON.stringify(row),{level:9}),{flag:'wx'});fs.renameSync(file+'.tmp',file);}
const read=file=>JSON.parse(z.gunzipSync(fs.readFileSync(file)));
function audit(row,index,target,m){const r=row.result,root=m.roots[index];assert.equal(row.digest,m.digest);assert.equal(row.index,index);assert.equal(row.target,target);
 assert.equal(row.rootId,root.id);assert.equal(row.checksum,C.hash(r));assert.equal(r.target,target);assert.ok(r.visits<=m.contract.maxNodes);
 if(['PROVED','OPPONENT-PROVED'].includes(r.status)){assert.ok(r.certificate);V.verify(r.certificate);assert.deepEqual(r.certificate.start,root.state);
  assert.equal(r.winner,r.certificate.target);assert.equal(r.status==='PROVED',r.winner===target);assert.equal(r.certificate.depth,r.certificate.nodes[r.certificate.root].depth);
  assert.ok(r.certificate.depth<=(root.scope==='after-two'?m.contract.maxDepth-2:m.contract.maxDepth));}
 else{assert.ok(['UNKNOWN','NODE_BUDGET','WALL_BUDGET','MEMORY_BUDGET','STORAGE_BUDGET'].includes(r.status));assert.equal(r.certificate,null);assert.equal(r.winner,null);}}
function dependencyIndices(index){return index<14?[14,15,16]:index===14?[]:index===15?[14]:[14,15];}
function dependencyInputs(dir,index,m){const receipt=[],certificates=[];
 for(const i of dependencyIndices(index))for(const target of [0,1]){
  if(!dir)throw Error('Missing earlier phase records');const file=path.join(dir,`proof-${i}-${target}.json.gz`),row=read(file);audit(row,i,target,m);
  receipt.push({index:i,target,sha256:C.hash(fs.readFileSync(file))});if(row.result.certificate)certificates.push(row.result.certificate);}
 return {receipt,certificates};}
function job(out,index,target,extraDir=null,m=manifest()){
 assert.ok(Number.isInteger(index)&&index>=0&&index<m.roots.length);assert.ok(target===0||target===1);fs.mkdirSync(out,{recursive:true});
 const file=path.join(out,`proof-${index}-${target}.json.gz`),root=m.roots[index];
 if(fs.existsSync(file)){const row=read(file);audit(row,index,target,m);assert.deepEqual(row.dependencies,dependencyInputs(extraDir,index,m).receipt);return {index,target,reused:true,newSearches:0,status:row.result.status};}
 if(fs.existsSync(file+'.started'))throw Error('HOLD interrupted proof job');fs.writeFileSync(file+'.started',JSON.stringify({index,target,digest:m.digest}),{flag:'wx'});
 const dependencies=dependencyInputs(extraDir,index,m),input=I.prepare(dependencies.certificates),result=P.prove(root.state,target,{...m.contract,maxDepth:root.scope==='after-two'?m.contract.maxDepth-2:m.contract.maxDepth,book:input.book,guidance:input.guidance,
  onAttempt:a=>{fs.writeFileSync(path.join(out,`attempt-${index}-${target}-${a.depth}.json`),JSON.stringify({index,target,digest:m.digest,attempt:a}),{flag:'wx'});console.log(JSON.stringify({root:root.id,target,...a}));}});
 const row={digest:m.digest,index,target,rootId:root.id,result,checksum:C.hash(result),pinnedInput:{oldGames:input.oldGames,verifiedStates:input.verifiedStates},dependencies:dependencies.receipt};
 audit(row,index,target,m);write(file,row);return {index,target,reused:false,newSearches:1,status:result.status,winner:result.winner,depth:result.certificate?.depth??null,visits:result.visits};
}
function aggregate(out,m=manifest()){
 const certificates=new Map(),results=[];
 for(let i=0;i<m.roots.length;i++){const rows=[0,1].map(t=>{const row=read(path.join(out,`proof-${i}-${t}.json.gz`));audit(row,i,t,m);return row;});
  for(const row of rows)assert.deepEqual(row.dependencies,dependencyInputs(out,i,m).receipt);
  const cs=rows.map(r=>r.result.certificate).filter(Boolean);if(cs.length>1)assert.equal(cs[0].target,cs[1].target);if(cs.length)certificates.set(m.roots[i].id,cs[0]);
  results.push({rootId:m.roots[i].id,scope:m.roots[i].scope,winner:cs[0]?.target??null,targets:rows.map(row=>{const r=row.result;return {target:r.target,status:r.status,winner:r.winner,depth:r.certificate?.depth??null,proofNodes:r.certificate?Object.keys(r.certificate.nodes).length:0,visits:r.visits,cacheHits:r.cacheHits,bookUses:r.bookUses,gc:r.gc,completedDepth:Math.max(0,...r.attempts.filter(a=>a.status==='UNKNOWN'||a.status==='PROVED').map(a=>a.depth))};})});}
 const initial=C.E.initialState(),first=C.Q.moveVariants(initial),firstResults=[];
 for(let i=0;i<first.length;i++){
  const b=C.Q.applyMove(initial,first[i]).state,replies=C.Q.moveVariants(b),cs=replies.map((_,j)=>certificates.get(`opening-${i}-${j}`));let cert=null;
  const n=cs.findIndex(c=>c?.target===1);
  if(n>=0)cert=P.attach(b,[replies[n]],[cs[n]],1);
  else if(cs.every(c=>c?.target===0))cert=P.attach(b,replies,cs,0);
  if(cert){assert.ok(cert.depth<=m.contract.maxDepth-1);write(path.join(out,`after-first-${i}-certificate.json.gz`),cert);}
  firstResults.push({index:i,move:first[i],winner:cert?.target??null,depth:cert?.depth??null,certificate:cert});
 }
 let initialCert=null;const s=firstResults.find(r=>r.winner===0);
 if(s)initialCert=P.attach(initial,[s.move],[s.certificate],0);
 else if(firstResults.every(r=>r.winner===1))initialCert=P.attach(initial,first,firstResults.map(r=>r.certificate),1);
 if(initialCert){assert.ok(initialCert.depth<=m.contract.maxDepth);write(path.join(out,'initial-certificate.json.gz'),initialCert);}
 const summary={status:'AUDITED-COMPLETE',digest:m.digest,proofJobs:m.roots.length*2,games:0,newGames:0,initial:{status:initialCert?'PROVED':'UNKNOWN',winner:initialCert?.target??null,depth:initialCert?.depth??null},
  firstMoves:firstResults.map(({certificate,...r})=>r),results,interpretation:'UNKNOWN and budget stops do not prove fairness, draw, or absence of a winning strategy'};
 fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');return summary;
}
if(require.main===module){const [cmd,out,a,b]=process.argv.slice(2);if(cmd==='manifest'){const m=manifest();console.log(JSON.stringify({digest:m.digest,roots:m.roots.length,jobs:m.roots.length*2}));}
 else if(cmd==='job')console.log(JSON.stringify(job(out,Number(a),Number(b),process.argv[6]||null)));else if(cmd==='aggregate')console.log(JSON.stringify(aggregate(out)));else throw Error('manifest|job|aggregate');}
module.exports={fingerprint,manifest,job,aggregate,audit,read,dependencyIndices,dependencyInputs};
