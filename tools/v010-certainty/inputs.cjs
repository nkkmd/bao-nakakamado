'use strict';
// MIT. Pinned earlier records guide order only; only certificates settle wins.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const C=require('../v010-balance/core.cjs'),B=require('../v010-followup/book.cjs'),R=require('../v010-followup/registry.cjs'),V=require('../v010-balance/diagnostics/proof.cjs');
const FILE=path.join(__dirname,'inputs/study001-records.zip'),SHA='d51cc469a456b1b35e03d2287940476194a2bd82e27d26a26297fb0cd39599b6';
let data=null,prepared=null;
function load(){if(data)return data;assert.equal(C.hash(fs.readFileSync(FILE)),SHA);
 const python='import zipfile,gzip,json,sys;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps([json.loads(gzip.decompress(z.read(n))) for n in z.namelist() if n.endswith(".json.gz")]))';
 data=JSON.parse(cp.execFileSync('python3',['-c',python,FILE],{maxBuffer:64*1024*1024}));return data;}
function prepare(){if(prepared)return prepared;const guidance=B.guidance(),certificates=[];let games=0;
 for(const row of load()){
  if(row.games){for(const g of row.games){C.auditGame(g);games++;if(g.firstPlayer!==0||g.firstWin===null)continue;
    const winner=g.final.winner;for(const tr of g.turns){let a=guidance[winner].get(tr.before);if(!a){a=[];guidance[winner].set(tr.before,a);}
     const k=C.Public.moveKey(tr.move);if(!a.includes(k))a.push(k);}}}
  else if(row.result?.certificate){V.verify(row.result.certificate);certificates.push(row.result.certificate);}
 }
 assert.equal(games,420);const book=B.proofBook();const extra=B.proofBook(certificates);
 for(const [key,item]of extra){const old=book.get(key);if(old&&old.winner!==item.winner)throw Error('Contradictory verified certificates');if(!old||old.height>item.height)book.set(key,item);}
 prepared={guidance,book,oldGames:games,verifiedStates:book.size};return prepared;}
function roots(){const list=R.openings().filter(o=>o.forced).map(o=>{let b=C.E.initialState();for(const m of o.moves)b=C.Q.applyMove(b,m).state;
  return {id:o.id,state:b,path:o.moves,scope:'after-two',firstIndex:o.firstIndex,replyIndex:o.replyIndex};});
 const g=R.game?R.game('primary-8192'):JSON.parse(require('node:zlib').gunzipSync(fs.readFileSync(path.join(C.root,'tools/v010-followup/inputs/primary-8192-0.json.gz')))).games[0];
 for(const ply of [17,19,21,23,25]){let b=C.E.clone(g.start);const moves=g.turns.slice(0,ply-1).map(t=>t.move);for(const m of moves)b=C.Q.applyMove(b,m).state;
  list.push({id:'primary-before-'+ply,state:b,path:moves,scope:'reachable-trace',ply});}return list;}
module.exports={load,prepare,roots,SHA};
