"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
class Element {
  constructor() {
    this.children = [];
    this.handlers = new Map();
    this.attrs = new Map();
    this.classNames = new Set();
    this.classList = {
      add: (name) => this.classNames.add(name),
      toggle: (name, enabled) => enabled ? this.classNames.add(name) : this.classNames.delete(name),
    };
    this.disabled = false;
    this.textContent = "";
  }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
  setAttribute(name, value) { this.attrs.set(name, value); }
  addEventListener(name, fn) { this.handlers.set(name, fn); }
  focus() {}
  click() { if (!this.disabled) this.handlers.get("click")?.(); }
}

test("search computer reset discards an in-flight response and records only the current legal move", async () => {
  const ids=["board","turn-number","turn-name","phase-name","north-hand","south-hand","north-nyakua","south-nyakua",
    "steal-count","steal-result","download","move-choices","setup","status","start","new-game","mode","side","side-field",
    "opponent-badge","sound","speed","difficulty","difficulty-field"];
  const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
  elements["north-hand"].parentElement=new Element();elements["south-hand"].parentElement=new Element();
  elements.mode.value="search-computer";elements.side.value="1";elements.difficulty.value="hard";
  const timers=new Map(),workers=[];let next=0,saved;
  const oldDocument=global.document,oldWindow=global.window,oldBlob=global.Blob;
  const oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL;
  const E=require("./end-pit-engine.js"),Q=require("./end-pit-search-transition.js").createForEngine(E),C=require("./end-pit-computer-client.js");
  const setTimer=f=>{timers.set(++next,f);return next;},clearTimer=id=>timers.delete(id);
  global.document={getElementById:id=>elements[id],createElement:()=>new Element()};
  global.window={BaoEngine:E,NakakamadoSteal:require("./end-pit-rules.js"),NakakamadoEndPitSimpleAI:require("./end-pit-simple-ai.js"),NakakamadoEndPitSearchTransition:require("./end-pit-search-transition.js"),
    innerWidth:800,matchMedia:()=>({matches:false}),setTimeout:setTimer,clearTimeout:clearTimer,
    NakakamadoEndPitComputerClient:{...C,createClient:q=>C.createClient(q,{setTimer,clearTimer,fallback:b=>require("./end-pit-simple-ai.js").createAI(Q).chooseMove(b),
      createWorker:()=>{const w={postMessage(d){this.input=d;},terminate(){this.terminated=true;}};workers.push(w);return w;}})}};
  global.Blob=class {constructor(parts){this.parts=parts;}};
  URL.createObjectURL=b=>{saved=JSON.parse(b.parts.join(""));return "blob:test";};URL.revokeObjectURL=()=>{};
  function fireNext(){const [id,f]=timers.entries().next().value;timers.delete(id);f();}
  function reply(w){w.onmessage({data:{...w.input,
    result:{move:Q.moveVariants(w.input.state)[0],stats:{evaluatorId:C.EVALUATOR_ID,searchId:C.SEARCH_ID,allocatedTimeMs:150,completedDepth:1,elapsedMs:1}}}});}
  try{
    delete require.cache[require.resolve("./app.js")];require("./app.js");
    elements.start.click();fireNext();assert.equal(workers.length,1);
    assert.equal(elements.board.attrs.get("aria-busy"),"true");
    elements["new-game"].click();assert.ok(workers[0].terminated);assert.equal(timers.size,0);
    reply(workers[0]);await Promise.resolve();
    assert.equal(elements.setup.hidden,false);assert.equal(elements["turn-number"].textContent,"TURN 1");
    elements.start.click();fireNext();reply(workers[1]);await Promise.resolve();
    let steps=0;while(timers.size){assert.ok(++steps<5000);fireNext();}
    assert.equal(elements["turn-name"].textContent,"▲ NORTH");
    assert.equal(elements.board.attrs.get("aria-busy"),"false");
    elements.download.click();assert.equal(saved.mode,"computer");assert.equal(saved.version,9);
    assert.equal(saved.computer.id,C.AI_ID);assert.equal(saved.computer.releaseId,C.RELEASE_ID);
    assert.equal(saved.computer.publicAdopted,true);assert.equal(saved.computer.diagnostics.length,1);
    assert.equal(saved.computer.diagnostics[0].requestId,2);
    assert.equal(saved.computer.diagnostics[0].fallback,null);
    assert.deepEqual(window.NakakamadoSteal.replay(saved).board,saved.final);
  }finally{
    global.document=oldDocument;global.window=oldWindow;global.Blob=oldBlob;
    URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;
    delete require.cache[require.resolve("./app.js")];
  }
});
