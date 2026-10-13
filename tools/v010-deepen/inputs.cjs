'use strict';
// MIT. Preserve all 005 outcomes; explore only the seventeen unresolved replies.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const C=require('../v010-balance/core.cjs'),S5=require('../v010-reply/study.cjs'),I5=require('../v010-reply/inputs.cjs'),Old=require('../v010-gc/inputs.cjs'),V=require('../v010-balance/diagnostics/proof.cjs');
const FILE='doc/v010-reply/completed/original-records-001.zip',SHA='d25c1dfc9721e9c15fedc69d57165eee33fb0d3cecf8674b20074fd057103bf1';
let rows=null,base=null;
function load(){if(rows)return rows;const file=path.join(C.root,FILE);assert.equal(C.hash(fs.readFileSync(file)),SHA);
 const data=JSON.parse(cp.execFileSync('python3',['-c','import zipfile,gzip,json,sys;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps([json.loads(gzip.decompress(z.read(n))) for n in z.namelist() if n.startswith("proof-") and n.endswith(".json.gz")]))',file],{maxBuffer:64*1024*1024}));
 const m=S5.manifest();assert.equal(data.length,52);assert.equal(new Set(data.map(r=>r.index+'-'+r.target)).size,52);for(const r of data)S5.audit(r,r.index,r.target,m);rows=data;return rows;}
function prepare(){if(!base){const old=I5.prepare(),book=Old.merge(new Map(old.book),load().map(r=>r.result.certificate).filter(Boolean));base={...old,book,verifiedStates:book.size};}return {...base,book:new Map(base.book)};}
function parents(){return I5.parents().filter(p=>[4,5].includes(p.study004Index));}
function allRoots(){return I5.roots().filter(r=>[4,5].includes(r.study004Index));}
function pinnedReplies(){return allRoots().flatMap(r=>{const index=I5.roots().findIndex(x=>x.id===r.id),cs=load().filter(x=>x.index===index).map(x=>x.result.certificate).filter(Boolean);if(cs.length>1)assert.equal(cs[0].target,cs[1].target);return cs.length?[{id:r.id,certificate:cs[0]}]:[];});}
function roots(){const pinned=new Set(pinnedReplies().map(x=>x.id));return allRoots().filter(r=>!pinned.has(r.id));}
function known(){const result=I5.known();const file=path.join(C.root,FILE);const c=JSON.parse(cp.execFileSync('python3',['-c','import zipfile,gzip,json,sys;z=zipfile.ZipFile(sys.argv[1]);print(gzip.decompress(z.read("primary-before-19-move-2-certificate.json.gz")).decode())',file],{maxBuffer:64*1024*1024}));
 V.verify(c);const p=I5.parents().find(x=>x.study004Index===2);assert.deepEqual(c.start,p.state);assert.equal(c.target,1);return [...result,{id:p.id,index:2,certificate:c}];}
module.exports={FILE,SHA,load,prepare,parents,allRoots,pinnedReplies,roots,known};
