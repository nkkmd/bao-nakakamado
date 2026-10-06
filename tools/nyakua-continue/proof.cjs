"use strict";
// MIT; see ../../LICENSE. UNKNOWN is not a draw or an absence proof.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),c=require('./core.cjs');
function bounded(model,root,{maxDepth=16,budget=300000,deadlineMs=480000}={}){
  const records=[],deadline=Date.now()+deadlineMs,side=root.player;let certificate=null;
  for(let depth=1;depth<=maxDepth;depth++){
    let nodes=0,hits=0;const start=Date.now(),table=new Map();
    function solve(b,d){
      if(++nodes>budget)throw Error('NODE_BUDGET');if(nodes%1024===0&&Date.now()>deadline)throw Error('TIME_BUDGET');
      if(b.reason==='relay-limit')return 0;if(b.winner!==null)return b.winner===side?1:-1;if(!d)return 0;
      const k=d+':'+c.key(b);if(table.has(k)){hits++;return table.get(k);}
      const max=b.player===side,cs=c.children(model,b);assert.ok(cs.length);cs.sort((a,b)=>(max?-1:1)*(c.score(model,a.b,side)-c.score(model,b.b,side)));
      let value=max?-1:1;for(const child of cs){const v=solve(child.b,d-1);value=max?Math.max(value,v):Math.min(value,v);if(value===(max?1:-1))break;}
      table.set(k,value);return value;
    }
    try{
      const openings=c.children(model,root).map(x=>({move:x.m,value:solve(x.b,depth-1)})),value=Math.max(...openings.map(x=>x.value));
      const r={depth,result:value===1?'FIRST_FORCED_WIN':value===-1?'SECOND_FORCED_WIN':'UNKNOWN',nodes,hits,elapsedMs:Date.now()-start,openings};records.push(r);
      if(value!==0){
        const target=value===1?side:1-side,ids=new Map(),list=[];
        function build(b,d){
          const k=d+':'+c.key(b);if(ids.has(k))return ids.get(k);const id=list.length;ids.set(k,id);const node={board:b,remaining:d,edges:[]};list.push(node);
          if(b.winner!==null){assert.equal(b.winner,target);assert.notEqual(b.reason,'relay-limit');return id;}
          assert.ok(d>0);let cs=c.children(model,b);
          if(b.player===target){const chosen=cs.find(x=>solve(x.b,d-1)===(target===side?1:-1));assert.ok(chosen);cs=[chosen];}
          node.edges=cs.map(x=>({move:x.m,to:build(x.b,d-1)}));return id;
        }
        certificate={model,target,root:build(root,depth),nodes:list};
        r.certificate=verify(certificate);break;
      }
    }catch(e){if(!['NODE_BUDGET','TIME_BUDGET'].includes(e.message))throw e;records.push({depth,result:e.message,nodes,hits,elapsedMs:Date.now()-start});break;}
  }
  return {model,records,certificate};
}
function reference(model,b,m){return model.startsWith('B-')?c.B.oracle(model,b,m):model==='A'?c.R.oracle(b,m):c.R.advance(model,b,m).b;}
function verify(cert){
  const visited=new Set();let edges=0,defenses=0;
  function visit(id){if(visited.has(id))return;visited.add(id);const node=cert.nodes[id],b=node.board;c.validate(b);
    if(b.winner!==null){assert.equal(b.winner,cert.target);assert.notEqual(b.reason,'relay-limit');assert.equal(node.edges.length,0);return;}
    assert.ok(node.remaining>0);const moves=c.rawMoves(cert.model,b);assert.ok(moves.length);
    if(b.player===cert.target)assert.equal(node.edges.length,1);
    if(b.player!==cert.target)for(const m of moves){const after=reference(cert.model,b,m);assert.ok(node.edges.some(e=>c.key(cert.nodes[e.to].board)===c.key(after)),'Missing defender outcome');defenses++;}
    for(const e of node.edges){assert.ok(moves.some(m=>JSON.stringify(m)===JSON.stringify(e.move)));const after=reference(cert.model,b,e.move);assert.equal(JSON.stringify(after),JSON.stringify(cert.nodes[e.to].board));assert.equal(cert.nodes[e.to].remaining,node.remaining-1);edges++;visit(e.to);}
  }visit(cert.root);assert.equal(visited.size,cert.nodes.length);return {status:'PASS',nodes:visited.size,edges,defenses};
}
function run(out,budget=300000){
  fs.mkdirSync(out,{recursive:true});const results=[];
  for(const model of c.MODELS){
    const r=bounded(model,c.R.engine(model).initialState(),{budget});
    if(r.certificate)fs.writeFileSync(path.join(out,'initial-certificate-'+model+'.json'),JSON.stringify(r.certificate)+'\n');
    const compact={...r,certificate:undefined};results.push(compact);fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(compact));
  }
  const tactical=[];
  for(const model of ['B-early','B-end'])for(let i=0;i<12;i++){
    let b=c.R.engine(model).initialState(),random=c.rng(c.seedAt(930000+i));const history=[];
    for(let ply=0;ply<8+i%5&&b.winner===null;ply++){const cs=c.children(model,b),x=cs[Math.floor(random()*cs.length)];history.push(x.m);b=x.b;}
    if(b.winner!==null)continue;
    const r=bounded(model,b,{maxDepth:8,budget:20000,deadlineMs:30000});const name='tactical-'+model+'-'+i;
    if(r.certificate)fs.writeFileSync(path.join(out,name+'-certificate.json'),JSON.stringify(r.certificate)+'\n');
    tactical.push({name,model,seed:c.seedAt(930000+i),history,root:b,records:r.records,certificate:r.certificate?name+'-certificate.json':null});
  }
  const result={completed:true,budgetPerDepth:budget,initial:results,tactical};fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(result,null,2)+'\n');return result;
}
if(require.main===module)run(process.argv[2]||path.join(__dirname,'results/proof'),Number(process.argv[3])||300000);
module.exports={bounded,verify,run};
