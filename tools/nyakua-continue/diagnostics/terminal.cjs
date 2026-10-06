"use strict";
// MIT. A local forced win on the recorded path is separate from an opening proof.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),c=require('../core.cjs'),P=require('../proof.cjs');
function run(){
  const root=path.join(__dirname,'../results'),source='mobility/example-B-early-0-0.json',game=JSON.parse(fs.readFileSync(path.join(root,source)));let b=c.R.engine(game.model).initialState();
  for(const x of game.history.slice(0,50)){b=c.R.advance(game.model,b,x.move).b;assert.equal(JSON.stringify(b),JSON.stringify(x.after));}
  assert.equal(b.player,0);assert.equal(b.winner,null);
  const r=P.bounded(game.model,b,{maxDepth:4,budget:20000,deadlineMs:10000});assert.ok(r.certificate);const verified=P.verify(r.certificate);assert.equal(r.records.at(-1).depth,3);assert.equal(verified.nodes,4);
  const out={status:'PASS',source,rootAfterPly:50,...r};fs.writeFileSync(path.join(root,'mobility-terminal-proof.json'),JSON.stringify(out,null,2)+'\n');return out;
}
if(require.main===module){const r=run();console.log(JSON.stringify({status:r.status,rootAfterPly:r.rootAfterPly,records:r.records.map(x=>({depth:x.depth,result:x.result})),certificate:P.verify(r.certificate)}));}
module.exports={run};
