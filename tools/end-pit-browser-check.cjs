"use strict";
// MIT. Run with a development installation of Playwright; not shipped in the ZIP.
const {chromium} = require("playwright");
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const {pathToFileURL} = require("node:url");
const publicRoot=path.resolve(__dirname,"../prototype");
let target = process.argv[2];
const output = process.argv[3] || "/tmp/bao-v010-browser-check";
fs.mkdirSync(output,{recursive:true});
const report = {status:"PASS", surfaces:[], errors:[], computerSides:[], takasiaChecks:[], records:[]};
(async()=>{
  let server;
  if(!target) {
    server=require("node:http").createServer((request,response)=>{
      const relative=decodeURIComponent(new URL(request.url,"http://localhost").pathname).replace(/^\//,"") || "index.html";
      const file=path.resolve(publicRoot,relative);
      if(!file.startsWith(publicRoot+path.sep)){response.writeHead(403).end();return;}
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
      ...[320,390,432].map(width=>["mobile-file-"+width,{viewport:{width,height:844},isMobile:true,hasTouch:true},pathToFileURL(path.join(publicRoot,"index.html")).href]),
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
      assert.equal(await page.locator("#mode option").count(),3);
      assert.equal(await page.locator(".prototype-badge").innerText(),"試作 v0.10.0");
      await page.locator("#about summary").click();
      const about=await page.locator("#about .rules").innerText();
      assert.ok(about.includes("Bao la Kiswahili をベースに"));
      assert.ok(about.includes("独自ルールの NYAKUA"));
      assert.ok(about.includes("takasia"));
      await page.screenshot({path:path.join(output,label+"-about.png"),fullPage:true});
      await page.locator("#about summary").click();
      await page.locator("#speed").click();

      // Standard local move, then verify the v0.10.0 record surface.
      await page.locator("#start").click();
      assert.equal(await page.locator("#board button").count(),32);
      await page.locator("#board button:enabled").first().click();
      await page.locator("#move-choices button").first().click();
      await page.clock.runFor(100000);
      if(!await page.locator("details").filter({has:page.locator("#download")}).evaluate(el=>el.open))
        await page.getByText("棋譜の保存",{exact:true}).click();
      const [download]=await Promise.all([page.waitForEvent("download"),page.locator("#download").click()]);
      const saved=path.join(output,label+"-game.json");await download.saveAs(saved);
      assert.equal(download.suggestedFilename(),"bao-nakakamado-v0.10.0-game.json");
      const record=JSON.parse(fs.readFileSync(saved));
      assert.equal(record.version,9);assert.equal(record.rulesVersion,"0.10.0");assert.equal(record.takasia,true);
      assert.equal(record.baseRulesRevision,"BAO-RULES-V0.2.0-TAKASIA-001");
      report.records.push({surface:label,version:record.version,rulesVersion:record.rulesVersion});

      // Inject the published E30 position with an active target. The browser must
      // expose the state, refuse the target as a start, and execute a stop path.
      await page.locator("#new-game").click();
      const takasiaResult=await page.evaluate(()=>{
        const E=window.BaoEngine,S=window.NakakamadoSteal;
        const state={pits:[[[0,2,0,0,1,1,0,0],[0,0,2,2,0,2,6,4]],[[1,0,1,2,10,0,0,10],[2,2,8,4,1,2,1,0]]],
          reserve:[0,0],nyakuaReserve:[0,0],houseOwned:[false,false],player:1,phase:"mtaji",winner:null,reason:"",turn:2,pending:[0,0],takasia:{player:1,index:3}};
        S.initialGame=()=>({board:E.clone(state),history:[]});
        const moves=E.legalMoves(state);
        const targetStart=moves.some(m=>m.type==="takata"&&m.row===E.FRONT&&m.index===3);
        const stop=moves.map(m=>E.applyMove(state,m)).find(r=>r.events.some(e=>e.kind==="takasia"&&e.action==="stop"));
        return {targetStart,hasStop:Boolean(stop),moves:moves.length};
      });
      assert.equal(takasiaResult.targetStart,false);assert.equal(takasiaResult.hasStop,true);assert.ok(takasiaResult.moves>0);
      await page.locator("#start").click();
      assert.ok((await page.locator("#status").innerText()).includes("TAKASIA対象"));
      const targetButton=page.locator("#board button").filter({has:page.locator("small",{hasText:/^NF4$/})});
      assert.equal(await targetButton.isDisabled(),true);
      report.takasiaChecks.push({surface:label,target:"NF4",hasStop:true});
      await page.locator("#new-game").click();

      // Reload to restore the standard initialGame, then verify simple computer on both sides.
      await page.goto(url);await page.clock.install().catch(()=>{});await page.locator("#speed").click();
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
      await page.goto(new URL("rules.html",url).href);assert.ok((await page.locator("h1").innerText()).includes("Bao Nakakamado"));
      await page.goto(new URL("licenses.html",url).href);assert.ok((await page.locator("body").innerText()).includes("nkkmd"));
      report.surfaces.push(label);await page.close();
    }
    assert.deepEqual(report.errors,[]);
    fs.writeFileSync(path.join(output,"results.json"),JSON.stringify(report,null,2)+"\n");
    console.log(JSON.stringify(report));
  } finally {await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
