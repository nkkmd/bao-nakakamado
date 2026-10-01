"use strict";
const fs=require('node:fs'),vm=require('node:vm');
const candidate=require('./capped-engine.cjs');
const base={E:require('../../prototype/bounce-engine.js'),S:require('../../prototype/steal.js')};
let source=fs.readFileSync(__dirname+'/../balance-options/core.cjs','utf8');
source=source.replace('const {makeEngine}=require("./variant-engine.cjs");','const makeEngine=()=>supplied;');
const config={hands:[12,12],pits:[0,0,0,0,6,2,2,0],threshold:6};
const outputDir=require('node:path').resolve(__dirname,process.env.BAO_CAP_OUTPUT_DIR||'runs');
fs.mkdirSync(outputDir,{recursive:true});
const out={reference:'3c8024cc57fb6dbe70eb525b3db004079ecb4024',status:'PASS',rows:[]};
for(const [rule,supplied] of [['base',base],['capped',candidate]]){
 const ctx=vm.createContext({require,module:{exports:{}},supplied,console});vm.runInContext(source,ctx);
 const C=ctx.module.exports.createCore(config,{reference:out.reference});
 const games=[];
 for(let i=0;i<200;i++){games.push(C.play(12,['search4','search4'],C.seedAt(50000+i)));}
 const row={rule,policy:'search4-material',...C.summarize(games),maxPlies:Math.max(...games.map(g=>g.plies))};
 out.rows.push(row);console.log(JSON.stringify(row));
 fs.writeFileSync(require('node:path').join(outputDir,'search-check.json'),JSON.stringify(out,null,2)+'\n');
}
