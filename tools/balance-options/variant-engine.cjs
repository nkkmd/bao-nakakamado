"use strict";
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
function makeEngine(config){
 assert.ok(config.hands.length===2&&config.hands.every(x=>Number.isInteger(x)&&x>0));
 assert.ok(config.pits.length===8&&config.pits.every(x=>Number.isInteger(x)&&x>=0));
 assert.ok([4,6].includes(config.threshold));
 let source=fs.readFileSync(path.join(__dirname,'../../prototype/bounce-engine.js'),'utf8');
 const replacements=[['item.value >= 6','item.value >= '+config.threshold],['item.value < 6','item.value < '+config.threshold],['countAt(state, cursor) >= 6','countAt(state, cursor) >= '+config.threshold]];
 for(const [from,to] of replacements){assert.equal(source.split(from).length-1,1);source=source.replace(from,to);}
 const context=vm.createContext({module:{exports:{}},WeakSet,JSON,Object,Array,Boolean});
 vm.runInContext(source,context,{filename:'isolated-bounce-engine.js'});
 const E=context.module.exports;
 context.module={exports:{}};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../../prototype/steal.js'),'utf8'),context,{filename:'isolated-steal.js'});
 // Historical balance comparisons use the pre-protection NYAKUA rule.
 return {E,S:context.module.exports.createForEngine(E,{protectLast:false})};
}
module.exports={makeEngine};
