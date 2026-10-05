"use strict";
// MIT. Real Chromium workers, trial UI, cancellation and version-7 replay.
const fs=require("node:fs"),path=require("node:path"),http=require("node:http"),assert=require("node:assert/strict");
const {chromium}=require("playwright");
const E=require("../../prototype/next-turn-engine.js"), S=require("../../prototype/steal.js").createForEngine(E);
const Q=require("../../prototype/search-transition.js").createForEngine(E), F=require("./frozen-model-search.cjs");
async function main(){
  const root=path.resolve(__dirname,"../../prototype"),out=process.env.BAO_WORKER_UI_OUTPUT||"/tmp/bao-worker-ui";
  fs.mkdirSync(out,{recursive:true});
  const server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,"http://localhost").pathname;
    const file=path.resolve(root,"."+(pathname==="/"?"/index.html":pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end();return;}
      res.setHeader("Content-Type",({".js":"text/javascript",".css":"text/css",".html":"text/html; charset=utf-8"})[path.extname(file)]||"text/plain");res.end(data);});
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  let browser;const errors=[];
  try{
    browser=await chromium.launch({headless:true});
    const page=await browser.newPage({viewport:{width:1000,height:1000},acceptDownloads:true});
    page.on("pageerror",e=>errors.push(e.message));
    await page.addInitScript(()=>{
      const native=window.setTimeout;window.setTimeout=(fn,ms,...args)=>native(fn,ms<500?0:ms,...args);
      const WorkerOriginal=window.Worker;window.workerEvents=[];
      window.Worker=class extends WorkerOriginal{
        constructor(...args){super(...args);window.workerEvents.push({kind:"created"});}
        terminate(){window.workerEvents.push({kind:"terminated"});super.terminate();}
      };
    });
    const url=`http://127.0.0.1:${server.address().port}/`;
    await page.goto(url);
    const rows=require("./model-search-corpus.cjs").corpus(), reference=F.createEvaluator();
    await page.addScriptTag({url:url+"browser-model.js"});
    const browserScores=await page.evaluate(async states=>{
      await window.NakakamadoBrowserModel.verifyBytes();
      const v=window.NakakamadoBrowserModel.createEvaluator();
      return states.map(s=>[v.evaluate(s,0),v.evaluate(s,1)]);
    },rows.map(r=>r.state));
    assert.deepEqual(browserScores,rows.map(r=>[reference.evaluate(r.state,0),reference.evaluate(r.state,1)]));
    const positions=[rows[0],rows.find(r=>r.tags.reservedOnly),rows.find(r=>r.tags.mtaji),rows.find(r=>r.tags.threePlacement)];
    const workerResults=await page.evaluate(async states=>{
      const q=window.NakakamadoSearchTransition.createForEngine(window.BaoEngine),c=window.NakakamadoComputerClient.createClient(q),results=[];
      for(const state of states)for(const difficulty of ["easy","normal","hard"]){
        let ticks=0;const interval=setInterval(()=>ticks++,5);
        const a=await c.request(state,difficulty);clearInterval(interval);
        results.push({...a,ticks});
      }
      c.cancel();return results;
    },positions.map(r=>r.state));
    for(let i=0;i<workerResults.length;i++){
      const a=workerResults[i],state=positions[Math.floor(i/3)].state;
      assert.equal(a.diagnostic.fallback,null);assert.ok(a.ticks>0,"Main thread remained responsive");
      assert.ok(Q.moveVariants(state).some(m=>JSON.stringify(m)===JSON.stringify(a.move)));
      assert.deepEqual(Q.applyMove(state,a.move).state,S.apply({board:state,history:[]},a.move).board);
    }
    // Deterministic cancellation before any response; a new game must stay unchanged.
    await page.locator("#mode").selectOption("search-computer");await page.locator("#side").selectOption("1");
    for(const width of [320,390,432,1000]){
      await page.setViewportSize({width,height:1000});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"trial setup overflow at "+width);
    }
    await page.screenshot({path:path.join(out,"trial-setup.png"),fullPage:true});
    await page.evaluate(()=>{
      const original=Worker.prototype.postMessage;
      window.restoreWorkerPost=()=>Worker.prototype.postMessage=original;
      Worker.prototype.postMessage=function(){};
    });
    await page.locator("#start").click();
    await page.waitForFunction(()=>window.workerEvents.filter(e=>e.kind==="created").length>=13);
    await page.locator("#new-game").click();
    await page.evaluate(()=>window.restoreWorkerPost());
    assert.equal(await page.locator("#setup").isVisible(),true);
    assert.equal(await page.locator("#turn-number").innerText(),"TURN 1");
    assert.equal(await page.locator("#board").getAttribute("aria-busy"),"false");
    const cancellations=await page.evaluate(()=>window.workerEvents.at(-1).kind);assert.equal(cancellations,"terminated");
    // Download and normally replay two complete games, with the human on each side.
    const games=[];
    for(const human of [0,1]){
      if(!(await page.locator("#setup").isVisible())) await page.locator("#new-game").click();
      await page.locator("#side").selectOption(String(human));
      await page.locator("#difficulty").selectOption(human===0?"normal":"hard");
      await page.locator("#start").click();
      let moves=0;
      for(;moves<400;moves++){
        await page.waitForFunction(()=>document.getElementById("board").getAttribute("aria-busy")==="false",null,{timeout:15000});
        const status=await page.locator("#status").innerText();
        if(/の勝ち|対局を停止/.test(status))break;
        const pits=page.locator(".pit:not(:disabled)");
        if(await pits.count())await pits.first().click();
        await page.locator("#move-choices button").first().click();
      }
      assert.ok(moves<400,"Full game finished");
      await page.locator("summary").filter({hasText:"棋譜の保存"}).evaluate(summary=>{summary.parentElement.open=true;});
      const [download]=await Promise.all([page.waitForEvent("download"),page.locator("#download").click()]);
      const file=path.join(out,`worker-game-human-${human}.json`);await download.saveAs(file);
      const record=JSON.parse(fs.readFileSync(file));
      assert.equal(record.version,7);assert.equal(record.mode,"computer");assert.equal(record.computer.publicAdopted,false);
      assert.deepEqual(S.replay(record.history).board,record.final);
      assert.ok(record.computer.diagnostics.length>0);
      assert.ok(record.computer.diagnostics.every(d=>d.fallback===null));
      games.push({human,plies:record.history.length,adjudication:record.adjudication,diagnostics:record.computer.diagnostics.length,
        searchFallbacks:record.computer.diagnostics.filter(d=>d.searchFallback).length});
      console.log(JSON.stringify({completedGame:games.at(-1)}));
    }
    // A missing worker remains playable and is explicitly recorded as a fallback.
    await page.locator("#new-game").click();
    await page.evaluate(()=>{window.Worker=class {constructor(){throw Error("Blocked worker");}};});
    await page.locator("#side").selectOption("1");await page.locator("#start").click();
    await page.waitForFunction(()=>document.getElementById("turn-name").textContent==="▲ NORTH"&&document.getElementById("board").getAttribute("aria-busy")==="false");
    assert.match(await page.locator("#opponent-badge").innerText(),/代替手/);
    assert.ok(await page.locator(".pit:not(:disabled)").count());
    assert.deepEqual(errors,[]);
    const report={status:"PASS",scope:"browser-worker-trial-not-device-or-public-adoption",browser:browser.version(),
      modelSha256:require("../../prototype/computer-client.js").MODEL_SHA256,integerPositions:rows.length,
      workerRequests:workerResults.length,budgetsMs:[25,75,150],cancelledWorker:true,games,
      fallbackPlayable:true,mobileWidths:[320,390,432],pageErrors:errors,formalRowsRead:0,publicAdopted:false};
    fs.writeFileSync(path.join(out,"result.json"),JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report));
  }catch(error){console.error(JSON.stringify({pageErrors:errors}));throw error;
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
