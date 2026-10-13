'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../v010-balance/core.cjs'),V=require('../v010-balance/diagnostics/proof.cjs'),P=require('./prover.cjs'),I=require('./inputs.cjs');
function normal(b,t,d){if(C.Q.outcome(b)==='safety-stop')return false;if(b.winner!==null)return b.winner===t;if(d===0)return false;const a=C.S.moveVariants({board:b,history:[]}).map(m=>normal(C.S.apply({board:b,history:[]},m).board,t,d-1));return b.player===t?a.some(Boolean):a.every(Boolean);}
test('fixed-horizon df-pn agrees with independent exhaustive normal engine, both winners and all depths',()=>{
 const g=require('../v010-certainty/inputs.cjs').load().find(r=>r.games).games[0],states=[C.E.initialState()];let b=g.start;
 for(const [i,tr]of g.turns.entries()){if(i>=g.turns.length-7)states.push(b);b=C.S.apply({board:b,history:[]},tr.move).board;}states.push(b);
 for(const state of states)for(let d=0;d<=5;d++)for(const t of [0,1]){const r=P.prove(state,t,{maxDepth:d,maxNodes:1000000,wallMs:60000});assert.equal(r.status,normal(state,t,d)?'PROVED':'UNKNOWN');assert.equal(r.winner,r.certificate?t:null);if(r.certificate){V.verify(r.certificate);assert.ok(r.certificate.depth<=d);}else assert.equal(r.finiteHorizonRefuted,true);}
});
test('pinned 005 records, 19 responses, 17 unknowns, seven parent wins and two immediate wins remain verified',()=>{
 assert.equal(I.load().rows.length,52);assert.equal(I.allReplies().length,19);assert.equal(I.roots().length,17);assert.equal(I.knownBranches().length,7);assert.equal(I.knownReplies().length,2);
 for(const p of I.parents()){const roots=I.allReplies().filter(r=>r.parentId===p.id);assert.deepEqual(roots.map(r=>r.move),C.S.moveVariants({board:p.state,history:[]}));for(const r of roots)assert.deepEqual(r.state,C.S.apply({board:p.state,history:[]},r.move).board);}
 const input=I.prepare();for(const r of I.knownReplies())for(const t of [0,1]){const x=P.prove(r.state,t,{...input,maxDepth:78,maxNodes:1});assert.equal(x.status,t===0?'PROVED':'OPPONENT-PROVED');assert.equal(x.visits,0);assert.equal(x.certificate.depth,1);V.verify(x.certificate);}
 for(const k of I.knownBranches()){const x=P.prove(k.certificate.start,1,{...input,maxDepth:80,maxNodes:1});assert.equal(x.status,'PROVED');assert.equal(x.visits,0);V.verify(x.certificate);}
});
test('depth boundary is not another winner; known long wins cannot bypass a shallow horizon',()=>{
 const r=I.knownBranches().find(k=>k.index===2),input=I.prepare();for(const t of [0,1]){const x=P.prove(r.certificate.start,t,{...input,maxDepth:0,maxNodes:100});assert.equal(x.status,'UNKNOWN');assert.equal(x.winner,null);assert.equal(x.certificate,null);}
 const b={...C.E.initialState(),reason:'relay-limit',winner:0};assert.equal(C.Q.outcome(b),'safety-stop');for(const t of [0,1]){const x=P.prove(b,t,{maxDepth:5});assert.equal(x.winner,null);assert.equal(x.certificate,null);assert.equal(x.status,'UNKNOWN');}
});
test('node, wall, table, proof storage and heap stops return UNKNOWN without certificates',()=>{
 const b=C.E.initialState();for(const [budget,expected]of [[{maxNodes:1},'NODE_BUDGET'],[{wallMs:0},'WALL_BUDGET'],[{maxTableEntries:1},'TABLE_BUDGET'],[{heap:()=>100,maxHeapBytes:1},'MEMORY_BUDGET']]){const r=P.prove(b,1,{maxDepth:6,...budget});assert.equal(r.status,expected);assert.equal(r.winner,null);assert.equal(r.certificate,null);}
 const terminal={...I.knownReplies()[0].state};const cert=V.certify(terminal,0,1,100);assert.equal(cert.status,'PROVED');const r=P.prove(terminal,0,{maxDepth:1,maxStoredNodes:0});assert.equal(r.status,'STORAGE_BUDGET');assert.equal(r.winner,null);
});
test('normal verifier rejects missing defender response, illegal move and modified terminal winner',()=>{
 const c=I.knownBranches().find(k=>k.index===2).certificate,bad=structuredClone(c);const n=Object.values(bad.nodes).find(n=>n.kind==='all'&&n.children.length>1);assert.ok(n);n.children.pop();assert.throws(()=>V.verify(bad));
 const bad2=structuredClone(c);bad2.nodes[bad2.root].children[0].move={type:'illegal',pit:-100};assert.throws(()=>V.verify(bad2));const bad3=structuredClone(c);bad3.target=0;assert.throws(()=>V.verify(bad3));
});
test('horizon schedule respects cumulative budget, keeps known opposite certificates and continues after shallow refutation',()=>{
 const Schedule=require('./schedule.cjs'),state=I.knownReplies()[0].state;
 const r=Schedule.prove(state,0,{horizons:[{depth:0,maxNodes:100},{depth:1,maxNodes:100}],maxNodes:200,wallMs:10000});assert.equal(r.status,'PROVED');assert.equal(r.attempts.length,2);assert.equal(r.attempts[0].status,'UNKNOWN');assert.equal(r.certificate.depth,1);V.verify(r.certificate);
 const unknown=Schedule.prove(C.E.initialState(),0,{maxNodes:7,wallMs:10000});assert.equal(unknown.visits,7);assert.equal(unknown.winner,null);
 const input=I.prepare(),opponent=Schedule.prove(state,1,{...input});assert.equal(opponent.status,'OPPONENT-PROVED');assert.equal(opponent.visits,0);V.verify(opponent.certificate);
});

test('all seventeen unresolved roots match normal exhaustive values at depths zero through three',()=>{
 I.load006();for(const r of I.roots())for(const depth of [0,1,2,3])for(const target of [0,1]){const value=normal(r.state,target,depth),result=P.prove(r.state,target,{maxDepth:depth,maxNodes:1000000,wallMs:30000});assert.equal(result.status,value?'PROVED':'UNKNOWN');if(result.certificate)V.verify(result.certificate);else assert.equal(result.finiteHorizonRefuted,true);}
});
