'use strict';
// MIT. Goal-specific bounded AND/OR proof; guidance never discards legal moves.
const C=require('../v010-balance/core.cjs'),V=require('../v010-balance/diagnostics/proof.cjs');
function prove(start,target,{maxDepth=24,maxNodes=1000000,wallMs=600000,guidance=[new Map(),new Map()],book=new Map(),onAttempt=()=>{},now=()=>performance.now()}={}){
 const started=now(),deadline=started+wallMs,limit=Symbol('proof-limit');let visits=0,bookUses=0,opponentCuts=0,cycleCuts=0,stopReason=null;
 const nodes=new Map(),memo=new Map(),attempts=[];
 const idFor=(key,d)=>C.hash(key+'#followup#'+d);
 function check(){if(visits>=maxNodes){stopReason='NODE_BUDGET';throw limit;}if(now()>=deadline){stopReason='WALL_BUDGET';throw limit;}}
 function importBook(item,d){const seen=new Map();
   function clone(oldId,left){const n=item.cert.nodes[oldId],id=idFor(n.stateKey,left);
     if(seen.has(id))return id;seen.set(id,true);
     const children=n.children.map(c=>({move:c.move,to:clone(c.to,left-1)}));
     nodes.set(id,{...n,depth:left,children});return id;}
   return clone(item.id,d);}
 function certificate(id,d,winner){const used=new Map();function collect(k){if(used.has(k))return;
   const n=nodes.get(k);if(!n)throw Error('Missing certificate node');used.set(k,n);n.children.forEach(c=>collect(c.to));}collect(id);
   const c={status:'PROVED',target:winner,depth:d,budget:maxNodes,visits,start,root:id,nodes:Object.fromEntries(used)};V.verify(c);return c;}
 // A known opponent win at this ROOT is a counter-certificate, not UNKNOWN.
 const known=book.get(C.Q.stateKey(start));
 if(known&&known.height<=maxDepth){const id=importBook(known,known.height);bookUses++;
   return {status:known.winner===target?'PROVED':'OPPONENT-PROVED',target,winner:known.winner,certificate:certificate(id,known.height,known.winner),
     attempts,visits,bookUses,opponentCuts,cycleCuts,stopReason:null,elapsedMs:Math.max(0,now()-started)};}
 function visit(b,d,path){check();visits++;
   const key=C.Q.stateKey(b),cacheKey=key+'#'+d;
   if(C.Q.outcome(b)==='safety-stop')return null;
   if(b.winner!==null){if(b.winner!==target)return null;const id=idFor(key,d);
     nodes.set(id,{kind:'terminal',depth:d,stateKey:key,children:[]});return id;}
   const known=book.get(key);
   if(known?.winner!==undefined&&known.winner!==target){opponentCuts++;return null;}
   if(known&&known.height<=d){bookUses++;return importBook(known,d);}
   if(d===0)return null;
   const pos=C.positionKey(b);if(path.has(pos)){cycleCuts++;return null;}
   if(memo.has(cacheKey))return memo.get(cacheKey);
   const legal=C.S.moveVariants({board:b,history:[]});if(!legal.length)throw Error('Ongoing position without legal variants');
   const priority=guidance[b.player===target?target:1-target].get(key)||[];
   const order=[...legal].sort((a,z)=>{const ai=priority.indexOf(C.Public.moveKey(a)),zi=priority.indexOf(C.Public.moveKey(z));return (ai<0?1e9:ai)-(zi<0?1e9:zi);});
   const nextPath=new Set(path);nextPath.add(pos);const children=[];
   for(const move of order){check();const next=C.S.apply({board:b,history:[]},move).board;C.invariant(next);
     const child=visit(next,d-1,nextPath);
     if(b.player===target){if(child){children.push({move,to:child});break;}}
     else {if(!child){memo.set(cacheKey,null);return null;}children.push({move,to:child});}}
   if(!children.length){memo.set(cacheKey,null);return null;}
   const id=idFor(key,d);nodes.set(id,{kind:b.player===target?'exists':'all',depth:d,stateKey:key,children});memo.set(cacheKey,id);return id;
 }
 let cert=null;
 for(let depth=1;depth<=maxDepth;depth++){
   const before=visits,t=now();try{const id=visit(start,depth,new Set());
     attempts.push({depth,status:id?'PROVED':'UNKNOWN',visits:visits-before,totalVisits:visits,elapsedMs:Math.max(0,now()-t)});
     onAttempt(attempts.at(-1));if(id){cert=certificate(id,depth,target);break;}}
   catch(e){if(e!==limit)throw e;attempts.push({depth,status:stopReason,visits:visits-before,totalVisits:visits,elapsedMs:Math.max(0,now()-t)});onAttempt(attempts.at(-1));break;}
 }
 return {status:cert?'PROVED':stopReason||'UNKNOWN',target,winner:cert?target:null,certificate:cert,attempts,visits,bookUses,opponentCuts,cycleCuts,
   stopReason,elapsedMs:Math.max(0,now()-started)};
}
function combineInitial(firstMoves,certificates,winner){
 if(winner===0){const found=certificates.find(x=>x?.target===0);if(!found)return null;
   const i=certificates.indexOf(found);return assemble([firstMoves[i]],[found],0);}
 if(certificates.length!==firstMoves.length||certificates.some(c=>!c||c.target!==1))return null;
 return assemble(firstMoves,certificates,1);
}
function assemble(moves,certs,winner){const start=C.E.initialState(),depth=1+Math.max(...certs.map(c=>c.depth)),nodes={};
 const root=C.hash(C.Q.stateKey(start)+'#initial-composed#'+depth);const children=[];
 function clone(c,id,d){const n=c.nodes[id],key=C.hash(n.stateKey+'#composed#'+d);if(nodes[key])return key;
   nodes[key]={...n,depth:d,children:n.children.map(edge=>({move:edge.move,to:clone(c,edge.to,d-1)}))};return key;}
 moves.forEach((m,i)=>{const b=C.S.apply({board:start,history:[]},m).board;
   if(C.Q.stateKey(b)!==certs[i].nodes[certs[i].root].stateKey)throw Error('Certificate not after matching initial move');
   children.push({move:m,to:clone(certs[i],certs[i].root,depth-1)});});
 nodes[root]={kind:winner===0?'exists':'all',depth,stateKey:C.Q.stateKey(start),children};
 const cert={status:'PROVED',target:winner,depth,start,root,nodes,composed:true};V.verify(cert);return cert;
}
module.exports={prove,combineInitial};
