'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),z=require('node:zlib'),os=require('node:os'),path=require('node:path');
const C=require('../v010-balance/core.cjs'),V=require('../v010-balance/diagnostics/proof.cjs'),I=require('./inputs.cjs'),P=require('./prover.cjs'),S=require('./study.cjs'),{ProofStore}=require('./store.cjs');
const normal=(b,target,d)=>{if(C.Q.outcome(b)==='safety-stop')return false;if(b.winner!==null)return b.winner===target;if(!d)return false;
 const a=C.S.moveVariants({board:b,history:[]}).map(m=>normal(C.S.apply({board:b,history:[]},m).board,target,d-1));return b.player===target?a.some(Boolean):a.every(Boolean);};
test('collector keeps cache/active closures and removes only unreachable nodes',()=>{
 const st=new ProofStore(10);st.nodes.set('a',{children:[]});st.nodes.set('b',{children:[{to:'a'}]});st.nodes.set('c',{children:[{to:'b'}]});st.nodes.set('unused',{children:[]});
 st.positive.set('unused',{id:'unused'});const frame=st.pin([{to:'c'}]);st.collect(0);assert.deepEqual([...st.nodes.keys()].sort(),['a','b','c']);
 st.unpin(frame);st.collect(0);assert.equal(st.nodes.size,0);assert.equal(st.stats.removedNodes,4);
});
test('all 38 prior results are checked; book extends to verified 23/25 positions only',()=>{
 assert.equal(I.load().length,38);const input=I.prepare();assert.equal(input.oldGames,420);assert.equal(input.verifiedStates,27169);
 assert.ok(!input.book.has(C.Q.stateKey(C.E.initialState())));assert.equal(I.roots().length,17);
 assert.deepEqual(I.roots().slice(14).map(r=>r.ply),[21,19,17]);
});
test('forced collection agrees with independent exhaustive normal transitions',()=>{
 const game=require('../v010-certainty/inputs.cjs').load().find(r=>r.games).games[0];let b=game.start;const states=[C.E.initialState(),I.roots()[0].state];
 for(const [i,t]of game.turns.entries()){if(i>=game.turns.length-5)states.push(b);b=C.S.apply({board:b,history:[]},t.move).board;}
 for(const b of states)for(const target of [0,1])for(const maxDepth of [1,2,3,4,5]){
  const r=P.prove(b,target,{maxDepth,maxNodes:200000,collectAt:2,collectTarget:0,maxCache:2});assert.equal(r.status==='PROVED',normal(b,target,maxDepth));if(r.certificate)V.verify(r.certificate);}
});
test('many collections keep every defended branch of a fresh normal winning certificate',()=>{
 const c=JSON.parse(z.gunzipSync(fs.readFileSync(path.join(C.root,'doc/v010-balance/diagnostics/primary-8192-ply29.json.gz'))));
 const r=P.prove(c.start,1,{maxDepth:10,maxNodes:100000,collectAt:5,collectTarget:0,maxCache:3});assert.equal(r.status,'PROVED');assert.ok(r.gc.collections>0);assert.ok(r.gc.removedNodes>0);V.verify(r.certificate);
 const bad=JSON.parse(JSON.stringify(r.certificate));bad.nodes[bad.root].children.pop();assert.throws(()=>V.verify(bad));
});
test('certified book cuts and capacity stops preserve winner and source state',()=>{
 const c=I.load().find(r=>r.index===17&&r.target===1).result.certificate;
 for(const t of [0,1]){const r=P.prove(c.start,t,{book:I.prepare().book,maxDepth:20});assert.equal(r.winner,1);V.verify(r.certificate);}
 const b=C.E.initialState(),r=P.prove(b,0,{maxNodes:1});assert.equal(r.status,'NODE_BUDGET');assert.equal(r.winner,null);
 let n=0;const w=P.prove(b,0,{wallMs:1,now:()=>n++});assert.equal(w.status,'WALL_BUDGET');
 const h=P.prove(b,0,{maxHeapBytes:1,heap:()=>2});assert.equal(h.status,'MEMORY_BUDGET');assert.equal(h.certificate,null);
});
test('stages require complete earlier records; reuse is zero search; interrupted inputs HOLD',()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'proof-gc-test-')),m={digest:'development-only',roots:I.roots(),contract:{maxDepth:2,maxNodes:1,wallMs:1000,maxCache:100,maxStoredNodes:1000,collectAt:800,collectTarget:600,maxHeapBytes:1610612736}};
 assert.throws(()=>S.job(out,15,0,null,m),/Missing earlier/);fs.unlinkSync(path.join(out,'proof-15-0.json.gz.started'));
 for(const i of [14,15,16,...Array.from({length:14},(_,i)=>i)])for(const t of [0,1]){S.job(out,i,t,out,m);assert.equal(S.job(out,i,t,out,m).newSearches,0);}
 const r=S.aggregate(out,m);assert.equal(r.proofJobs,34);assert.equal(r.initial.status,'UNKNOWN');
 const file=path.join(out,'proof-14-0.json.gz'),bytes=fs.readFileSync(file),row=S.read(file);row.result.status='PROVED';row.result.winner=0;row.checksum=C.hash(row.result);assert.throws(()=>S.audit(row,14,0,m));
 fs.unlinkSync(file);assert.throws(()=>S.job(out,14,0,out,m),/HOLD/);assert.throws(()=>S.job(out,15,0,out,m));fs.writeFileSync(file,bytes);
 fs.rmSync(out,{recursive:true});
});
