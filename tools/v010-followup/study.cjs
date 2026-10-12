'use strict';
// MIT. Prospective opening/policy matrix and bounded proof jobs, sealed records.
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),assert=require('node:assert/strict');
const K=require('./core.cjs'),{C,P}=K,R=require('./registry.cjs'),B=require('./book.cjs'),F=require('./prover.cjs');
const V=require('../v010-balance/diagnostics/proof.cjs');
function manifest(){const m=JSON.parse(fs.readFileSync(path.join(__dirname,'manifest.json')));
 assert.equal(m.contract.id,'NAKAKAMADO-V010-OPENING-PROOF-STUDY-001');assert.deepEqual(m.sourceSha256,K.fingerprint());
 assert.equal(m.digest,C.hash({contract:m.contract,sourceSha256:m.sourceSha256,openings:m.openings,proofRoots:m.proofRoots}));
 assert.deepEqual(m.openings,R.openings());assert.deepEqual(m.proofRoots,R.roots());return m;}
function tasks(m){const a=[];for(const opening of m.openings)for(const pair of K.PAIRS)for(let i=0;i<m.contract.seedBlocks;i++){
 const profiles=pair.map(n=>P.POLICIES[n]),seed=Number.parseInt(C.hash([m.contract.seedDomain,opening.id,i]).slice(0,8),16);
 a.push({id:`${opening.id}-${pair.join('-')}-${i}`,opening,profiles,seed,seedIndex:i});}return a;}
