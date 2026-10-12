'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const K=require('./core.cjs'),{C,P}=K,R=require('./registry.cjs'),B=require('./book.cjs'),F=require('./prover.cjs'),T=require('./study.cjs');
const V=require('../v010-balance/diagnostics/proof.cjs');
const normalize=x=>JSON.parse(JSON.stringify(x));
function oracle(b,depth,evalFn,q=1){const p=b.player,WIN=1000000;
 const terminal=(b,n)=>C.Q.outcome(b)==='safety-stop'?0:b.winner===null?null:b.winner===p?WIN-n:-WIN+n;
 const moves=b=>C.S.moveVariants({board:b,history:[]}),next=(b,m)=>C.S.apply({board:b,history:[]},m).board;
 function quiet(b,n,left){const t=terminal(b,n);if(t!==null)return t;if(!left)return evalFn(b,p);
  const ms=moves(b).filter(m=>m.type==='capture');if(!ms.length)return evalFn(b,p);const a=ms.map(m=>quiet(next(b,m),n+1,left-1));return b.player===p?Math.max(...a):Math.min(...a);}
 function visit(b,d,n){const t=terminal(b,n);if(t!==null)return t;if(!d)return quiet(b,n,q);const ms=moves(b);const a=ms.map(m=>visit(next(b,m),d-1,n+1));return b.player===p?Math.max(...a):Math.min(...a);}
 return Object.fromEntries(moves(b).map(m=>[C.Public.moveKey(m),visit(next(b,m),depth-1,1)]));}
test('complete legal opening registry, two replies after 7-left and reachable proof roots',()=>{
 const a=R.openings();assert.equal(a.length,15);assert.equal(new Set(a.map(x=>x.startKey)).size,15);
 assert.deepEqual([0,1,2,3].map(i=>a.filter(x=>x.firstIndex===i).length),[4,4,2,4]);
 for(const root of R.roots()){let b=C.E.initialState();for(const m of root.path)b=C.S.apply({board:b,history:[]},m).board;assert.deepEqual(b,root.state);}assert.equal(R.roots().length,13);
});
test('base wrapper preserves the frozen candidate choice, values and nodes',()=>{
 const native=C.Research.createAI(C.Q,{now:()=>0}),policy=P.createPolicy(P.POLICIES[0]);
 for(const b of [C.E.initialState(),C.e30()])for(const depth of [1,2,3]){
  const r=policy.analyzeMove(b,31,{maxDepth:depth}),old=native.analyzeMove(b,{maxDepth:depth,maxNodes:8192,exactRoot:true,tieSeed:31,timeLimitMs:60000,quiescenceDepth:1});
  assert.deepEqual(r.move,old.move);for(const key of ['nodes','completedDepth','rootScore','exactRootScores'])assert.deepEqual(r.stats[key],old.stats[key]);}
});
test('alternate evaluator is integer/antisymmetric/mirrored and both evaluators match exhaustive root values',()=>{
 for(const profile of [P.POLICIES[0],P.POLICIES[2]]){const a=P.createPolicy(profile);
  for(const b of [C.E.initialState(),C.e30()]){
   assert.ok(Number.isSafeInteger(a.evaluate(b,0)));assert.equal(a.evaluate(b,0)+a.evaluate(b,1),0);assert.equal(a.evaluate(b,0),a.evaluate(C.mirror(b),1));
   for(const depth of [1,2]){const r=a.analyzeMove(b,9,{maxDepth:depth});assert.equal(r.stats.completedDepth,depth);
     assert.deepEqual(Object.fromEntries(r.stats.exactRootScores.map(x=>[C.Public.moveKey(x.move),x.score])),oracle(b,depth,a.evaluate));}}
 }
});
test('verified book reuse and opponent counter-certificate preserve all defense responses',()=>{
 const b=R.roots().find(r=>r.id==='primary-8192-before-29').state,book=B.proofBook();
 for(const target of [0,1]){const r=F.prove(b,target,{book,maxDepth:40});assert.equal(r.winner,1);assert.equal(r.certificate.depth,10);assert.equal(r.status,target===1?'PROVED':'OPPONENT-PROVED');V.verify(r.certificate);}
 const fresh=F.prove(b,1,{maxDepth:10,maxNodes:10000,wallMs:30000,guidance:B.guidance()});assert.equal(fresh.status,'PROVED');assert.equal(fresh.winner,1);V.verify(fresh.certificate);
});
test('nodes and wall budgets remain unknown and unrelated proofs cannot become initial proofs',()=>{
 const r=F.prove(C.E.initialState(),0,{maxNodes:1,maxDepth:40,now:()=>0});assert.equal(r.status,'NODE_BUDGET');assert.equal(r.winner,null);assert.equal(r.certificate,null);
 let tick=0;const w=F.prove(C.E.initialState(),0,{wallMs:1,now:()=>tick++});assert.equal(w.status,'WALL_BUDGET');assert.equal(w.winner,null);
 const b=R.roots().find(r=>r.id==='primary-8192-before-29').state,c=F.prove(b,1,{book:B.proofBook()}).certificate;
 assert.throws(()=>F.combineInitial(C.Q.moveVariants(C.E.initialState()),[c,c,c,c],1),/matching initial/);
});
test('checkpoint matrix/proofs reuse without new games; missing certificates and modified rows fail',()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'v010-followup-test-'));
 const m={digest:'development-only',contract:{seedDomain:'test',seedBlocks:1,maxPlies:2,matrixShards:1,proofDepth:10,proofNodes:1,proofWallMs:1000},
  openings:[R.openings()[1]],proofRoots:R.roots()};
 assert.equal(T.matrix(out,0,m).newPairs,7);assert.equal(T.matrix(out,0,m).newPairs,0);
 for(let i=0;i<m.proofRoots.length;i++)for(const t of [0,1]){T.proof(out,i,t,m);assert.ok(T.proof(out,i,t,m).reused);}
 const r=T.aggregate(out,m);assert.equal(r.games,14);assert.equal(r.initialPosition.status,'UNKNOWN');assert.ok(r.matrix.every(c=>c.unresolved===2));
 const proofFile=path.join(out,'proof-0-0.json.gz'),row=T.read(proofFile);row.result.status='PROVED';row.result.winner=0;row.checksum=C.hash(row.result);
 assert.throws(()=>T.auditProof(row,0,0,m));
 const file=path.join(out,T.tasks(m)[0].id+'.json.gz'),bytes=fs.readFileSync(file),bad=T.read(file);bad.games[0].turns[0].move.index=0;
 bad.checksum=C.hash(bad.games);assert.throws(()=>T.auditPair(bad,T.tasks(m)[0],m));
 fs.unlinkSync(file);assert.throws(()=>T.matrix(out,0,m),/HOLD interrupted/);
 fs.rmSync(out,{recursive:true});
});

test('unused certificate data never becomes a winning book entry',()=>{
 const c=JSON.parse(require('node:zlib').gunzipSync(fs.readFileSync(path.join(C.root,'doc/v010-balance/diagnostics/primary-8192-ply29.json.gz'))));
 c.nodes.unreachable={kind:'terminal',depth:0,stateKey:C.Q.stateKey(C.E.initialState()),children:[]};
 const book=B.proofBook([c]);assert.ok(!book.has(C.Q.stateKey(C.E.initialState())));assert.ok(book.has(C.Q.stateKey(c.start)));
});
