"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const {chromium}=require("playwright");
const Study=require("./next-turn-live-check.cjs");
const root=path.resolve(__dirname,"../prototype"),out=process.env.BAO_UI_OUTPUT||"/tmp/bao-next-turn-ui";
async function main() {
 fs.mkdirSync(out,{recursive:true});
 const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
  const file=path.resolve(root,"."+(pathname==="/"?"/index.html":pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end();return;}
   res.setHeader("Content-Type",({".html":"text/html; charset=utf-8",".js":"text/javascript",".css":"text/css"})[path.extname(file)]||"text/plain");res.end(data);});
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 let browser;const errors=[];
 try {
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1000,height:1000},acceptDownloads:true});
  page.on("pageerror",e=>errors.push(e.message));
  await page.addInitScript(()=>{const native=window.setTimeout;window.setTimeout=(fn,ms,...args)=>native(fn,ms<500?0:ms,...args);});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.getByRole("button",{name:"対局開始",exact:true}).click();
  assert.equal(await page.locator(".pit").count(),32);
  assert.equal(await page.locator("#south-hand").innerText(),"22");
  const order=await page.locator(".pit small").allTextContents();
  assert.deepEqual(order,[...[8,7,6,5,4,3,2,1].map(i=>"NB"+i),...[8,7,6,5,4,3,2,1].map(i=>"NF"+i),...[1,2,3,4,5,6,7,8].map(i=>"SF"+i),...[1,2,3,4,5,6,7,8].map(i=>"SB"+i)]);
  await page.screenshot({path:path.join(out,"desktop.png"),fullPage:true});
  for(const width of [320,390,432]) {
   await page.setViewportSize({width,height:844});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), "mobile overflow at "+width);
  }
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"mobile layout overflows");
  await page.screenshot({path:path.join(out,"mobile.png"),fullPage:true});
  const trace=Study.game(Study.seedAt(0),"random",0,true).trace;
  // Exercise the optional future-search adapter in a real browser. The page
  // itself still uses the current simple computer and normal animation path.
  await page.addScriptTag({url:`http://127.0.0.1:${server.address().port}/search-transition.js`});
  const searchCheck=await page.evaluate(moves=>{
   const E=window.BaoEngine,S=window.NakakamadoSteal;
   const Q=window.NakakamadoSearchTransition.createForEngine(E);
   let b=E.initialState(),transitions=0,nyakua=0;
   const equal=(a,z)=>{if(JSON.stringify(a)!==JSON.stringify(z))throw Error("Browser search mismatch");};
   for(const played of moves){
    equal(Q.moveVariants(b),S.moveVariants({board:b,history:[]}));
    for(const m of Q.moveVariants(b)){
     const normal=S.applyWithEvents({board:b,history:[]},m),r=Q.applyMove(b,m);
     equal(r.state,normal.game.board);equal(r.summary,normal.game.history[0]);
     if(r.events.some(e=>Object.hasOwn(e,"state"))||Object.hasOwn(r,"history"))throw Error("Search retains display state");
     transitions++;nyakua+=r.summary.stolen;
    }
    b=Q.applyMove(b,played).state;
   }
   if(!nyakua)throw Error("No NYAKUA browser coverage");
   return {transitions,nyakua};
  },trace.map(t=>t.move));
  for(const file of ["search-evaluator.js","search-ai.js"]){
   await page.addScriptTag({url:`http://127.0.0.1:${server.address().port}/${file}`});
  }
  const searchStates=[Study.E.initialState(),trace.find(t=>t.before.nyakuaReserve[t.before.player]>0).before];
  const nodeAI=require("../prototype/search-ai.js").createAI(
   require("../prototype/search-transition.js").createForEngine(Study.E),{now:()=>0});
  const searchAIResults=await page.evaluate(states=>{
   const Q=window.NakakamadoSearchTransition.createForEngine(window.BaoEngine);
   const A=window.NakakamadoSearchAI.createAI(Q,{now:()=>0});
   return states.map(b=>A.analyzeMove(b,{maxDepth:3}));
  },searchStates);
  assert.deepEqual(searchAIResults,searchStates.map(b=>nodeAI.analyzeMove(b,{maxDepth:3})));
  const searchAICheck={positions:searchStates.length,completedDepth:3,nodeBrowserMatch:true};
  let reference=Study.S.initialGame(),rearMoves=0,extraMoves=0;
  for(const t of trace) {
   const m=t.move,coord=`${reference.board.player===0?"S":"N"}${m.row===0?"F":"B"}${m.index+1}`;
   const pit=page.locator(".pit").filter({has:page.locator("small",{hasText:new RegExp("^"+coord+"$")})});
   await pit.click();
   const candidates=Study.S.moveVariants(reference).filter(x=>x.row===m.row&&x.index===m.index);
   const i=candidates.findIndex(x=>JSON.stringify(x)===JSON.stringify(m));assert.ok(i>=0);
   await page.locator("#move-choices button").nth(i).click();
   await page.waitForFunction(()=>document.getElementById("board").getAttribute("aria-busy")==="false");
   reference=Study.S.apply(reference,m);rearMoves+=m.row===1;extraMoves+=t.placed>1;
   const counts=await page.locator(".pit .count").allTextContents();
   for(let j=0;j<order.length;j++){const c=order[j],p=c[0]==="S"?0:1,r=c[1]==="F"?0:1;assert.equal(Number(counts[j]),reference.board.pits[p][r][Number(c.slice(2))-1]);}
   assert.equal(Number(await page.locator("#south-hand").innerText()),reference.board.reserve[0]);
   assert.equal(Number(await page.locator("#north-hand").innerText()),reference.board.reserve[1]);
   assert.equal(Number(await page.locator("#south-nyakua").innerText()),reference.board.nyakuaReserve[0]);
   assert.equal(Number(await page.locator("#north-nyakua").innerText()),reference.board.nyakuaReserve[1]);
   if(extraMoves===0&&reference.board.nyakuaReserve.some(Boolean))await page.screenshot({path:path.join(out,"mobile-nyakua.png"),fullPage:true});
  }
  assert.ok(rearMoves>0&&extraMoves>0);assert.ok(reference.history.some(e=>e.stolen));
  await page.locator("summary").filter({hasText:"棋譜の保存"}).click();
  const [download]=await Promise.all([page.waitForEvent("download"),page.getByRole("button",{name:"棋譜を保存",exact:true}).click()]);
  const file=path.join(out,"game.json");await download.saveAs(file);
  const record=JSON.parse(fs.readFileSync(file));
  assert.equal(record.version,7);assert.equal(record.rulesVersion,"0.8.0");
  assert.equal(record.boardRowsPerPlayer,2);assert.equal(record.initialHand,22);assert.equal(record.totalKete,64);
  assert.equal(record.nyakuaProtectLast,true);assert.equal(record.nyakuaFixedPitBulk,false);
  assert.equal(record.nyakuaNextTurnThree,true);assert.equal(record.nyakuaReservedProtected,true);
  assert.equal(record.sowingPath,"ring");assert.deepEqual(Study.S.replay(record.history).board,record.final);
  await page.getByRole("button",{name:"新しい対局",exact:true}).click();
  await page.locator("#mode").selectOption("computer");await page.locator("#side").selectOption("1");
  await page.evaluate(()=>{document.getElementById("start").click();document.getElementById("new-game").click();});
  assert.equal(await page.locator("#setup").isVisible(),true);
  await page.getByRole("button",{name:"対局開始",exact:true}).click();
  await page.waitForFunction(()=>document.getElementById("turn-name").textContent==="▲ NORTH"&&document.getElementById("board").getAttribute("aria-busy")==="false");
  assert.ok(await page.locator(".pit:not(:disabled)").count()>0);
  const cycle=JSON.parse(fs.readFileSync(path.join(__dirname,"nyakua-three/results/anomalies/self-random-three-3435580265-game.json")));
  const cycleHistory=cycle.path.map(step=>step.entry);
  await page.evaluate(history=>{
   const g=window.NakakamadoSteal.replay(history);
   window.NakakamadoSteal.initialGame=()=>structuredClone(g);
  },cycleHistory.slice(0,-1));
  await page.getByRole("button",{name:"新しい対局",exact:true}).click();
  await page.locator("#mode").selectOption("local");
  await page.getByRole("button",{name:"対局開始",exact:true}).click();
  const cm=cycleHistory.at(-1).move,side=cycleHistory.at(-1).player,coord=`${side===0?"S":"N"}F${cm.index+1}`;
  await page.locator(".pit").filter({has:page.locator("small",{hasText:new RegExp("^"+coord+"$")})}).click();
  await page.locator("#move-choices button").filter({hasText:"右へ蒔く"}).click();
  assert.equal(await page.locator("#board").getAttribute("aria-busy"),"false");
  assert.match(await page.locator("#status").innerText(),/対局を停止.*勝敗は未判定/);
  const [stoppedDownload]=await Promise.all([page.waitForEvent("download"),page.getByRole("button",{name:"棋譜を保存",exact:true}).click()]);
  const stoppedFile=path.join(out,"stopped-game.json");await stoppedDownload.saveAs(stoppedFile);
  const stopped=JSON.parse(fs.readFileSync(stoppedFile));assert.equal(stopped.adjudication,"safety-stop");
  assert.deepEqual(Study.S.replay(stopped.history).board,stopped.final);
  await page.screenshot({path:path.join(out,"mobile-safety-stop.png"),fullPage:true});
  await page.goto(`http://127.0.0.1:${server.address().port}/licenses.html`);
  assert.match(await page.locator("#code-license").innerText(),/Copyright \(c\) 2026 cultivationdata.net/);
  assert.match(await page.locator("#code-license").innerText(),/探索コンピューターのWorkerだけで読み込みます/);
  assert.match(await page.locator("#text-license").innerText(),/CC BY-SA 4.0/);
  for(const width of [320,390,432,1000]){await page.setViewportSize({width,height:844});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"license page overflow at "+width);}
  await page.screenshot({path:path.join(out,"licenses.png"),fullPage:true});
  assert.deepEqual(errors,[]);
  const result={browser:browser.version(),pits:32,plies:trace.length,rearMoves,extraMoves,searchCheck,searchAICheck,downloadReplayed:true,computerAndReset:true,safetyStopAndReplay:true,licensePageChecked:true,mobileWidths:[320,390,432],pageErrors:errors};
  fs.writeFileSync(path.join(out,"result.json"),JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result));
 } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
