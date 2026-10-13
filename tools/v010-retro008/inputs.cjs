'use strict';
// MIT. Verified 007 win book plus complete 17th-move response partitions.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const C=require('../v010-balance/core.cjs'),V=require('../v010-balance/diagnostics/proof.cjs'),S7=require('../v010-pn007/study.cjs'),I7=require('../v010-pn007/inputs.cjs'),I4=require('../v010-branch/inputs.cjs'),Old=require('../v010-gc/inputs.cjs');
const FILE='doc/v010-pn007/completed/original-records-001.zip',SHA='a44b81b64fb4ba5dec8925be91ba58c7d9c4003732093cdad7d008b6f4086467';let data=null,base=null,all=null,pinned=null,known=null;
function load(){if(data)return data;const file=path.join(C.root,FILE);assert.equal(C.hash(fs.readFileSync(file)),SHA);
 data=JSON.parse(cp.execFileSync('python3',['-c','import zipfile,gzip,json,sys;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps({"rows":[json.loads(gzip.decompress(z.read(n))) for n in z.namelist() if n.startswith("proof-") and n.endswith(".json.gz")],"composed":[json.loads(gzip.decompress(z.read(n))) for n in z.namelist() if n.endswith("-certificate.json.gz")]}))',file],{maxBuffer:128*1024*1024}));
 const m=S7.manifest();assert.equal(data.rows.length,34);assert.equal(new Set(data.rows.map(r=>r.index+'-'+r.target)).size,34);for(const row of data.rows)S7.audit(row,row.index,row.target,m);
 assert.equal(data.composed.length,3);for(const c of data.composed){V.verify(c);assert.equal(c.target,1);}const c=data.composed.find(c=>c.start.turn===19);assert.ok(c);assert.deepEqual(c.start,I4.parents().find(p=>p.ply===19).state);assert.equal(c.depth,48);return data;}
function prepare(){if(!base){const old=I7.prepare(),d=load(),certificates=[...d.rows.map(r=>r.result.certificate).filter(Boolean),...d.composed],book=Old.merge(new Map(old.book),certificates);base={...old,book,verifiedStates:book.size};}return {...base,book:new Map(base.book)};}
function whole(){return I4.parents().find(p=>p.ply===17);}
function parents(){return I4.roots().filter(r=>r.parentId===whole().id);}
function allReplies(){if(all)return all;return all=parents().flatMap(p=>C.Q.moveVariants(p.state).map((move,replyIndex)=>({id:p.id+'-reply-'+replyIndex,parentId:p.id,parentMove:p.move,move,replyIndex,state:C.Q.applyMove(p.state,move).state,path:[...p.path,move],scope:'17th-move-after-response'})));}
function pinnedReplies(){const {book}=prepare();return allReplies().flatMap(r=>{const known=book.get(C.Q.stateKey(r.state));return known?[{id:r.id,winner:known.winner,height:known.height,stateKey:C.Q.stateKey(r.state)}]:[];});}
function roots(){const known=new Set(knownParents().map(r=>r.id));return allReplies().filter(r=>!known.has(r.parentId));}
function pinnedCertificates(){if(pinned)return pinned;const {book}=prepare(),P=require('../v010-pn007/prover.cjs');return pinned=pinnedReplies().map(r=>{const state=allReplies().find(x=>x.id===r.id).state,result=P.prove(state,r.winner,{book,maxDepth:78,maxNodes:1});assert.equal(result.visits,0);V.verify(result.certificate);return {id:r.id,certificate:result.certificate};});}
function knownParents(){if(known)return known;const A=require('../v010-branch/compose.cjs'),cs=new Map(pinnedCertificates().map(r=>[r.id,r.certificate]));return known=parents().flatMap(p=>{const replies=allReplies().filter(r=>r.parentId===p.id),certificate=A.compose(p.state,replies.map(r=>cs.get(r.id)||null));return certificate?[{id:p.id,certificate}]:[];});}
module.exports={FILE,SHA,load,prepare,whole,parents,allReplies,pinnedReplies,roots,pinnedCertificates,knownParents};
