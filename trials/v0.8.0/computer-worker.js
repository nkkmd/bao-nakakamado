"use strict";
// MIT. Browser search is isolated from display, animation and final data.
importScripts("./next-turn-engine.js", "./steal.js", "./search-transition.js", "./model-search-ai.js", "./browser-model.js");
const Q = NakakamadoSearchTransition.createForEngine(BaoEngine);
const ready = NakakamadoBrowserModel.verifyBytes();
ready.catch(() => {}); // The request handler reports initialization failures.
const AI = NakakamadoModelSearchAI.createAI(Q, {evaluator:NakakamadoBrowserModel.createEvaluator()});
let received = false;
self.onmessage = async ({data}) => {
  if (received) return;
  received = true; // One dedicated worker per request, terminated on cancel/completion.
  try {
    await ready;
    if (data?.protocol !== "NAKAKAMADO-BROWSER-WORKER-v1" || !Number.isSafeInteger(data.id)
      || data.id < 1 || data.stateKey !== Q.stateKey(data.state)
      || ![25,75,150].includes(data.budgetMs) || Q.outcome(data.state) !== "ongoing") throw Error("Invalid worker request");
    NakakamadoBrowserModel.encode(data.state);
    const result = AI.analyzeMove(data.state, {maxDepth:32, timeLimitMs:data.budgetMs});
    self.postMessage({protocol:data.protocol, id:data.id, stateKey:data.stateKey,
      modelSha256:NakakamadoBrowserModel.MODEL_SHA256, result});
  } catch (error) {
    self.postMessage({protocol:data?.protocol, id:data?.id, stateKey:data?.stateKey, error:String(error.message)});
  }
};
