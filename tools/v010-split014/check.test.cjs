'use strict';
// MIT. Verify the new quantifier layer, ordinary exhaustive values and safe reuse.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const C=require('../v010-balance/core.cjs'),I=require('./inputs.cjs'),S=require('./study.cjs'),V=require('../v010-balance/diagnostics/proof.cjs'),PN=require('../v010-pn007/prover.cjs'),A=require('../v010-branch/compose.cjs'),S4=require('../v010-branch/study.cjs');
function normal(b,t,d){if(C.Q.outcome(b)==='safety-stop')return false;if(b.winner!==null)return b.winner===t;if(d===0)return false;const values=C.S.moveVariants({board:b,history:[]}).map(m=>normal(C.S.apply({board:b,history:[]},m).board,t,d-1));return b.player===t?values.some(Boolean):values.every(Boolean);}
test('all 013 records and all five unresolved children retained; selected child has both legal replies',()=>{
 assert.equal(I.load().rows.length,16);assert.equal(I.pinnedChildren().length,3);assert.equal(I.unresolvedChildren().length,5);assert.equal(I.deferredChildren().length,4);assert.equal(I.heldRoots().length,18);assert.equal(I.parents().length,6);assert.equal(I.allReplies().length,33);assert.equal(I.splitParents().length,1);assert.equal(I.roots().length,2);assert.equal(I.initialRoots().length,14);
 const r=I.splitParents()[0],moves=C.S.moveVariants({board:r.state,history:[]});assert.equal(r.state.player,1);assert.deepEqual(I.roots().map(c=>c.move),moves);for(const c of I.roots()){assert.deepEqual(c.state,C.S.apply({board:r.state,history:[]},c.move).board);assert.equal(c.path.length,r.path.length+1);assert.equal(c.state.turn,17);}
 const inventory=JSON.parse(fs.readFileSync(path.join(C.root,'doc/v010-split014/inventory.json')));assert.deepEqual(inventory.rows.map(r=>r.onePly),[2,2,2,2,4]);assert.deepEqual(inventory.rows.map(r=>r.twoPly),[8,13,2,5,27]);assert.equal(inventory.onePlyTotal,12);assert.equal(inventory.twoPlyTotal,55);
});
test('new leaf and composed selected-child values agree with ordinary exhaustive search',()=>{
 for(const r of I.roots())for(const d of [0,1,2,3])for(const t of [0,1]){const x=PN.prove(r.state,t,{maxDepth:d,maxNodes:1000000,wallMs:30000});assert.equal(x.status,normal(r.state,t,d)?'PROVED':'UNKNOWN');if(x.certificate)V.verify(x.certificate);}
 for(const r of I.splitParents())for(const d of [1,2,3,4])for(const t of [0,1]){const cs=I.roots().map(c=>PN.prove(c.state,t,{maxDepth:d-1,maxNodes:1000000,wallMs:30000}).certificate),composed=A.compose(r.state,cs);assert.equal(composed?.target===t,normal(r.state,t,d));if(composed)V.verify(composed);}
});
test('positive exists at second-player turn never substitutes for all at preceding first-player turn',()=>{
 const cert=I.pinnedChildren().find(r=>r.certificate.depth===3).certificate;V.verify(cert);assert.equal(cert.start.player,1);const children=C.S.moveVariants({board:cert.start,history:[]}).map(move=>PN.prove(C.S.apply({board:cert.start,history:[]},move).board,1,{maxDepth:2,maxNodes:1000000,wallMs:30000}).certificate),win=A.compose(cert.start,children);assert.ok(win);assert.equal(win.target,1);V.verify(win);
 const original=I.splitRoots().find(r=>r.id===I.splitParents()[0].splitRootId);assert.equal(original.state.player,0);assert.equal(A.compose(original.state,[cert,null]),null);
 const bad=structuredClone(I.pinnedChildren().find(r=>r.certificate.depth===47).certificate),node=Object.values(bad.nodes).find(n=>n.kind==='all'&&n.children?.length>1);assert.ok(node);node.children.pop();assert.throws(()=>V.verify(bad));const wrong=structuredClone(cert);wrong.target=0;assert.throws(()=>V.verify(wrong));
 const b={...C.E.initialState(),reason:'relay-limit',winner:0};for(const t of [0,1])assert.equal(PN.prove(b,t,{maxDepth:3}).status,'UNKNOWN');
});
test('four development goals preserve four synthesis layers, exact reuse and interrupted HOLD',()=>{
 const input=I.prepare(),out=fs.mkdtempSync(path.join(os.tmpdir(),'split014-')),m={digest:'development-only',whole:I.whole(),parents:I.parents(),allReplies:I.allReplies(),splitParents:I.splitParents(),splitRoots:I.splitRoots(),priorChildren:I.priorChildren(),roots:I.roots(),heldRoots:I.heldRoots(),deferredChildren:I.deferredChildren(),pinnedChildren:S.pinnedChildRows(),pinnedReplies:I.pinnedReplies(),inputs:{oldGames:input.oldGames,verifiedStates:input.verifiedStates},contract:{maxDepth:76,childMaxDepth:77,rootMaxDepth:78,parentMaxDepth:79,wholeMaxDepth:80,maxNodes:1,wallMs:1000}};
 try{for(let i=0;i<m.roots.length;i++)for(const t of [0,1]){const r=S.job(out,i,t,m);assert.equal(r.status,'NODE_BUDGET');assert.equal(S.job(out,i,t,m).newSearches,0);}const s=S.aggregate(out,m);assert.equal(s.proofJobs,4);assert.equal(s.primaryBefore13.status,'UNKNOWN');assert.equal(s.primaryBefore13.coveredBranches,2);assert.deepEqual(s.splitRoots.map(r=>r.covered),[1,0,2]);assert.equal(s.splitChildren[0].winner,null);assert.equal(s.heldRoots.length,18);assert.equal(s.deferredChildren.length,4);assert.equal(s.pinnedChildren.length,3);
 const file=path.join(out,'proof-0-0.json.gz'),bytes=fs.readFileSync(file),row=S4.read(file);row.inputArchiveSha256='bad';assert.throws(()=>S.audit(row,0,0,m));fs.unlinkSync(file);assert.throws(()=>S.job(out,0,0,m),/HOLD/);fs.writeFileSync(file,bytes);
 }finally{fs.rmSync(out,{recursive:true,force:true});}
});

test('initial four moves and fourteen replies match ordinary engine enumeration',()=>{
 const first=C.S.moveVariants(C.S.initialGame());assert.equal(first.length,4);const expected=first.flatMap(move=>{const next=C.S.apply(C.S.initialGame(),move);return C.S.moveVariants(next).map(reply=>({path:[move,reply],state:C.S.apply(next,reply).board}));});assert.equal(expected.length,14);assert.deepEqual(I.initialRoots().map(r=>({path:r.path,state:r.state})),expected);
});
