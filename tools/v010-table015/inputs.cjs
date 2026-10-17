'use strict';
// MIT. Read-only 014 provenance; a new table policy never resumes old failed tables.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),C=require('../v010-balance/core.cjs'),I14=require('../v010-split014/inputs.cjs'),S14=require('../v010-split014/study.cjs');
const FILE='doc/v010-split014/completed/original-records-001.zip',SHA='92f94fb4486a8d67cb5b75763d240b650b50d1181519e9b5b5125a8619f0647a';let data;
function load(){if(data)return data;const file=path.join(C.root,FILE);assert.equal(C.hash(fs.readFileSync(file)),SHA);const d=JSON.parse(cp.execFileSync('python3',['-c','import zipfile,gzip,json,sys;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps({"rows":[json.loads(gzip.decompress(z.read(n))) for n in z.namelist() if n.startswith("proof-") and n.endswith(".json.gz")]}))',file],{maxBuffer:128*1024*1024}));const m=S14.manifest();assert.equal(d.rows.length,4);assert.equal(new Set(d.rows.map(r=>r.index+'-'+r.target)).size,4);for(const r of d.rows){S14.audit(r,r.index,r.target,m);assert.equal(r.result.certificate,null);}return data=d;}
function prepare(){load();return I14.prepare();}
const deeperRoots=()=>I14.roots().flatMap(r=>C.S.moveVariants({board:r.state,history:[]}).map((move,i)=>{const state=C.S.apply({board:r.state,history:[]},move).board;assert.deepEqual(state,C.Q.applyMove(r.state,move).state);return {id:r.id+'-move-'+i,parentId:r.id,move,state,path:[...r.path,move]};}));
module.exports={...I14,FILE,SHA,load,prepare,deeperRoots};
