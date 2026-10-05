"use strict";
// MIT. Current-position validation and cancellation for trial browser search.
(function(root) {
  const PROTOCOL = "NAKAKAMADO-BROWSER-WORKER-v1";
  const MODEL_SHA256 = "f74175fbaa6f2d6a82148cf5e106da7291f396b2b38cb79866dc641b2147254d";
  const BUDGETS = Object.freeze({easy:25, normal:75, hard:150});
  const moveKey = m => JSON.stringify([m?.type,m?.phase,m?.row,m?.index,m?.direction,m?.side,m?.houseChoice,Boolean(m?.houseTwo)]);
  function createClient(Q, {createWorker=()=>new root.Worker("./computer-worker.js?v=browser-v1"),
    setTimer=(f,ms)=>root.setTimeout(f,ms), clearTimer=id=>root.clearTimeout(id)}={}) {
    let active=null, nextId=0;
    function cancel() {
      if (!active) return;
      const a=active; active=null; clearTimer(a.timer); a.worker?.terminate(); a.resolve(null);
    }
    function request(state, difficulty="hard") {
      cancel();
      if (!Object.hasOwn(BUDGETS,difficulty)) throw Error("Invalid trial difficulty");
      const stateKey=Q.stateKey(state), legal=Q.moveVariants(state);
      if (Q.outcome(state)!=="ongoing" || !legal.length) return Promise.resolve(null);
      const id=++nextId, budgetMs=BUDGETS[difficulty];
      return new Promise(resolve=>{
        const a={id,stateKey,resolve,worker:null,timer:null}; active=a;
        function finish(result,reason=null) {
          if(active!==a) return;
          const move=reason ? legal[0] : legal.find(m=>moveKey(m)===moveKey(result?.move));
          if (!move && !reason) { finish(null,"invalid-move"); return; }
          active=null; clearTimer(a.timer); a.worker?.terminate();
          resolve({move:{...move},diagnostic:{protocol:PROTOCOL,requestId:id,stateKey,
            modelSha256:MODEL_SHA256,difficulty,budgetMs,fallback:reason,
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
            if(data.modelSha256!==MODEL_SHA256 || !stats || stats.evaluatorId!=="NAKAKAMADO-FROZEN-LINEAR-2026100401-v1"
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
  root.NakakamadoComputerClient=Object.freeze({createClient,PROTOCOL,MODEL_SHA256,BUDGETS,moveKey});
  if(typeof module!=="undefined" && module.exports) module.exports=root.NakakamadoComputerClient;
}(typeof window!=="undefined" ? window : globalThis));
