'use strict';
// MIT. Reverify study 002 certificates; old unknowns never become proof wins.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const C=require('../v010-balance/core.cjs'),B=require('../v010-followup/book.cjs'),Old=require('../v010-certainty/inputs.cjs'),S2=require('../v010-certainty/study.cjs');
const FILE=path.join(__dirname,'inputs/study002-records.zip'),SHA='9fc4cd03a8ba907e413dcf75c00998561f02a9bfdab8f6d1e94642e8be86c3f4';
let rows=null,base=null;
function load(){if(rows)return rows;assert.equal(C.hash(fs.readFileSync(FILE)),SHA);
 rows=JSON.parse(cp.execFileSync('python3',['-c','import zipfile,gzip,json,sys;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps([json.loads(gzip.decompress(z.read(n))) for n in z.namelist() if n.startswith("proof-") and n.endswith(".json.gz")]))',FILE],{maxBuffer:64*1024*1024}));
 const m=S2.manifest();assert.equal(rows.length,38);for(const row of rows)S2.audit(row,row.index,row.target,m);return rows;}
function merge(book,certificates){for(const [key,item]of B.proofBook(certificates)){const old=book.get(key);
 if(old&&old.winner!==item.winner)throw Error('contradictory verified wins');if(!old||old.height>item.height)book.set(key,item);}return book;}
function prepare(certificates=[]){if(!base){const old=Old.prepare(),book=new Map(old.book);merge(book,load().map(r=>r.result.certificate).filter(Boolean));
 base={book,guidance:old.guidance,oldGames:old.oldGames,verifiedStates:book.size};}
 const book=merge(new Map(base.book),certificates);return {...base,book,verifiedStates:book.size};}
function roots(){const r=Old.roots();return [...r.filter(x=>x.scope==='after-two'),...[21,19,17].map(ply=>r.find(x=>x.ply===ply))];}
module.exports={load,prepare,merge,roots,SHA};
