"use strict";
// MIT. Study 007 pins all 006 originals before using the unchanged 005 win book.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const C=require('../v010-balance/core.cjs'),S6=require('../v010-deepen/study.cjs'),Base=require('../v010-pn/inputs.cjs');
const FILE='doc/v010-deepen/completed/original-records-001.zip',SHA='666f507a20de60b69f19fb479608ab668259e642b82ea0f41e6c4de4d511bbb1';let data=null;
function load006(){if(data)return data;const file=path.join(C.root,FILE);assert.equal(C.hash(fs.readFileSync(file)),SHA);
 const rows=JSON.parse(cp.execFileSync('python3',['-c','import zipfile,gzip,json,sys;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps([json.loads(gzip.decompress(z.read(n))) for n in z.namelist() if n.startswith("proof-") and n.endswith(".json.gz")]))',file],{maxBuffer:64*1024*1024}));
 const m=S6.manifest();assert.equal(rows.length,34);assert.equal(new Set(rows.map(r=>r.index+'-'+r.target)).size,34);for(const row of rows){S6.audit(row,row.index,row.target,m);assert.equal(row.result.certificate,null);assert.equal(row.result.winner,null);}assert.deepEqual(Base.roots().map(r=>r.state),m.roots.map(r=>r.state));data=rows;return data;}
function prepare(){load006();return Base.prepare();}
module.exports={...Base,FILE,SHA,prepare,load006};
