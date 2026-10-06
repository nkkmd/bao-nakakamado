"use strict";
// MIT; see ../../LICENSE.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),c=require('./core.cjs');
function handGraph(){
  const todo=[[22,22,0]],seen=new Set(),edges=[];let terminals=0;
  while(todo.length){const [a,b,p]=todo.pop(),k=[a,b,p].join(':');if(seen.has(k))continue;seen.add(k);
    if(a+b===0){terminals++;continue;}
    const h=[a,b];assert.ok(h[p]>0,'reachable exhaustion pass');assert.ok(h[p]===h[1-p]||h[p]===h[1-p]+1);
    h[p]--;const options=[0];if(h[p]>=1&&h[1-p]>=2)options.push(1);
    for(const add of options){const n=h.map(x=>x-add);assert.ok(n.every(x=>x>=0));edges.push({from:[a,b,p],add,to:[...n,1-p]});todo.push([...n,1-p]);}
  }
  return {status:'PASS',states:seen.size,edges:edges.length,terminalStates:terminals,passes:0,maxNamuaPlies:44,
    invariant:'At a nonterminal turn the mover has either the same hand count as the opponent or one more; paired addition reduces both equally.',edgesDetail:edges};
}
function run(out){
  let transitions=0,symmetry=0,snapshotChecks=0,mtajiEquality=0,reachableGames=0,fuzzStates=0;
  const examples={},failures=[],stats={};
  function check(b,m,reachable=false){
    const r=c.R.advance('A',b,m);c.validate(r.b);assert.equal(JSON.stringify(r.b),JSON.stringify(c.R.oracle(b,m)));transitions++;
    const mirrored=c.R.advance('A',c.swap(b),m).b;assert.equal(JSON.stringify(c.swap(r.b)),JSON.stringify(mirrored));symmetry++;
    if(transitions%23===0){assert.equal(JSON.stringify(r.b),JSON.stringify(c.R.advance('A',b,m,true).b));snapshotChecks++;}
    if(b.phase==='mtaji'){assert.equal(JSON.stringify(r.b),JSON.stringify(c.R.advance('none',b,m).b));mtajiEquality++;}
    assert.equal(r.b.nyakuaReserve[0]+r.b.nyakuaReserve[1],0);
    const add=r.events.find(e=>e.kind==='end-pit-add');
    if(add){assert.equal(b.phase,'namua');assert.ok(r.entry.captures>=2);assert.ok(r.b.reserve[1-b.player]>=1);assert.equal(r.b.reserve[b.player],b.reserve[b.player]-2);assert.equal(r.b.reserve[1-b.player],b.reserve[1-b.player]-1);assert.equal(r.events.filter(e=>e.kind==='end-pit-add').length,1);
      const types=['addition',...(add.position.row===1?['backAddition']:[]),...(add.position.row===0&&add.position.index===4?['houseAddition']:[]),...(r.entry.captures>=3?['threeCapturesOneAddition']:[])];
      for(const t of types)if(!examples[t])examples[t]={reachable,before:b,move:m,entry:r.entry,after:r.b};
    }
    if(r.b.reason==='front-empty'||r.b.reason==='relay-limit')assert.equal(r.entry.stolen,0);
    if(r.b.reason==='relay-limit'&&!examples.relayLimit){
      const d=c.R.advance('A',b,m,false,true),loops=new Map();let repeated=null;
      for(const e of d.events.filter(e=>e.kind==='study-loop')){if(loops.has(e.loopKey)){repeated={first:loops.get(e.loopKey),again:e.relays,period:e.relays-loops.get(e.loopKey)};break;}loops.set(e.loopKey,e.relays);}
      examples.relayLimit={reachable,before:b,move:m,after:r.b,exactLoop:repeated};
    }
    return r;
  }
  for(let i=0;i<100;i++){
    let b=c.R.engine('A').initialState(),random=c.rng(c.seedAt(900000+i));const seen=new Set();
    for(let ply=0;ply<200&&b.winner===null;ply++){
      const k=c.key(b);if(seen.has(k))break;seen.add(k);
      const rs=c.rawMoves('A',b).map(m=>({m,...check(b,m,true)}));assert.ok(rs.length);b=rs[Math.floor(random()*rs.length)].b;
    }reachableGames++;
  }
  const random=c.rng(c.seedAt(910000));
  for(let i=0;i<1200;i++){
    const b=c.R.engine('A').initialState();b.pits=b.pits.map(rows=>rows.map(row=>row.map(()=>0)));b.houseOwned=[false,false];b.player=i%2;b.phase=i%3===0?'mtaji':'namua';
    b.reserve=b.phase==='namua'?[1+Math.floor(random()*10),1+Math.floor(random()*10)]:[0,0];
    b.pits[0][0][4]=1;b.pits[1][0][4]=1;
    for(let n=2+b.reserve[0]+b.reserve[1];n<64;n++)b.pits[Math.floor(random()*2)][Math.floor(random()*2)][Math.floor(random()*8)]++;
    b.houseOwned=b.pits.map((rows,p)=>b.phase==='namua'&&rows[0][4]>=6&&random()<.5);
    for(const m of c.rawMoves('A',b))check(b,m,false);fuzzStates++;
  }
  const qualifying=examples.addition;assert.ok(qualifying,'No addition exercised');
  for(const [name,hands] of [['ownLast',[1,5]],['opponentLast',[5,1]],['pairMinimum',[2,2]]]){
    const b=JSON.parse(JSON.stringify(qualifying.before)),p=b.player,o=1-p;
    const old=b.reserve[0]+b.reserve[1];b.reserve[p]=hands[0];b.reserve[o]=hands[1];b.pits[o][1][0]+=old-hands[0]-hands[1];
    if(b.pits[o][1][0]<0)continue;
    const r=check(b,qualifying.move);assert.equal(r.entry.stolen,name==='pairMinimum'?1:0);examples[name]={reachable:false,before:b,move:qualifying.move,after:r.b};
  }
  // Full shallow minimax must agree with each chosen completed-depth move.
  function brute(b,d,p){if(!d||b.winner!==null)return c.score('A',b,p);const vs=c.children('A',b).map(x=>brute(x.b,d-1,p));return b.player===p?Math.max(...vs):Math.min(...vs);}
  let searchChecks=0,b=c.R.engine('A').initialState();
  for(let i=0;i<12&&b.winner===null;i++){
    const stats={searchNodes:0,budgetStops:0,completedDepthSum:0,searchDecisions:0};
    const chosen=c.choose('A',b,'search3',c.rng(c.seedAt(i)),stats),cs=c.children('A',b);
    if(cs.length>1){assert.equal(stats.budgetStops,0);const values=cs.map(x=>brute(x.b,2,b.player));assert.equal(brute(chosen.b,2,b.player),Math.max(...values));searchChecks++;}
    b=chosen.b;
  }
  const fixture=require('./legacy-cycle.json'), diagnostic=c.R.advance('A',fixture.before,fixture.move,false,true);
  assert.equal(diagnostic.b.reason,'relay-limit');assert.equal(JSON.stringify(diagnostic.b),JSON.stringify(c.R.advance('none',fixture.before,fixture.move).b));
  const loopSeen=new Map();let exactLoop=null;
  for(const e of diagnostic.events.filter(e=>e.kind==='study-loop')){if(loopSeen.has(e.loopKey)){exactLoop={first:loopSeen.get(e.loopKey),again:e.relays,period:e.relays-loopSeen.get(e.loopKey)};break;}loopSeen.set(e.loopKey,e.relays);}
  assert.equal(exactLoop?.period,fixture.knownPeriod);
  const inheritedCycle={source:fixture.source,reachableUnderA:'not established',exactLoop,nonLimitAlternatives:c.children('A',fixture.before).filter(x=>x.b.reason!=='relay-limit').length};
  const result={status:'PASS',inheritedCycle,transitions,symmetry,snapshotChecks,mtajiEquality,reachableGames,fuzzStates,searchChecks,handGraph:handGraph(),examples};
  fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({...result,handGraph:{...result.handGraph,edgesDetail:undefined},examples:Object.keys(examples)}));return result;
}
if(require.main===module)run(process.argv[2]||path.join(__dirname,'results/checks.json'));
module.exports={run,handGraph};