function write(file,row){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',z.gzipSync(JSON.stringify(row),{level:9}),{flag:'wx'});fs.renameSync(file+'.tmp',file);}
function read(file){return JSON.parse(z.gunzipSync(fs.readFileSync(file)));}
function auditPair(row,t,m){assert.equal(row.digest,m.digest);assert.equal(row.id,t.id);assert.equal(row.seed,t.seed);assert.equal(row.checksum,C.hash(row.games));
 assert.equal(row.games.length,2);for(const [side,g]of row.games.entries()){assert.equal(g.firstPlayer,side);assert.equal(g.seed,t.seed);K.audit(g,t.opening,t.profiles,m.contract.maxPlies);}
 assert.equal(row.games[0].trajectory,row.games[1].trajectory);assert.equal(row.games[0].firstWin,row.games[1].firstWin);
 assert.deepEqual(row.games[1].final,C.mirror(row.games[0].final));}
function matrix(out,shard,m=manifest()){assert.ok(Number.isInteger(shard)&&shard>=0&&shard<m.contract.matrixShards);
 const rows=tasks(m).filter((_,i)=>i%m.contract.matrixShards===shard);fs.mkdirSync(out,{recursive:true});let newPairs=0,reusedPairs=0;
 for(const t of rows){const file=path.join(out,t.id+'.json.gz');let row;
  if(fs.existsSync(file)){row=read(file);auditPair(row,t,m);reusedPairs++;}
  else{if(fs.existsSync(file+'.started'))throw Error('HOLD interrupted matrix pair '+t.id);
   fs.writeFileSync(file+'.started',JSON.stringify({id:t.id,digest:m.digest}),{flag:'wx'});
   const games=[0,1].map(side=>K.play(t.opening,t.profiles,t.seed,side,{maxPlies:m.contract.maxPlies}));
   row={id:t.id,digest:m.digest,seed:t.seed,profiles:t.profiles.map(p=>p.id),games,checksum:C.hash(games)};auditPair(row,t,m);write(file,row);newPairs++;}
  console.log(JSON.stringify({id:t.id,newPairs,reusedPairs}));}
 const receipt={shard,digest:m.digest,expectedPairs:rows.length,newPairs,reusedPairs,files:Object.fromEntries(rows.map(t=>[t.id+'.json.gz',C.hash(fs.readFileSync(path.join(out,t.id+'.json.gz')))]))};
 const rf=path.join(out,'matrix-receipt-'+shard+'.json');fs.writeFileSync(rf,JSON.stringify(receipt,null,2)+'\n');return receipt;}
function auditProof(row,index,target,m){
 const root=m.proofRoots[index],r=row.result;
 assert.equal(row.digest,m.digest);assert.equal(row.index,index);assert.equal(row.target,target);assert.equal(row.rootId,root.id);
 assert.equal(row.checksum,C.hash(r));assert.equal(r.target,target);assert.ok(r.visits<=m.contract.proofNodes);
 if(['PROVED','OPPONENT-PROVED'].includes(r.status)){
  assert.ok(r.certificate);V.verify(r.certificate);assert.deepEqual(r.certificate.start,root.state);assert.equal(r.winner,r.certificate.target);
  assert.ok(r.certificate.depth<=(root.scope==='after-first'?m.contract.proofDepth-1:m.contract.proofDepth));
  assert.equal(r.status==='PROVED',r.winner===target);
 }else{
  assert.ok(['UNKNOWN','NODE_BUDGET','WALL_BUDGET'].includes(r.status));assert.equal(r.certificate,null);assert.equal(r.winner,null);
 }
}
function proof(out,index,target,m=manifest()){
 assert.ok(Number.isInteger(index)&&index>=0&&index<m.proofRoots.length);assert.ok(target===0||target===1);
 fs.mkdirSync(out,{recursive:true});const root=m.proofRoots[index],file=path.join(out,`proof-${index}-${target}.json.gz`);
 const audit=row=>auditProof(row,index,target,m);
 if(fs.existsSync(file)){const row=read(file);audit(row);return {index,target,reused:true,status:row.result.status};}
 if(fs.existsSync(file+'.started'))throw Error('HOLD interrupted proof job');fs.writeFileSync(file+'.started',JSON.stringify({index,target,digest:m.digest}),{flag:'wx'});
 const result=F.prove(root.state,target,{maxDepth:root.scope==='after-first'?m.contract.proofDepth-1:m.contract.proofDepth,
  maxNodes:m.contract.proofNodes,wallMs:m.contract.proofWallMs,guidance:B.guidance(),book:B.proofBook(),
  onAttempt:a=>{const name=path.join(out,`proof-attempt-${index}-${target}-${a.depth}.json`);
    fs.writeFileSync(name,JSON.stringify({index,target,digest:m.digest,attempt:a}));console.log(JSON.stringify({root:root.id,target,...a}));}});
 const row={digest:m.digest,index,target,rootId:root.id,result,checksum:C.hash(result)};audit(row);write(file,row);
 return {index,target,reused:false,status:result.status,winner:result.winner,visits:result.visits,depth:result.certificate?.depth??null};}
function aggregate(out,m=manifest()){
 const all=tasks(m),cells=[];let pairs=0,depthZero=0,searchTurns=0;
 for(let s=0;s<m.contract.matrixShards;s++){const receipt=JSON.parse(fs.readFileSync(path.join(out,'matrix-receipt-'+s+'.json')));assert.equal(receipt.digest,m.digest);
   const expected=all.filter((_,i)=>i%m.contract.matrixShards===s);assert.equal(receipt.expectedPairs,expected.length);assert.equal(Object.keys(receipt.files).length,expected.length);
   for(const t of expected)assert.equal(receipt.files[t.id+'.json.gz'],C.hash(fs.readFileSync(path.join(out,t.id+'.json.gz'))));}
 for(const opening of m.openings)for(const p of K.PAIRS){const profiles=p.map(i=>P.POLICIES[i]),rows=all.filter(t=>t.opening.id===opening.id&&t.profiles[0].id===profiles[0].id&&t.profiles[1].id===profiles[1].id);
   const scores=[],trajectories=new Set();let firstWins=0,secondWins=0,unresolved=0,turns=0,zeros=0,searched=0;
   for(const t of rows){const row=read(path.join(out,t.id+'.json.gz'));auditPair(row,t,m);pairs++;
     let lo=0,hi=0;for(const g of row.games){trajectories.add(g.trajectory);
       if(g.firstWin===null){unresolved++;hi++;}else if(g.firstWin){firstWins++;lo++;hi++;}else secondWins++;
       for(const tr of g.turns){turns++;if(tr.stats){searched++;zeros+=Number(tr.stats.completedDepth===0);}}}
     scores.push({seedIndex:t.seedIndex,lower:lo/2,upper:hi/2});}
   searchTurns+=searched;depthZero+=zeros;
   cells.push({openingId:opening.id,forced:opening.forced,first:profiles[0].id,second:profiles[1].id,seedPairs:rows.length,games:rows.length*2,
     firstWins,secondWins,unresolved,scores,uniqueTrajectories:trajectories.size,turns,searchTurns:searched,depthZero:zeros,
     interpretationHold:searched>0&&zeros/searched>.01});}
 const proofs=[];for(let i=0;i<m.proofRoots.length;i++)for(const target of [0,1]){const row=read(path.join(out,`proof-${i}-${target}.json.gz`));
   auditProof(row,i,target,m);
   proofs.push({rootId:m.proofRoots[i].id,index:i,target,status:row.result.status,winner:row.result.winner,
     depth:row.result.certificate?.depth??null,proofNodes:row.result.certificate?Object.keys(row.result.certificate.nodes).length:0,
     visits:row.result.visits,bookUses:row.result.bookUses,opponentCuts:row.result.opponentCuts,attempts:row.result.attempts});}
 const first=C.Q.moveVariants(C.E.initialState()),certificates=[];
 for(let i=0;i<first.length;i++){
   const rootIndex=m.proofRoots.findIndex(r=>r.id==='after-first-'+i),rows=[0,1].map(t=>read(path.join(out,`proof-${rootIndex}-${t}.json.gz`)));
   const certs=rows.map(r=>r.result.certificate).filter(Boolean);
   if(certs.length>1)assert.equal(certs[0].target,certs[1].target);certificates.push(certs[0]||null);}
 const firstWin=F.combineInitial(first,certificates,0),secondWin=F.combineInitial(first,certificates,1);
 assert.ok(!(firstWin&&secondWin));const composed=firstWin||secondWin;
 if(composed)write(path.join(out,'initial-composed-certificate.json.gz'),composed);
 const direct=proofs.filter(r=>r.rootId==='initial'&&r.winner!==null);if(composed)for(const r of direct)assert.equal(r.winner,composed.target);
 const initialWinner=composed?.target??direct[0]?.winner??null;if(direct.length>1)assert.equal(direct[0].winner,direct[1].winner);
 const result={status:'AUDITED-COMPLETE',manifestDigest:m.digest,pairs,games:pairs*2,matrix:cells,proofs,
  initialPosition:{status:initialWinner===null?'UNKNOWN':'PROVED',winner:initialWinner,composed:Boolean(composed),certificateDepth:composed?.depth??direct[0]?.depth??null},
  technicalFailures:0,searchTurns,depthZero,confidenceIntervalsApplied:false,
  interpretation:'forced opening and policy cells are separate; UNKNOWN is not draw or absence of a winning strategy'};
 fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(result,null,2)+'\n');return result;}
if(require.main===module){const [cmd,out,a,b]=process.argv.slice(2);
 if(cmd==='manifest'){const m=manifest();console.log(JSON.stringify({digest:m.digest,matrixPairs:tasks(m).length,matrixGames:tasks(m).length*2,proofRoots:m.proofRoots.length}));}
 else if(cmd==='matrix')console.log(JSON.stringify(matrix(out,Number(a))));
 else if(cmd==='proof')console.log(JSON.stringify(proof(out,Number(a),Number(b))));
 else if(cmd==='aggregate')console.log(JSON.stringify(aggregate(out)));else throw Error('manifest|matrix|proof|aggregate required');}
module.exports={manifest,tasks,matrix,proof,aggregate,auditPair,auditProof,read};
