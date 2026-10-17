'use strict';
// MIT. Isolated 015 comparison: original stop policy or FIFO cache replacement.
// Full state/depth keys and certificate storage are unchanged; active frame references stay live.
// Threshold recurrences: Kishimoto/Mueller, Df-pn in Go, section 3 / figure 2.
// A disproof here only refutes a finite-horizon target; it never proves another winner.
const C=require('../v010-balance/core.cjs'),V=require('../v010-balance/diagnostics/proof.cjs');
const INF=Infinity,MAX=1000000000000;
function prove(start,target,{maxDepth=78,maxNodes=2000000,wallMs=240000,maxTableEntries=500000,maxStoredNodes=500000,maxHeapBytes=1610612736,tablePolicy='stop',book=new Map(),guidance=[new Map(),new Map()],now=()=>performance.now(),heap=()=>process.memoryUsage().heapUsed,onAttempt=()=>{}}={}){
 if(!['stop','fifo'].includes(tablePolicy))throw Error('invalid tablePolicy');if(!Number.isInteger(maxTableEntries)||maxTableEntries<1)throw Error('invalid table cap');
 const began=now(),stop=Symbol('budget'),table=new Map(),nodes=new Map();let visits=0,transitions=0,bookUses=0,cacheHits=0,expansions=0,stopReason=null,root=null,evictions=0;
 function limit(reason){stopReason=reason;throw stop;}
 function check(){if(visits>=maxNodes)limit('NODE_BUDGET');if(now()-began>=wallMs)limit('WALL_BUDGET');if(visits%1024===0&&heap()>maxHeapBytes)limit('MEMORY_BUDGET');}
 function sum(values){if(values.includes(INF))return INF;const n=values.reduce((a,b)=>a+b,0);if(n>MAX)limit('NUMBER_BUDGET');return n;}
 function plus(n){if(n===INF)return INF;if(n>=MAX)limit('NUMBER_BUDGET');return n+1;}
 const keyFor=(b,d)=>C.Q.stateKey(b)+'#pn007#'+d;
 function put(key,d,kind,children){const id=C.hash(key+'#pn007#'+d);if(nodes.has(id))return id;if(nodes.size>=maxStoredNodes)limit('STORAGE_BUDGET');
 const height=children.length?1+Math.max(...children.map(c=>nodes.get(c.to).height)):0;
 nodes.set(id,{stateKey:key,depth:d,kind,children,height});return id;}
 function copy(source,id,left){const n=source.get?source.get(id):source[id];if(left<0)throw Error('negative certificate depth');const key=C.hash(n.stateKey+'#pn007#'+left);if(nodes.has(key))return key;
 return put(n.stateKey,left,n.kind,n.children.map(e=>({move:e.move,to:copy(source,e.to,left-1)})));}
 function certificate(id,winner){const height=nodes.get(id).height,used={};function clone(k,left){const n=nodes.get(k),j=C.hash(n.stateKey+'#pn007final#'+left);if(!used[j]){used[j]={stateKey:n.stateKey,depth:left,kind:n.kind,children:[]};used[j].children=n.children.map(e=>({move:e.move,to:clone(e.to,left-1)}));}return j;}
 const r=clone(id,height),cert={status:'PROVED',target:winner,start,depth:height,root:r,nodes:used};V.verify(cert);return cert;}
 function lookup(b,d){check();visits++;const key=keyFor(b,d);if(table.has(key)){cacheHits++;return table.get(key);}if(table.size>=maxTableEntries){if(tablePolicy==='stop')limit('TABLE_BUDGET');table.delete(table.keys().next().value);evictions++;}
 const e={pn:1,dn:1,id:null};table.set(key,e);const stateKey=C.Q.stateKey(b),known=book.get(stateKey);
 if(C.Q.outcome(b)==='safety-stop'){e.pn=INF;e.dn=0;}
 else if(b.winner!==null){e.pn=b.winner===target?0:INF;e.dn=b.winner===target?INF:0;if(e.pn===0)e.id=put(stateKey,d,'terminal',[]);}
 else if(known&&known.winner===target&&known.height<=d){bookUses++;e.pn=0;e.dn=INF;e.id=copy(known.cert.nodes,known.id,d);}
 else if((known&&known.winner!==target)||d===0){e.pn=INF;e.dn=0;}
 return e;}
 function mid(b,d,thpn,thdn,e){check();visits++;if(e.pn===0||e.dn===0||e.pn>=thpn||e.dn>=thdn)return;
 const moves=C.Q.moveVariants(b),hints=guidance[target].get(C.Q.stateKey(b))||[];if(!moves.length)throw Error('ongoing without legal moves');
 const ranked=[...moves].sort((a,z)=>{const rank=m=>{const i=hints.indexOf(C.Public.moveKey(m));return i<0?1e9:i;};return rank(a)-rank(z);});
 const children=ranked.map(move=>{check();const state=C.Q.applyMove(b,move).state;transitions++;return {move,state,e:lookup(state,d-1)};});expansions++;
 const isOr=b.player===target;
 function update(){e.pn=isOr?Math.min(...children.map(c=>c.e.pn)):sum(children.map(c=>c.e.pn));e.dn=isOr?sum(children.map(c=>c.e.dn)):Math.min(...children.map(c=>c.e.dn));
 if(e.pn===0&&!e.id){const winning=isOr?[children.find(c=>c.e.pn===0)]:children;if(winning.some(c=>!c.e.id))throw Error('missing winning child certificate');e.id=put(C.Q.stateKey(b),d,isOr?'exists':'all',winning.map(c=>({move:c.move,to:c.e.id})));}}
 update();while(e.pn>0&&e.dn>0&&e.pn<thpn&&e.dn<thdn){const selected=[...children].sort((a,z)=>(isOr?a.e.pn:a.e.dn)-(isOr?z.e.pn:z.e.dn))[0];
 const second=Math.min(INF,...children.filter(c=>c!==selected).map(c=>isOr?c.e.pn:c.e.dn));
 const childPn=isOr?Math.min(thpn,plus(second)):(thpn===INF?INF:thpn-e.pn+selected.e.pn);
 const childDn=isOr?(thdn===INF?INF:thdn-e.dn+selected.e.dn):Math.min(thdn,plus(second));
 if(!(childPn>selected.e.pn&&childDn>selected.e.dn))throw Error('threshold made no progress');mid(selected.state,d-1,childPn,childDn,selected.e);update();}
 }
 const known=book.get(C.Q.stateKey(start));let cert=null;
 try{if(known&&known.height<=maxDepth){bookUses++;cert=certificate(copy(known.cert.nodes,known.id,known.height),known.winner);}else{root=lookup(start,maxDepth);mid(start,maxDepth,INF,INF,root);if(root.pn===0)cert=certificate(root.id,target);}}
 catch(e){if(e!==stop)throw e;}
 const status=cert?(cert.target===target?'PROVED':'OPPONENT-PROVED'):stopReason||'UNKNOWN',attempt={depth:maxDepth,status,visits,totalVisits:visits,elapsedMs:now()-began};onAttempt(attempt);
 return {status,target,winner:cert?.target??null,certificate:cert,attempts:[attempt],visits,transitions,bookUses,cacheHits,expansions,tablePolicy,evictions,tableEntries:table.size,storedNodes:nodes.size,proofNumber:root?.pn===INF?'INF':root?.pn??null,disproofNumber:root?.dn===INF?'INF':root?.dn??null,finiteHorizonRefuted:!cert&&!stopReason&&root?.dn===0,stopReason,elapsedMs:now()-began};
}
module.exports={prove};
