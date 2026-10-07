"use strict";
// MIT. Run with a development installation of Playwright; not shipped in the ZIP.
const {chromium} = require("playwright");
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const {pathToFileURL} = require("node:url");
const fixture = require("../../tools/nyakua-continue/results/search4/anomaly-A-2-1.json");
let target = process.argv[2];
const output = process.argv[3] || "/tmp/nyakua-a-browser-check";
fs.mkdirSync(output,{recursive:true});
const report = {status:"PASS", surfaces:[], errors:[], additions:[], computerSides:[]};
(async()=>{
  let server;
  if(!target) {
    server=require("node:http").createServer((request,response)=>{
      const relative=decodeURIComponent(new URL(request.url,"http://localhost").pathname).replace(/^\//,"") || "index.html";
      const file=path.resolve(__dirname,relative);
      if(!file.startsWith(__dirname+path.sep)){response.writeHead(403).end();return;}
      fs.readFile(file,(error,bytes)=>{
        if(error){response.writeHead(404).end();return;}
        const type={".html":"text/html; charset=utf-8",".js":"text/javascript",".css":"text/css"}[path.extname(file)] || "text/plain";
        response.writeHead(200,{"Content-Type":type});response.end(bytes);
      });
    });
    await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
    target="http://127.0.0.1:"+server.address().port+"/";
  }
  const browser=await chromium.launch({headless:true});
  try {
    for (const [label,options,url] of [
      ["desktop-http",{viewport:{width:1280,height:900}},target],
      ["mobile-file",{viewport:{width:390,height:844},isMobile:true,hasTouch:true},pathToFileURL(path.join(__dirname,"index.html")).href],
    ]) {
      const page=await browser.newPage(options);
      page.on("pageerror",e=>report.errors.push(label+": "+e.message));
      page.on("response",r=>{if(r.status()>=400)report.errors.push(label+": HTTP "+r.status()+" "+r.url());});
      await page.addInitScript(()=>{
        Object.defineProperty(window,"NakakamadoSteal",{configurable:true,
          set(api){
            const initial=api.initialGame,apply=api.applyWithEvents;
            api.initialGame=(...args)=>{const g=initial(...args);window.testGame=g;return g;};
            api.applyWithEvents=(...args)=>{const r=apply(...args);window.testGame=r.game;return r;};
            Object.defineProperty(window,"NakakamadoSteal",{value:api,writable:true,configurable:true});
          }});
      });
      await page.clock.install();await page.goto(url);
      assert.equal(await page.locator("#mode option").count(),2);
      assert.ok((await page.locator(".prototype-badge").innerText()).includes("案A"));
      await page.screenshot({path:path.join(output,label+"-setup.png"),fullPage:true});
      await page.locator("#start").click();await page.locator("#speed").click();
      assert.equal(await page.locator("#board button").count(),32);
      for(let i=0;i<fixture.history.length;i++) {
        const turn=fixture.history[i],m=turn.move;
        const p=await page.evaluate(()=>window.testGame.board.player);
        const coordinate=(p===0?"S":"N")+(m.row===0?"F":"B")+(m.index+1);
        await page.locator("#board button").filter({has:page.locator("small",{hasText:new RegExp("^"+coordinate+"$")})}).click();
        const choice=await page.evaluate(move=>{
          const moves=NakakamadoSteal.moveVariants(window.testGame).filter(x=>x.row===move.row&&x.index===move.index);
          let index=moves.findIndex(x=>JSON.stringify(x)===JSON.stringify(move));
          if(index<0)index=moves.findIndex(x=>x.type===move.type&&x.direction===move.direction&&x.side===move.side&&!x.houseChoice);
          return index;
        },m);
        assert.ok(choice>=0,coordinate+" has a matching choice");
        await page.locator("#move-choices button").nth(choice).click();
        await page.clock.runFor(100000);
        const after=await page.evaluate(()=>window.testGame.board);
        assert.deepEqual(after,turn.after);
        if(turn.entry.stolen){
          const text=await page.locator("#steal-result").innerText();assert.ok(text.includes("計2個追加"));
          assert.ok(text.includes((turn.entry.endpoint.player===0?"S":"N")+(turn.entry.endpoint.row===0?"F":"B")+(turn.entry.endpoint.index+1)));
          report.additions.push({surface:label,turn:i+1,endpoint:turn.entry.endpoint});
          if(!report.surfaces.includes(label))await page.screenshot({path:path.join(output,label+"-addition.png"),fullPage:true});
        }
      }
      assert.ok((await page.locator("#status").innerText()).includes("通常の勝敗は未判定"));
      assert.equal(await page.locator("#board button:enabled").count(),0);
      const downloadPromise=page.waitForEvent("download");await page.locator("#download").click();
      const download=await downloadPromise;await download.saveAs(path.join(output,label+"-game.json"));
      assert.equal(download.suggestedFilename(),"bao-nakakamado-nyakua-a-trial-001-game.json");
      const record=JSON.parse(fs.readFileSync(path.join(output,label+"-game.json")));
      assert.equal(record.adjudication,"safety-stop");assert.equal(record.outcome.winner,null);
      assert.equal(record.history.length,40);assert.equal(record.nyakuaNextTurnThree,false);
      await page.locator("#new-game").click();assert.ok(await page.locator("#setup").isVisible());
      for(const side of [0,1]) {
        await page.locator("#mode").selectOption("computer");await page.locator("#side").selectOption(String(side));
        await page.locator("#start").click();
        if(side===0) {
          await page.locator("#board button:enabled").first().click();await page.locator("#move-choices button").first().click();
        }
        await page.clock.runFor(100000);
        assert.equal(await page.evaluate(()=>window.testGame.board.player),side);
        assert.ok(await page.locator("#board button:enabled").count()>0);
        report.computerSides.push({surface:label,humanSide:side});
        await page.locator("#new-game").click();
      }
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.goto(new URL("rules.html",url).href);assert.ok((await page.locator("h1").innerText()).includes("案A"));
      await page.goto(new URL("licenses.html",url).href);assert.ok((await page.locator("body").innerText()).includes("nkkmd"));
      report.surfaces.push(label);await page.close();
    }
    assert.deepEqual(report.errors,[]);
    fs.writeFileSync(path.join(output,"results.json"),JSON.stringify(report,null,2)+"\n");
    console.log(JSON.stringify(report));
  } finally {await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
