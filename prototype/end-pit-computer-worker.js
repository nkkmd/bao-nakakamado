"use strict";
// MIT; current handcrafted trial only. Runs outside the UI thread.
importScripts('./end-pit-engine.js','./end-pit-search-transition.js','./end-pit-search-evaluator.js','./end-pit-search-ai.js');
const Q=self.NakakamadoEndPitSearchTransition.createForEngine(self.BaoEngine);
const A=self.NakakamadoEndPitSearchAI.createAI(Q);
self.onmessage=({data})=>{
  try {
    if(data?.protocol!=='NAKAKAMADO-BROWSER-WORKER-V010-v1'||!Number.isSafeInteger(data.id)||data.id<1
      ||data.stateKey!==Q.stateKey(data.state)||![25,75,150].includes(data.budgetMs)) throw Error('Invalid search request');
    const result=A.analyzeMove(data.state,{timeLimitMs:data.budgetMs,maxDepth:32});
    self.postMessage({protocol:data.protocol,id:data.id,stateKey:data.stateKey,result});
  } catch(error) {
    self.postMessage({protocol:data?.protocol,id:data?.id,stateKey:data?.stateKey,error:String(error.message)});
  }
};
