'use strict';
// MIT. Study 005 preserves all 004 results and splits every reply in three unknown branches.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const C=require('../v010-balance/core.cjs'),S4=require('../v010-branch/study.cjs'),I4=require('../v010-branch/inputs.cjs'),Old=require('../v010-gc/inputs.cjs');
const FILE='doc/v010-branch/completed/original-records-001.zip',SHA='5c997efc5d9a6108904695930b96a1d2418a01d88a18b01034abbcdda714a58e';
let rows=null,base=null;
function load(){if(rows)return rows;const file=path.join(C.root,FILE);assert.equal(C.hash(fs.readFileSync(file)),SHA);
 const data=JSON.parse(cp.execFileSync('python3',['-c','import zipfile,gzip,json,hashlib,sys;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps([dict(row=json.loads(gzip.decompress(z.read(n))),sha256=hashlib.sha256(z.read(n)).hexdigest()) for n in z.namelist() if n.startswith("proof-") and n.endswith(".json.gz")]))',file],{maxBuffer:64*1024*1024}));
 const m=S4.manifest(),byKey=new Map(data.map(x=>[x.row.index+'-'+x.row.target,x]));assert.equal(data.length,54);assert.equal(byKey.size,54);
 for(const {row}of data){S4.audit(row,row.index,row.target,m);assert.deepEqual(row.dependencies,S4.dependencyIndices(row.index).flatMap(index=>[0,1].map(target=>({index,target,sha256:byKey.get(index+'-'+target).sha256}))));}
 rows=data.map(x=>x.row);return rows;}
function prepare(){if(!base){const old=I4.prepare(),book=Old.merge(new Map(old.book),load().map(r=>r.result.certificate).filter(Boolean));base={...old,book,verifiedStates:book.size};}return {...base,book:new Map(base.book)};}
function parents(){const roots=I4.roots();return [2,4,5].map(index=>({...roots[index],study004Index:index}));}
function roots(){return parents().flatMap(p=>C.Q.moveVariants(p.state).map((move,replyIndex)=>({id:p.id+'-reply-'+replyIndex,state:C.Q.applyMove(p.state,move).state,path:[...p.path,move],parentId:p.id,study004Index:p.study004Index,replyIndex,move,scope:'after-reply'})));}
function known(){const m=S4.manifest();return [0,1,3,6,7,8].map(index=>{const row=load().find(r=>r.index===index&&r.target===1);assert.equal(row.result.status,'PROVED');return {id:m.roots[index].id,index,certificate:row.result.certificate};});}
module.exports={FILE,SHA,load,prepare,parents,roots,known};
