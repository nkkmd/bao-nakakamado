'use strict';
// MIT. Keep all 13th-move branches; deepen only the two five-pit parents.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const C=require('../v010-balance/core.cjs'),V=require('../v010-balance/diagnostics/proof.cjs'),S11=require('../v010-retro011/study.cjs'),I11=require('../v010-retro011/inputs.cjs'),Old=require('../v010-gc/inputs.cjs'),A=require('../v010-branch/compose.cjs'),PN=require('../v010-pn007/prover.cjs');
const FILE='doc/v010-retro011/completed/original-records-001.zip',SHA='a042c002c79cc6b45194dc1aad1d0ca6af5a4aa1d5a63c90521e29df69eae2d8';let data,base,pinned,known;
function load(){
 if(data)return data;
 const file=path.join(C.root,FILE);assert.equal(C.hash(fs.readFileSync(file)),SHA);
 const d=JSON.parse(cp.execFileSync('python3',['-c','import zipfile,gzip,json,sys;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps({"rows":[json.loads(gzip.decompress(z.read(n))) for n in z.namelist() if n.startswith("proof-") and n.endswith(".json.gz")],"composed":[json.loads(gzip.decompress(z.read(n))) for n in z.namelist() if n.endswith("-certificate.json.gz")]}))',file],{maxBuffer:128*1024*1024}));
 const m=S11.manifest();assert.equal(d.rows.length,54);assert.equal(new Set(d.rows.map(r=>r.index+'-'+r.target)).size,54);
 for(const r of d.rows)S11.audit(r,r.index,r.target,m);
 assert.equal(d.composed.length,2);for(const c of d.composed){V.verify(c);assert.equal(c.target,1);assert.equal(c.start.turn,14);}
 assert.deepEqual(d.composed.map(c=>c.depth).sort((a,b)=>a-b),[51,53]);
 return data=d;
}
const whole=()=>I11.whole(),parents=()=>I11.parents(),allReplies=()=>I11.allReplies();
function prepare(){if(!base){const old=I11.prepare(),d=load(),book=Old.merge(new Map(old.book),[...d.composed,...d.rows.map(r=>r.result.certificate).filter(Boolean)]);base={...old,book,verifiedStates:book.size};}return {...base,book:new Map(base.book)};}
function pinnedCertificates(){if(pinned)return pinned;const {book}=prepare();return pinned=allReplies().flatMap(r=>{const item=book.get(C.Q.stateKey(r.state));if(!item)return [];const result=PN.prove(r.state,item.winner,{book,maxDepth:78,maxNodes:1});assert.equal(result.visits,0);V.verify(result.certificate);return [{id:r.id,certificate:result.certificate}];});}
const pinnedReplies=()=>pinnedCertificates().map(r=>({id:r.id,winner:r.certificate.target,height:r.certificate.depth,stateKey:C.Q.stateKey(r.certificate.start)}));
function knownParents(){if(known)return known;const cs=new Map(pinnedCertificates().map(r=>[r.id,r.certificate]));return known=parents().flatMap(p=>{const replies=allReplies().filter(r=>r.parentId===p.id),certificate=A.compose(p.state,replies.map(r=>cs.get(r.id)||null));return certificate?[{id:p.id,certificate}]:[];});}
function unresolved(){const solved=new Set(knownParents().map(p=>p.id)),pinnedIds=new Set(pinnedCertificates().map(r=>r.id));return allReplies().filter(r=>!solved.has(r.parentId)&&!pinnedIds.has(r.id));}
function roots(){return unresolved().filter(r=>r.parentMove.index===4);}
function heldRoots(){const selected=new Set(roots().map(r=>r.id));return unresolved().filter(r=>!selected.has(r.id));}
function initialRoots(){const coverage=JSON.parse(fs.readFileSync(path.join(C.root,'doc/v010-retro011/initial-coverage.json')));return coverage.rows.flatMap((p,i)=>p.replies.map((r,j)=>({id:`initial-${i}-${j}`,state:r.state,path:[p.move,r.move],parentId:`initial-${i}`,move:r.move,scope:'initial-after-response'})));}
module.exports={FILE,SHA,load,whole,parents,allReplies,prepare,pinnedCertificates,pinnedReplies,knownParents,unresolved,roots,heldRoots,initialRoots};
