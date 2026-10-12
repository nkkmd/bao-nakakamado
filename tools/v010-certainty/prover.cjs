'use strict';
// MIT. Finite-horizon AND/OR proof. Only verified normal wins settle a winner.
const C=require('../v010-balance/core.cjs'),V=require('../v010-balance/diagnostics/proof.cjs');
function prove(start,target,{maxDepth=80,maxNodes=10000000,wallMs=1200000,maxCache=100000,maxStoredNodes=500000,maxHeapBytes=1610612736,
 book=new Map(),guidance=[new Map(),new Map()],onAttempt=()=>{},now=()=>performance.now(),heap=()=>process.memoryUsage().heapUsed}={}){
 const began=now(),deadline=began+wallMs,stop=Symbol('budget');let visits=0,transitions=0,bookUses=0,cacheHits=0,stopReason=null;
 const nodes=new Map(),failed=new Map(),positive=new Map(),refutations=new Map(),attempts=[];
 const idFor=(key,d)=>C.hash(key+'#certainty002#'+d);
 function limit(reason){stopReason=reason;throw stop;}
 function check(){if(visits>=maxNodes)limit('NODE_BUDGET');if(now()>=deadline)limit('WALL_BUDGET');
  if(visits%1024===0&&heap()>maxHeapBytes)limit('MEMORY_BUDGET');if(nodes.size>maxStoredNodes)limit('STORAGE_BUDGET');}
 function boundedSet(map,k,v){if(!map.has(k)&&map.size>=maxCache)map.delete(map.keys().next().value);map.set(k,v);}
 function put(key,d,kind,children){const id=idFor(key,d);if(nodes.has(id))return id;
  const height=kind==='terminal'?0:1+Math.max(...children.map(e=>nodes.get(e.to).height));
  nodes.set(id,{kind,depth:d,stateKey:key,children,height});const old=positive.get(key);
  if(!old||old.height>height)boundedSet(positive,key,{id,height});return id;}
 function copy(source,id,left){const n=source.get?source.get(id):source[id],nextId=idFor(n.stateKey,left);
  if(nodes.has(nextId))return nextId;
  const children=n.children.map(e=>({move:e.move,to:copy(source,e.to,left-1)}));return put(n.stateKey,left,n.kind,children);}
 function cert(id,d,winner){const used={};function walk(k){if(used[k])return;const {height,...n}=nodes.get(k);used[k]=n;n.children.forEach(e=>walk(e.to));}walk(id);
  const out={status:'PROVED',target:winner,depth:d,start,root:id,nodes:used};V.verify(out);return out;}
 const known=book.get(C.Q.stateKey(start));
 if(known&&known.height<=maxDepth){const id=copy(known.cert.nodes,known.id,known.height);bookUses++;
  return {status:known.winner===target?'PROVED':'OPPONENT-PROVED',target,winner:known.winner,certificate:cert(id,known.height,known.winner),attempts,visits,transitions,bookUses,cacheHits,stopReason:null,elapsedMs:now()-began};}
 function visit(b,d){check();visits++;const key=C.Q.stateKey(b);
  if(C.Q.outcome(b)==='safety-stop')return null;
  if(b.winner!==null)return b.winner===target?put(key,d,'terminal',[]):null;
  const known=book.get(key);if(known&&known.winner!==target)return null;
  if(known&&known.height<=d){bookUses++;return copy(known.cert.nodes,known.id,d);}
  const win=positive.get(key);if(win&&win.height<=d){cacheHits++;return copy(nodes,win.id,d);}
  if(d===0)return null;
  // No ancestor-cycle cut: remaining depth strictly decreases. This keeps
  // failed-horizon caching independent of the path used to reach the state.
  if((failed.get(key)??-1)>=d){cacheHits++;return null;}
  const legal=C.Q.moveVariants(b);if(!legal.length)throw Error('ongoing state without legal moves');
  const hints=guidance[target].get(key)||[],refutation=refutations.get(key);
  const ranked=[...legal].sort((a,z)=>{const rank=m=>{const k=C.Public.moveKey(m);if(b.player!==target&&k===refutation)return -1;
   const i=hints.indexOf(k);return i<0?1e9:i;};return rank(a)-rank(z);});
  const children=[];
  for(const move of ranked){check();const next=C.Q.applyMove(b,move).state;transitions++;const id=visit(next,d-1);
   if(b.player===target){if(id){children.push({move,to:id});break;}}
   else {if(!id){boundedSet(failed,key,Math.max(d,failed.get(key)??-1));boundedSet(refutations,key,C.Public.moveKey(move));return null;}children.push({move,to:id});}}
  if(!children.length){boundedSet(failed,key,Math.max(d,failed.get(key)??-1));return null;}
  return put(key,d,b.player===target?'exists':'all',children);
 }
 let certificate=null;
 for(let depth=1;depth<=maxDepth;depth++){const before=visits,t=now();try{const id=visit(start,depth);
   const a={depth,status:id?'PROVED':'UNKNOWN',visits:visits-before,totalVisits:visits,elapsedMs:now()-t};attempts.push(a);onAttempt(a);
   if(id){certificate=cert(id,depth,target);break;}}
  catch(e){if(e!==stop)throw e;const a={depth,status:stopReason,visits:visits-before,totalVisits:visits,elapsedMs:now()-t};attempts.push(a);onAttempt(a);break;}}
 return {status:certificate?'PROVED':stopReason||'UNKNOWN',target,winner:certificate?target:null,certificate,attempts,visits,transitions,bookUses,cacheHits,stopReason,elapsedMs:now()-began};
}
function attach(start,moves,certificates,target){
 const legal=C.Q.moveVariants(start),keys=legal.map(C.Public.moveKey);
 if(start.player!==target&&JSON.stringify(moves.map(C.Public.moveKey).sort())!==JSON.stringify(keys.sort()))throw Error('Incomplete defender coverage');
 if(start.player===target&&moves.length!==1)throw Error('Winner must supply one winning move');
 const depth=1+Math.max(...certificates.map(c=>c.depth)),nodes={};
 function clone(c,id,left){const n=c.nodes[id],key=C.hash(n.stateKey+'#attached002#'+left);if(nodes[key])return key;
  nodes[key]={...n,depth:left,children:n.children.map(e=>({move:e.move,to:clone(c,e.to,left-1)}))};return key;}
 const children=moves.map((move,i)=>{const c=certificates[i];V.verify(c);if(c.target!==target)throw Error('Wrong certificate winner');
  const next=C.Q.applyMove(start,move).state;if(C.Q.stateKey(next)!==c.nodes[c.root].stateKey)throw Error('Certificate state mismatch');return {move,to:clone(c,c.root,depth-1)};});
 const root=C.hash(C.Q.stateKey(start)+'#attached002#'+depth);nodes[root]={kind:start.player===target?'exists':'all',depth,stateKey:C.Q.stateKey(start),children};
 const out={status:'PROVED',target,depth,start,root,nodes,composed:true};V.verify(out);return out;
}
module.exports={prove,attach};
