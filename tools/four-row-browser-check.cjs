"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const {chromium}=require("playwright");
const Study=require("./four-row-nyakua-check.cjs");
const root=path.resolve(__dirname,"../prototype"),out=process.env.BAO_UI_OUTPUT||"/tmp/bao-four-row-ui";
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
  await page.addInitScript(()=>{const native=window.setTimeout;window.setTimeout=(fn,ms,...args)=>native(fn,0,...args);});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.getByRole("button",{name:"対局開始",exact:true}).click();
  assert.equal(await page.locator(".pit").count(),32);
  assert.equal(await page.locator("#south-hand").innerText(),"22");
  const order=await page.locator(".pit small").allTextContents();
  assert.deepEqual(order,[...[8,7,6,5,4,3,2,1].map(i=>"NB"+i),...[8,7,6,5,4,3,2,1].map(i=>"NF"+i),...[1,2,3,4,5,6,7,8].map(i=>"SF"+i),...[1,2,3,4,5,6,7,8].map(i=>"SB"+i)]);
  await page.screenshot({path:path.join(out,"desktop.png"),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"mobile layout overflows");
  await page.screenshot({path:path.join(out,"mobile.png"),fullPage:true});
  const trace=Study.game(Study.seedAt(0),"random",0,true).trace;
  let reference=Study.S.initialGame(),rearMoves=0,bulkMoves=0;
  for(const t of trace) {
   const m=t.move,coord=`${reference.board.player===0?"S":"N"}${m.row===0?"F":"B"}${m.index+1}`;
   const pit=page.locator(".pit").filter({has:page.locator("small",{hasText:new RegExp("^"+coord+"$")})});
   await pit.click();
   const candidates=Study.S.moveVariants(reference).filter(x=>x.row===m.row&&x.index===m.index);
   const i=candidates.findIndex(x=>JSON.stringify(x)===JSON.stringify(m));assert.ok(i>=0);
   await page.locator("#move-choices button").nth(i).click();
   await page.waitForFunction(()=>document.getElementById("board").getAttribute("aria-busy")==="false");
   reference=Study.S.apply(reference,m);rearMoves+=m.row===1;bulkMoves+=t.placed>1;
   const counts=await page.locator(".pit .count").allTextContents();
   for(let j=0;j<order.length;j++){const c=order[j],p=c[0]==="S"?0:1,r=c[1]==="F"?0:1;assert.equal(Number(counts[j]),reference.board.pits[p][r][Number(c.slice(2))-1]);}
   assert.equal(Number(await page.locator("#south-hand").innerText()),reference.board.reserve[0]);
   assert.equal(Number(await page.locator("#north-hand").innerText()),reference.board.reserve[1]);
  }
  assert.ok(rearMoves>0&&bulkMoves>0);assert.ok(reference.history.some(e=>e.stolen));
  const downloadPromise=page.waitForEvent("download");await page.getByRole("button",{name:"棋譜を保存",exact:true}).click();
  const download=await downloadPromise;const file=path.join(out,"game.json");await download.saveAs(file);
  const record=JSON.parse(fs.readFileSync(file));
  assert.equal(record.version,6);assert.equal(record.rulesVersion,"0.7.0");
  assert.equal(record.boardRowsPerPlayer,2);assert.equal(record.initialHand,22);assert.equal(record.totalKete,64);
  assert.equal(record.nyakuaProtectLast,true);assert.equal(record.nyakuaFixedPitBulk,true);
  assert.equal(record.sowingPath,"ring");assert.deepEqual(Study.S.replay(record.history).board,record.final);
  await page.getByRole("button",{name:"新しい対局",exact:true}).click();
  await page.locator("#mode").selectOption("computer");await page.locator("#side").selectOption("1");
  await page.evaluate(()=>{document.getElementById("start").click();document.getElementById("new-game").click();});
  assert.equal(await page.locator("#setup").isVisible(),true);
  await page.getByRole("button",{name:"対局開始",exact:true}).click();
  await page.waitForFunction(()=>document.getElementById("turn-name").textContent==="▲ NORTH"&&document.getElementById("board").getAttribute("aria-busy")==="false");
  assert.ok(await page.locator(".pit:not(:disabled)").count()>0);
  assert.deepEqual(errors,[]);
  const result={browser:browser.version(),pits:32,plies:trace.length,rearMoves,bulkMoves,downloadReplayed:true,computerAndReset:true,pageErrors:errors};
  fs.writeFileSync(path.join(out,"result.json"),JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result));
 } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
