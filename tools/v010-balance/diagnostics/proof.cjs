'use strict';
// MIT. Bounded AND/OR win certificates using normal physical transitions only.
const fs=require('node:fs'),z=require('node:zlib'),assert=require('node:assert/strict');
const C=require('../core.cjs');
function certify(start,target,depth,budget=100000){let visits=0;const memo=new Map(),nodes=new Map();
  function visit(b,d){if(++visits>budget)throw Error('NODE_BUDGET');
    const key=C.Q.stateKey(b)+'#'+d;if(memo.has(key))return memo.get(key);
    if(C.Q.outcome(b)==='safety-stop'||(b.winner===null&&d===0)){memo.set(key,null);return null;}
    const id=C.hash(key);if(b.winner!==null){if(b.winner!==target){memo.set(key,null);return null;}
      nodes.set(id,{kind:'terminal',depth:d,stateKey:C.Q.stateKey(b),children:[]});memo.set(key,id);return id;}
    const legal=C.S.moveVariants({board:b,history:[]});if(!legal.length){memo.set(key,null);return null;}
    const children=[];
    for(const move of legal){const next=C.S.apply({board:b,history:[]},move).board,p=visit(next,d-1);
      if(b.player===target){if(p){children.push({move,to:p});break;}}
      else {if(!p){memo.set(key,null);return null;}children.push({move,to:p});}}
    if(!children.length){memo.set(key,null);return null;}
    nodes.set(id,{kind:b.player===target?'exists':'all',depth:d,stateKey:C.Q.stateKey(b),children});memo.set(key,id);return id;
  }
  let id=null,status='UNKNOWN';try{id=visit(start,depth);if(id)status='PROVED';}catch(e){if(e.message!=='NODE_BUDGET')throw e;status='NODE_BUDGET';}
  if(!id)return {status,target,depth,budget,visits};
  const used=new Map();function collect(k){if(used.has(k))return;const node=nodes.get(k);used.set(k,node);node.children.forEach(c=>collect(c.to));}collect(id);
  const cert={status,target,depth,budget,visits,start,root:id,nodes:Object.fromEntries(used)};
  verify(cert);return cert;
}
function verify(cert){assert.equal(cert.status,'PROVED');const checked=new Set();
  function walk(b,id){const n=cert.nodes[id];assert.ok(n);assert.equal(n.stateKey,C.Q.stateKey(b));if(checked.has(id))return;checked.add(id);
    assert.notEqual(C.Q.outcome(b),'safety-stop');
    if(n.kind==='terminal'){assert.equal(b.winner,cert.target);assert.equal(C.Q.outcome(b),'normal-terminal');assert.equal(n.children.length,0);return;}
    assert.ok(n.depth>0);assert.equal(b.winner,null);
    const legal=C.S.moveVariants({board:b,history:[]}),keys=legal.map(C.Public.moveKey);
    if(b.player===cert.target){assert.equal(n.kind,'exists');assert.equal(n.children.length,1);}
    else {assert.equal(n.kind,'all');assert.deepEqual(n.children.map(c=>C.Public.moveKey(c.move)).sort(),keys.sort());}
    for(const c of n.children){assert.ok(keys.includes(C.Public.moveKey(c.move)));assert.equal(cert.nodes[c.to].depth,n.depth-1);
      const next=C.S.apply({board:b,history:[]},c.move).board;C.invariant(next);walk(next,c.to);}
  }walk(cert.start,cert.root);return checked.size;}
if(require.main===module){const [src,out]=process.argv.slice(2);fs.mkdirSync(out,{recursive:true});const jobs=[
  ['primary-8192',27,1,12],['primary-8192',29,1,10],['primary-8192',25,1,14],
  ['low-512',51,1,4],['middle-2048',55,0,9]];
  for(const [profile,ply,target,depth]of jobs){const row=JSON.parse(z.gunzipSync(fs.readFileSync(src+'/'+profile+'-0.json.gz'))),g=row.games[0];let b=g.start;
    for(const t of g.turns.slice(0,ply-1))b=C.S.apply({board:b,history:[]},t.move).board;
    const result=certify(b,target,depth);fs.writeFileSync(out+'/'+profile+'-ply'+ply+'.json',JSON.stringify(result));
    console.log(JSON.stringify({profile,ply,target,depth,status:result.status,visits:result.visits,proofNodes:result.nodes?Object.keys(result.nodes).length:0}));}
}
module.exports={certify,verify};
