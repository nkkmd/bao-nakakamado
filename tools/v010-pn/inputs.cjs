'use strict';
// MIT. Verify all 005 originals and retain seven 19th-move branches and two instant wins.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const C=require('../v010-balance/core.cjs'),S5=require('../v010-reply/study.cjs'),I5=require('../v010-reply/inputs.cjs'),Old=require('../v010-gc/inputs.cjs');
const FILE='doc/v010-reply/completed/original-records-001.zip',SHA='d25c1dfc9721e9c15fedc69d57165eee33fb0d3cecf8674b20074fd057103bf1';let data=null,base=null,all=null,known=null,rs=null;
function load(){if(data)return data;const file=path.join(C.root,FILE);assert.equal(C.hash(fs.readFileSync(file)),SHA);data=JSON.parse(cp.execFileSync('python3',['-c','import zipfile,gzip,json,sys;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps({"rows":[json.loads(gzip.decompress(z.read(n))) for n in z.namelist() if n.startswith("proof-") and n.endswith(".json.gz")],"parent":json.loads(gzip.decompress(z.read("primary-before-19-move-2-certificate.json.gz")))}))',file],{maxBuffer:64*1024*1024}));
 assert.equal(data.rows.length,52);assert.equal(new Set(data.rows.map(r=>r.index+'-'+r.target)).size,52);const m=S5.manifest();for(const r of data.rows)S5.audit(r,r.index,r.target,m);require('../v010-balance/diagnostics/proof.cjs').verify(data.parent);assert.equal(data.parent.target,1);assert.deepEqual(data.parent.start,I5.parents().find(p=>p.study004Index===2).state);return data;}
function prepare(){if(!base){const old=I5.prepare(),d=load(),book=Old.merge(new Map(old.book),[d.parent,...d.rows.map(r=>r.result.certificate).filter(Boolean)]);base={...old,book,verifiedStates:book.size};}return {...base,book:new Map(base.book)};}
function parents(){return I5.parents().filter(p=>[4,5].includes(p.study004Index));}
function allReplies(){if(all)return all;return all=I5.roots().filter(r=>[4,5].includes(r.study004Index)).map(r=>({...r,study005Index:I5.roots().findIndex(x=>x.id===r.id)}));}
function knownReplies(){if(known)return known;return known=allReplies().flatMap(r=>{const c=load().rows.find(x=>x.index===r.study005Index&&x.result.certificate)?.result.certificate;return c?[{...r,certificate:c}]:[];});}
function roots(){if(rs)return rs;return rs=allReplies().filter(r=>!knownReplies().some(k=>k.id===r.id));}
function knownBranches(){return [...I5.known(),{id:'primary-before-19-move-2',index:2,certificate:load().parent}];}
module.exports={FILE,SHA,load,prepare,parents,allReplies,knownReplies,roots,knownBranches};
