'use strict';
// MIT. Study 004 reads exact preserved study 003 records and full state keys.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const C=require('../v010-balance/core.cjs'),Old=require('../v010-gc/inputs.cjs'),S3=require('../v010-gc/study.cjs');
const FILE='doc/v010-research-completed/study-003/original-records-001.zip';
const SHA='f1ddd2d366f011c9ff154f261e218d98d49c068b104775ceba9313d0644859d3';
let rows=null,base=null;
function load(){if(rows)return rows;const file=path.join(C.root,FILE);assert.equal(C.hash(fs.readFileSync(file)),SHA);
 const raw=JSON.parse(cp.execFileSync('python3',['-c','import zipfile,gzip,json,hashlib,sys;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps([dict(row=json.loads(gzip.decompress(z.read(n))),sha256=hashlib.sha256(z.read(n)).hexdigest()) for n in z.namelist() if n.startswith("proof-") and n.endswith(".json.gz")]))',file],{maxBuffer:64*1024*1024}));
 const m=S3.manifest();assert.equal(raw.length,34);const byKey=new Map(raw.map(x=>[x.row.index+"-"+x.row.target,x]));assert.equal(byKey.size,34);
 for(const {row} of raw){S3.audit(row,row.index,row.target,m);assert.deepEqual(row.dependencies,S3.dependencyIndices(row.index).flatMap(i=>[0,1].map(target=>({index:i,target,sha256:byKey.get(i+'-'+target).sha256}))));}
 rows=raw.map(x=>x.row);return rows;
}
function prepare(certificates=[]){if(!base){const old=Old.prepare(),book=Old.merge(new Map(old.book),load().map(x=>x.result.certificate).filter(Boolean));base={...old,book,verifiedStates:book.size};}
 const book=Old.merge(new Map(base.book),certificates);return {...base,book,verifiedStates:book.size};}
function parents(){return [19,17].map(ply=>Old.roots().find(r=>r.ply===ply));}
function roots(){const split=parents().flatMap(p=>C.Q.moveVariants(p.state).map((move,moveIndex)=>({id:p.id+'-move-'+moveIndex,state:C.Q.applyMove(p.state,move).state,path:[...p.path,move],scope:'split-successor',parentId:p.id,parentPly:p.ply,moveIndex,move})));
 return [...split,...Old.roots().filter(r=>r.scope==='after-two')];}
module.exports={FILE,SHA,load,prepare,parents,roots};
