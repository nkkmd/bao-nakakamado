"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const E=require("./end-pit-engine.js"),Q=require("./end-pit-search-transition.js").createForEngine(E);
const C=require("./end-pit-computer-client.js"), Simple=require("./end-pit-simple-ai.js").createAI(Q);
function harness(){
  const workers=[],timers=new Map();let next=0;
  const client=C.createClient(Q,{createWorker:()=>{const w={terminated:false,postMessage(d){this.input=d;},terminate(){this.terminated=true;}};workers.push(w);return w;},
    setTimer:f=>{timers.set(++next,f);return next;},clearTimer:id=>timers.delete(id),fallback:b=>Simple.chooseMove(b)});
  const reply=(w,overrides={})=>w.onmessage({data:{...w.input,
    result:{move:Q.moveVariants(w.input.state)[0],stats:{evaluatorId:C.EVALUATOR_ID,searchId:C.SEARCH_ID,allocatedTimeMs:w.input.budgetMs,completedDepth:1,elapsedMs:1}},...overrides}});
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
test("invalid move/evaluator, crashed worker and watchdog each return a marked legal fallback",async()=>{
  for(const reason of ["invalid-move","invalid-response","worker-error","watchdog"]){
    const h=harness(),state=E.initialState(),p=h.client.request(state),w=h.workers[0];
    if(reason==="invalid-move")h.reply(w,{result:{move:{type:"bogus"},stats:{evaluatorId:C.EVALUATOR_ID,searchId:C.SEARCH_ID,allocatedTimeMs:150,completedDepth:1,elapsedMs:1}}});
    if(reason==="invalid-response")h.reply(w,{result:{move:Q.moveVariants(state)[0],stats:{evaluatorId:"wrong"}}});
    if(reason==="worker-error")w.onerror({preventDefault(){}});
    if(reason==="watchdog")Array.from(h.timers.values())[0]();
    const a=await p;assert.equal(a.diagnostic.fallback,reason);assert.deepEqual(a.move,Simple.chooseMove(state));
    assert.ok(w.terminated);assert.equal(h.timers.size,0);h.reply(w);
  }
});
test("unavailable worker uses Bao Nakakamado legal move and terminal roots do not launch",async()=>{
  let created=0;const c=C.createClient(Q,{fallback:b=>Simple.chooseMove(b),createWorker:()=>{created++;throw Error("unavailable");}});
  const a=await c.request(E.initialState());assert.equal(a.diagnostic.fallback,"worker-unavailable");
  assert.equal(await c.request({...E.initialState(),winner:0,reason:"front-empty"}),null);assert.equal(created,1);
  assert.throws(()=>c.request(E.initialState(),"unknown"));
});
test('actual Worker script uses current rules and rejects bad protocol',()=>{
  const path=require('node:path'),context=vm.createContext({performance,postMessage:data=>output.push(data)});
  const output=[];context.self=context;
  context.importScripts=(...names)=>names.forEach(name=>vm.runInContext(fs.readFileSync(path.join(__dirname,name),'utf8'),context));
  vm.runInContext(fs.readFileSync(path.join(__dirname,'end-pit-computer-worker.js'),'utf8'),context);
  for(const state of [E.initialState(),require('../tools/end-pit-search/fixtures.cjs').e30()]) {
    context.onmessage({data:{protocol:C.PROTOCOL,id:1,stateKey:Q.stateKey(state),state,budgetMs:25}});
    const r=output.pop();assert.equal(r.error,undefined);assert.equal(r.result.stats.searchId,C.SEARCH_ID);
    assert.ok(Q.moveVariants(state).some(m=>C.moveKey(m)===C.moveKey(r.result.move)));
  }
  context.onmessage({data:{protocol:'old',id:1}});assert.match(output.pop().error,/Invalid/);
});
