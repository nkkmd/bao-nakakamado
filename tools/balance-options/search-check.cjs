"use strict";
const fs=require('node:fs'),assert=require('node:assert/strict');
const {createCore}=require('./core.cjs'),{configurations}=require('./run.cjs');
let cases=0;const rows=[];
for(const config of configurations()){
 const c=createCore(config),game=c.play(config,['random','random'],c.seedAt(1500),0,true);let count=0;
 function brute(b,d,side,kind){if(b.winner!==null||d===0)return c.score(b,side,kind);const values=c.variants(b).map(m=>brute(c.advance(b,m).b,d-1,side,kind));return b.player===side?Math.max(...values):Math.min(...values);}
 for(const index of [0,Math.floor(game.path.length/2),game.path.length-1]){
  const b=game.path[index].before,side=b.player;
  for(const depth of [2,3,4])for(const kind of ['material','mobility']){
   const chosen=c.select(b,'search'+depth+'-'+kind,c.rng(3456),{searchNodes:0});
   const values=c.variants(b).map(m=>brute(c.advance(b,m).b,depth-1,side,kind));
   assert.equal(brute(c.advance(b,chosen).b,depth-1,side,kind),Math.max(...values));cases++;count++;
  }
 }
 rows.push({config:config.id,cases:count,mismatches:0});
}
const result={status:'PASS',cases,rows};fs.writeFileSync(process.argv[2]||'search-checks.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
