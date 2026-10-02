"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs');
const c=require('./core.cjs');
const plain=x=>JSON.parse(JSON.stringify(x));
function accounting(){const start=[22,22,0,0,0],queue=[start],seen=new Set([start.join(',')]);let edges=0,passes=0,minMoves=Infinity,maxMoves=0;const depths=new Map([[start.join(','),[0,0]]]);
 for(let i=0;i<queue.length;i++){const state=queue[i],[a,b,ra,rb,p]=state,h=[a,b],r=[ra,rb],o=1-p,k=state.join(','),[lo,hi]=depths.get(k);
  if(a+b+ra+rb===0){minMoves=Math.min(minMoves,lo);maxMoves=Math.max(maxMoves,hi);continue;}
  if(h[p]+r[p]===0){passes++;continue;}
  const used=Math.min(h[p],r[p]?2:1);h[p]-=used;r[p]=0;
  for(const steal of h[o]>=2?[0,1]:[0]){const hh=h.slice(),rr=r.slice();if(steal){hh[o]--;rr[p]=1;}const next=[...hh,...rr,o],nk=next.join(',');edges++;
   if(!seen.has(nk)){seen.add(nk);queue.push(next);depths.set(nk,[lo+1,hi+1]);}else{const d=depths.get(nk);d[0]=Math.min(d[0],lo+1);d[1]=Math.max(d[1],hi+1);}
  }
 }
 assert.equal(passes,0);return {states:seen.size,edges,passes,note:'All abstract NYAKUA yes/no choices. Independent of board legality; no artificial initial states.'};
}
let boundaryCases=0;
const fixture=c.B.initialState();
for(const m of [{type:'takata',phase:'namua',row:0,index:6,direction:'left'},{type:'capture',phase:'namua',row:0,index:4,direction:'left',side:'right'},{type:'takata',phase:'namua',row:0,index:5,direction:'left'}])Object.assign(fixture,c.S.apply({board:fixture,history:[]},m).board);
fixture.nyakuaReserve=[0,0];
for(const hand of [0,1,2,5])for(const enemy of [0,1,2,5])for(const held of [0,1]){
 const b=plain(fixture),p=b.player,o=1-p;b.reserve[p]=hand;b.reserve[o]=enemy;b.nyakuaReserve[p]=held;b.nyakuaReserve[o]=1;
 const children=c.children('three',b);for(const {m} of children){const before=plain(b),r=c.T.advance(b,m),oracle=c.T.advance(b,m,true);assert.deepEqual(plain(r.b),plain(oracle.b));assert.deepEqual(b,before);assert.equal(c.total(r.b),c.total(b));
  if(m.type!=='pass'){assert.equal(r.entry.placed,Math.min(hand,held?2:1)+held);assert.equal(r.entry.stolen,Number(r.entry.captures>=2&&enemy>=2));assert.equal(r.b.nyakuaReserve[o],1);}
  boundaryCases++;
 }
}
// NYUMBA still sows only two after receiving the full placement.
{const b=c.engines.three.initial();b.pits[0][0][5]=b.pits[0][0][6]=0;b.nyakuaReserve[0]=1;const m=c.children('three',b).find(x=>x.m.houseTwo).m,r=c.T.advance(b,m);assert.equal(r.entry.placed,3);assert.equal(r.events.find(x=>x.kind==='lift').count,2);boundaryCases++;}
let transitions=0,mirrors=0,replays=0;
for(const policy of ['random','greedy','reply'])for(let i=0;i<20;i++){
 const seed=c.seedAt(70000+i),a=c.play('three',[policy,policy],seed,0,true),z=c.play('three',[policy,policy],seed,1,true);assert.equal(a.reason,z.reason);assert.equal(a.winner,1-z.winner);assert.equal(a.path.length,z.path.length);
 let b=c.engines.three.initial();for(let j=0;j<a.path.length;j++){
  for(const {m} of c.children('three',b)){const x=c.T.advance(b,m),y=c.T.advance(b,m,true);assert.deepEqual(plain(x.b),plain(y.b));c.validate(x.b);transitions++;}
  b=c.T.advance(b,a.path[j].move).b;assert.deepEqual(plain(b),plain(a.path[j].after));
  const flip=plain(b);for(const k of ['pits','reserve','nyakuaReserve','pending','houseOwned'])flip[k].reverse();flip.player=1-flip.player;if(flip.winner!==null)flip.winner=1-flip.winner;assert.deepEqual(flip,plain(z.path[j].after));
 }assert.equal(a.passes,0);mirrors++;replays++;
}
const result={accounting:accounting(),boundaryCases,oracleTransitions:transitions,mirrorPairs:mirrors,replays};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
