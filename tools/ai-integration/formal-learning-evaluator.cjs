"use strict";
// MIT. Development-only integer model interpreter; never loaded by public UI.
const assert=require('node:assert/strict'),I=require('./learning-input.cjs'),spec=require('./formal-learning-spec.json');
const S=spec.training.quantizationScale,limit=spec.training.maximumIntegerWeight;
const vector=(a,n,max=limit)=>assert.ok(Array.isArray(a)&&a.length===n&&a.every(x=>Number.isSafeInteger(x)&&Math.abs(x)<=max),'Integer model shape/range');
function validateModel(m){
 assert.equal(m.schema,1);assert.equal(m.specId,spec.id);assert.equal(m.inputSize,I.INPUT_SIZE);assert.equal(m.encodingId,I.ID);
 assert.equal(m.quantizationScale,S);assert.ok(spec.models.includes(m.kind));assert.ok(spec.training.seeds.includes(m.seed));
 assert.ok(/^[a-f0-9]{64}$/.test(m.learningFingerprint));assert.ok(/^[a-f0-9]{64}$/.test(m.trainDigest));
 if(m.kind==='linear'){vector(m.weights,I.INPUT_SIZE);vector([m.bias],1);}
 else if(m.kind==='logic'){
  assert.equal(m.layers.length,spec.training.logicDepth);
  m.layers.forEach((l,i)=>{const n=I.INPUT_SIZE+(i?spec.training.logicWidth:0);for(const a of [l.a,l.b]){vector(a,spec.training.logicWidth,n-1);assert.ok(a.every(x=>x>=0));}
   vector(l.gates,spec.training.logicWidth,15);assert.ok(l.gates.every(x=>x>=0));});
  vector(m.weights,spec.training.logicWidth);vector([m.bias],1);
 }else{
  assert.equal(m.w1.length,I.INPUT_SIZE);m.w1.forEach(a=>vector(a,spec.training.mlpWidth));vector(m.b1,spec.training.mlpWidth);
  vector(m.w2,spec.training.mlpWidth);vector([m.b2],1);vector(m.tanhTable,4097,S);
  assert.equal(m.tanhTable[2048],0);assert.ok(m.tanhTable.every((v,i)=>v===-m.tanhTable[4096-i]));
 }
 return m;
}
function rawInteger(m,x){
 vector(x,I.INPUT_SIZE,1);assert.ok(x.every(v=>v===0||v===1));
 let features=x;
 if(m.kind==='logic'){let h=[];for(const l of m.layers){const pool=x.concat(h);h=l.gates.map((g,i)=>(g>>>(2*pool[l.a[i]]+pool[l.b[i]]))&1);}features=h;}
 if(m.kind!=='mlp')return {n:features.reduce((n,v,i)=>n+v*m.weights[i],m.bias),denominator:S};
 const h=m.b1.map((b,j)=>{const z=x.reduce((n,v,i)=>n+v*m.w1[i][j],b);
  const index=Math.max(-2048,Math.min(2048,Math.trunc(z/16)))+2048;return m.tanhTable[index];});
 return {n:h.reduce((n,v,i)=>n+v*m.w2[i],m.b2*S),denominator:S*S};
}
function evaluateInputs(m,x,opponent){
 const a=rawInteger(m,x),b=rawInteger(m,opponent),clip=n=>Math.max(-a.denominator,Math.min(a.denominator,n));
 return Math.trunc(spec.targetScale*(clip(a.n)-clip(b.n))/(2*a.denominator))||0;
}
function createEvaluator(model){const m=JSON.parse(JSON.stringify(validateModel(model)));
 return Object.freeze({ID:spec.id+'-'+m.kind+'-'+m.seed,evaluate:(state,p=state.player)=>evaluateInputs(m,I.encode(state,p),I.encode(state,1-p))});}
if(require.main===module){const fs=require('node:fs'),m=validateModel(JSON.parse(fs.readFileSync(process.argv[2],'utf8')));
 const views=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));console.log(JSON.stringify(views.map(v=>evaluateInputs(m,v.input,v.opponentInput))));}
module.exports={validateModel,rawInteger,evaluateInputs,createEvaluator};
