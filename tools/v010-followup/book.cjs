'use strict';
// MIT. Guidance changes order only; certificate cuts require verified proofs.
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),C=require('../v010-balance/core.cjs');
const P=require('../v010-balance/diagnostics/proof.cjs'),R=require('./registry.cjs');
function guidance(){const maps=[new Map(),new Map()];for(const g of R.traceGames()){
 C.auditGame(g);if(g.firstWin===null)continue;
 const winner=g.final.winner;for(const t of g.turns){if(!maps[winner].has(t.before))maps[winner].set(t.before,[]);
   const key=C.Public.moveKey(t.move);if(!maps[winner].get(t.before).includes(key))maps[winner].get(t.before).push(key);}}
 return maps;}
function proofBook(certificates=null){const map=new Map(),names=['primary-8192-ply29','low-512-ply51','middle-2048-ply55'];
 const certs=certificates||names.map(name=>JSON.parse(z.gunzipSync(fs.readFileSync(path.join(C.root,'doc/v010-balance/diagnostics/'+name+'.json.gz')))));
 for(const cert of certs){P.verify(cert);
  const heights=new Map();function height(id){if(heights.has(id))return heights.get(id);const n=cert.nodes[id];
    const h=n.kind==='terminal'?0:1+Math.max(...n.children.map(c=>height(c.to)));heights.set(id,h);return h;}height(cert.root);
  for(const [id,n]of Object.entries(cert.nodes)){if(!heights.has(id))continue;const item={winner:cert.target,height:height(id),id,cert};
   const old=map.get(n.stateKey);if(old&&old.winner!==item.winner)throw Error('conflicting verified proof');
   if(!old||old.height>item.height)map.set(n.stateKey,item);}}
 return map;}
module.exports={guidance,proofBook};
