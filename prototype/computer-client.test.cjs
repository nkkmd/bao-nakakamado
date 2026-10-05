"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const E=require("./next-turn-engine.js"),Q=require("./search-transition.js").createForEngine(E);
const C=require("./computer-client.js"), F=require("../tools/ai-integration/frozen-model-search.cjs");
function harness(){
  const workers=[],timers=new Map();let next=0;
  const client=C.createClient(Q,{createWorker:()=>{const w={terminated:false,postMessage(d){this.input=d;},terminate(){this.terminated=true;}};workers.push(w);return w;},
    setTimer:f=>{timers.set(++next,f);return next;},clearTimer:id=>timers.delete(id)});
  const reply=(w,overrides={})=>w.onmessage({data:{...w.input,modelSha256:C.MODEL_SHA256,
    result:{move:Q.moveVariants(w.input.state)[0],stats:{evaluatorId:F.spec.evaluatorId,allocatedTimeMs:w.input.budgetMs,completedDepth:1,elapsedMs:1}},...overrides}});
  return {client,workers,timers,reply};
}
test("cancelled and old worker replies cannot replace a current request",async()=>{
  const h=harness(),state=E.initialState(),before=JSON.stringify(state);
  const old=h.client.request(state,"easy"),a=h.workers[0];
  const current=h.client.request(state,"normal"),b=h.workers[1];
  assert.equal(await old,null);assert.ok(a.terminated);h.reply(a);
  h.reply(b,{id:a.input.id});assert.equal(h.timers.size,1);
  h.reply(b,{stateKey:"old-position"});assert.equal(h.timers.size,1);
  h.reply(b);const answer=await current;
  assert.equal(answer.diagnostic.budgetMs,75);assert.equal(answer.diagnostic.fallback,null);
  assert.equal(h.timers.size,0);assert.ok(b.terminated);assert.equal(JSON.stringify(state),before);
  h.client.cancel();
});
test("invalid move/model, crashed worker and watchdog each return a marked legal fallback",async()=>{
  for(const reason of ["invalid-move","invalid-response","worker-error","watchdog"]){
    const h=harness(),state=E.initialState(),p=h.client.request(state),w=h.workers[0];
    if(reason==="invalid-move")h.reply(w,{result:{move:{type:"bogus"},stats:{evaluatorId:F.spec.evaluatorId,allocatedTimeMs:150,completedDepth:1,elapsedMs:1}}});
    if(reason==="invalid-response")h.reply(w,{modelSha256:"wrong"});
    if(reason==="worker-error")w.onerror({preventDefault(){}});
    if(reason==="watchdog")Array.from(h.timers.values())[0]();
    const a=await p;assert.equal(a.diagnostic.fallback,reason);assert.deepEqual(a.move,Q.moveVariants(state)[0]);
    assert.ok(w.terminated);assert.equal(h.timers.size,0);h.reply(w);
  }
});
test("unavailable worker uses Bao Nakakamado legal move and terminal roots do not launch",async()=>{
  let created=0;const c=C.createClient(Q,{createWorker:()=>{created++;throw Error("unavailable");}});
  const a=await c.request(E.initialState());assert.equal(a.diagnostic.fallback,"worker-unavailable");
  assert.equal(await c.request({...E.initialState(),winner:0,reason:"front-empty"}),null);assert.equal(created,1);
  assert.throws(()=>c.request(E.initialState(),"unknown"));
});
test("browser model matches the frozen encoder/evaluator and search on all 89 development roots",async()=>{
  const context=vm.createContext({BaoEngine:E,NakakamadoSearchTransition:require("./search-transition.js"),
    NakakamadoSteal:require("./steal.js"),crypto:globalThis.crypto,TextEncoder});
  vm.runInContext(fs.readFileSync(require.resolve("./browser-model.js"),"utf8"),context);
  await context.NakakamadoBrowserModel.verifyBytes();
  const V=context.NakakamadoBrowserModel.createEvaluator(),expected=F.createEvaluator();
  const ai=require("./model-search-ai.js").createAI(Q,{evaluator:V,now:()=>0}),node=F.createAI({now:()=>0});
  const rows=require("../tools/ai-integration/model-search-corpus.cjs").corpus();assert.equal(rows.length,89);
  for(const {state} of rows){
    for(const p of [0,1]){
      assert.deepEqual(Array.from(context.NakakamadoBrowserModel.encode(state,p)),require("../tools/ai-integration/learning-input.cjs").encode(state,p));
      assert.equal(V.evaluate(state,p),expected.evaluate(state,p));
    }
    assert.deepEqual(ai.analyzeMove(state,{maxDepth:1}),node.analyzeMove(state,{maxDepth:1}));
  }
  assert.equal(V.evaluate({...E.initialState(),winner:0,reason:"front-empty"},0),1000000);
  assert.equal(V.evaluate({...E.initialState(),winner:1,reason:"relay-limit"},0),0);
});
