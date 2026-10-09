"use strict";
// MIT. Current-position validation and cancellation for browser search.
(function(root) {
  const PROTOCOL = "NAKAKAMADO-BROWSER-WORKER-V010-v1";
  const AI_ID = "NAKAKAMADO-AI-V010-TRIAL-v1";
  const RELEASE_ID = "NAKAKAMADO-AI-V010-TRIAL-001";
  const PUBLIC_ADOPTED = false;
  const EVALUATOR_ID = "NAKAKAMADO-HANDCRAFT-V010-v1";
  const SEARCH_ID = "NAKAKAMADO-SEARCH-V010-v1";
  const BUDGETS = Object.freeze({easy:25, normal:75, hard:150});
  const moveKey = m => JSON.stringify([m?.type,m?.phase,m?.row,m?.index,m?.direction,m?.side,m?.houseChoice,Boolean(m?.houseTwo)]);
  function createClient(Q, {createWorker=()=>new root.Worker("./end-pit-computer-worker.js?v=v010-trial001"),
    setTimer=(f,ms)=>root.setTimeout(f,ms), clearTimer=id=>root.clearTimeout(id),
    fallback=b=>root.NakakamadoEndPitSimpleAI.createAI(Q).chooseMove(b)}={}) {
    let active=null, nextId=0;
    function cancel() {
      if (!active) return;
      const a=active; active=null; clearTimer(a.timer); a.worker?.terminate(); a.resolve(null);
    }
    function request(state, difficulty="hard") {
      cancel();
      if (!Object.hasOwn(BUDGETS,difficulty)) throw Error("Invalid difficulty");
      const stateKey=Q.stateKey(state), legal=Q.moveVariants(state);
      if (Q.outcome(state)!=="ongoing" || !legal.length) return Promise.resolve(null);
      const id=++nextId, budgetMs=BUDGETS[difficulty];
      return new Promise(resolve=>{
        const a={id,stateKey,resolve,worker:null,timer:null}; active=a;
        function finish(result,reason=null) {
          if(active!==a) return;
          let move;
          if (reason) {
            try {move=fallback(state);} catch {reason="fallback-error";}
            move=legal.find(m=>moveKey(m)===moveKey(move)) || legal[0];
          } else move=legal.find(m=>moveKey(m)===moveKey(result?.move));
          if (!move && !reason) { finish(null,"invalid-move"); return; }
          active=null; clearTimer(a.timer); a.worker?.terminate();
          resolve({move:{...move},diagnostic:{protocol:PROTOCOL,requestId:id,stateKey,
            learnedModel:false,evaluatorId:EVALUATOR_ID,searchId:SEARCH_ID,difficulty,budgetMs,fallback:reason,
            searchFallback:!reason && result.stats.completedDepth===0,
            stats:reason ? null : result.stats}});
        }
        a.timer=setTimer(()=>finish(null,"watchdog"),5000);
        try {
          a.worker=createWorker();
          a.worker.onmessage=({data})=>{
            if(active!==a || data?.id!==id || data?.stateKey!==stateKey || data?.protocol!==PROTOCOL) return;
            if(data.error) { finish(null,"worker-error"); return; }
            const stats=data.result?.stats;
            if(!stats || stats.evaluatorId!==EVALUATOR_ID || stats.searchId!==SEARCH_ID
              || stats.allocatedTimeMs!==budgetMs || !Number.isSafeInteger(stats.completedDepth)
              || stats.completedDepth<0 || stats.completedDepth>32 || !Number.isFinite(stats.elapsedMs)
              || stats.elapsedMs<0) { finish(null,"invalid-response"); return; }
            finish(data.result);
          };
          a.worker.onerror=event=>{event.preventDefault?.();finish(null,"worker-error");};
          a.worker.onmessageerror=()=>finish(null,"message-error");
          a.worker.postMessage({protocol:PROTOCOL,id,stateKey,state:JSON.parse(JSON.stringify(state)),budgetMs});
        } catch { finish(null,"worker-unavailable"); }
      });
    }
    return Object.freeze({request,cancel});
  }
  root.NakakamadoEndPitComputerClient=Object.freeze({createClient,PROTOCOL,AI_ID,RELEASE_ID,PUBLIC_ADOPTED,EVALUATOR_ID,SEARCH_ID,BUDGETS,moveKey});
  if(typeof module!=="undefined" && module.exports) module.exports=root.NakakamadoEndPitComputerClient;
}(typeof window!=="undefined" ? window : globalThis));
