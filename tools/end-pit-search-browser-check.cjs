"use strict";
// MIT. Real Chromium Worker/cancellation/record regression, not a strength test.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const E=require('../prototype/end-pit-engine.js'),S=require('../prototype/end-pit-rules.js');
const Q=require('../prototype/end-pit-search-transition.js').createForEngine(E),F=require('../prototype/end-pit-search-ai.js');
const {e30}=require('./end-pit-search/fixtures.cjs');
const out=process.argv[2]||'/tmp/v010-search-browser';fs.mkdirSync(out,{recursive:true});
const publicRoot=path.resolve(__dirname,'../prototype');
const report={status:'PASS',errors:[],workers:[],games:[],cancellation:false,fallback:false,widths:[]};
(async()=>{
  const server=require('node:http').createServer((req,res)=>{
    const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html',file=path.resolve(publicRoot,name);
    if(!file.startsWith(publicRoot+path.sep)){res.writeHead(403).end();return;}
    fs.readFile(file,(err,bytes)=>{if(err){res.writeHead(404).end();return;}
      res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(file)]||'text/plain'}).end(bytes);});
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const target=`http://127.0.0.1:${server.address().port}/`,browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    page.on('pageerror',e=>report.errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)report.errors.push(`HTTP ${r.status()} ${r.url()}`);});
    await page.addInitScript(()=>{
      // Accelerate only UI delays; retain real Worker clocks and 5s watchdog.
      const timer=window.setTimeout;window.setTimeout=(f,ms,...args)=>timer(f,ms<=300?0:ms,...args);
      Object.defineProperty(window,'NakakamadoSteal',{configurable:true,set(api){
        const initial=api.initialGame,apply=api.applyWithEvents;
        api.initialGame=(...a)=>{const g=initial(...a);window.testGame=g;return g;};
        api.applyWithEvents=(...a)=>{const r=apply(...a);window.testGame=r.game;return r;};
        Object.defineProperty(window,'NakakamadoSteal',{value:api,writable:true,configurable:true});
      }});
    });
    await page.goto(target);assert.equal(await page.locator('#mode option').count(),3);
    assert.equal(await page.locator('#mode').inputValue(),'search-computer');
    assert.equal(await page.locator('#difficulty').inputValue(),'hard');
    assert.equal(await page.locator('#opponent-badge').innerText(),'探索コンピューター');
    // Actual HTTP Worker, both current phases, all supported budgets.
    for(const state of [E.initialState(),e30()])for(const budgetMs of [25,75,150]) {
      const r=await page.evaluate(({state,budgetMs})=>new Promise((resolve,reject)=>{
        const q=window.NakakamadoEndPitSearchTransition.createForEngine(window.BaoEngine),w=new Worker('./end-pit-computer-worker.js');
        const timer=setTimeout(()=>{w.terminate();reject(Error('worker timeout'));},5000);
        w.onerror=e=>{clearTimeout(timer);w.terminate();reject(Error(e.message));};
        w.onmessage=e=>{clearTimeout(timer);w.terminate();resolve(e.data);};
        w.postMessage({protocol:'NAKAKAMADO-BROWSER-WORKER-V010-v1',id:1,stateKey:q.stateKey(state),state,budgetMs});
      }),{state,budgetMs});
      assert.equal(r.error,undefined);assert.ok(Q.moveVariants(state).some(m=>F.moveKey(m)===F.moveKey(r.result.move)));
      assert.equal(r.result.stats.allocatedTimeMs,budgetMs);assert.equal(r.result.stats.evaluatorId,'NAKAKAMADO-HANDCRAFT-V010-v1');
      report.workers.push({phase:state.phase,takasia:Boolean(state.takasia),budgetMs,stats:r.result.stats});
    }
    // Cancel a real active Worker while preserving setup and rejecting the reply.
    await page.evaluate(()=>{
      const Native=window.Worker;window.Worker=class {
        constructor(...a){this.native=new Native(...a);window.createdWorker=this;}
        set onmessage(fn){this.callback=fn;this.native.onmessage=e=>{this.buffered=e;};}
        set onerror(fn){this.native.onerror=fn;}
        set onmessageerror(fn){this.native.onmessageerror=fn;}
        postMessage(data){this.native.postMessage(data);}
        terminate(){window.workerTerminated=true;this.native.terminate();}
      };
    });
    await page.locator('#mode').selectOption('search-computer');await page.locator('#side').selectOption('1');
    await page.locator('#difficulty').selectOption('hard');await page.locator('#start').click();
    await page.waitForFunction(()=>Boolean(window.createdWorker?.buffered));await page.locator('#new-game').click();
    await page.evaluate(()=>window.createdWorker.callback(window.createdWorker.buffered));
    await page.waitForFunction(()=>window.workerTerminated===true);
    assert.equal(await page.locator('#setup').isVisible(),true);
    assert.equal(await page.evaluate(()=>window.testGame.history.length),0);report.cancellation=true;
    for(const side of [0,1]) {
      await page.goto(target);await page.locator('#speed').click();
      await page.locator('#mode').selectOption('search-computer');await page.locator('#side').selectOption(String(side));
      await page.locator('#difficulty').selectOption('normal');await page.locator('#start').click();
      for(let ply=0;ply<100;ply++) {
        await page.waitForFunction(side=>window.testGame.board.winner!==null||
          (window.testGame.board.player===side&&document.querySelector('#board').getAttribute('aria-busy')==='false'),side,{timeout:30000});
        if(await page.evaluate(()=>window.testGame.board.winner!==null))break;
        const pass=page.locator('#move-choices button').filter({hasText:'パス'});
        if(await pass.count())await pass.click();
        else {await page.locator('#board button:enabled').first().click();await page.locator('#move-choices button').first().click();}
      }
      await page.waitForFunction(()=>document.querySelector('#board').getAttribute('aria-busy')==='false');
      const body=await page.evaluate(()=>window.testGame);assert.notEqual(body.board.winner,null,'expected a completed development game');
      await page.getByText('棋譜の保存',{exact:true}).click();
      const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#download').click()]);
      const file=path.join(out,`search-human-${side}.json`);await download.saveAs(file);const record=JSON.parse(fs.readFileSync(file));
      assert.equal(record.version,9);assert.equal(record.rulesVersion,'0.10.0');assert.equal(record.computer.publicAdopted,true);
      assert.equal(record.computer.learnedModel,false);assert.equal(record.computer.id,'NAKAKAMADO-AI-V010-v1');
      assert.deepEqual(S.replay(record).board,record.final);
      assert.ok(record.computer.diagnostics.length>0);assert.ok(record.computer.diagnostics.every(d=>!d.fallback));
      report.games.push({humanSide:side,plies:record.history.length,adjudication:record.adjudication,
        searchMoves:record.computer.diagnostics.length,depthZero:record.computer.diagnostics.filter(d=>d.searchFallback).length});
    }
    // Worker unavailable -> the retained simple policy, with diagnostic.
    await page.goto(target);await page.evaluate(()=>{window.Worker=class {constructor(){throw Error('blocked');}};});
    await page.locator('#mode').selectOption('search-computer');await page.locator('#side').selectOption('1');await page.locator('#start').click();
    await page.waitForFunction(()=>window.testGame.history.length===1&&document.querySelector('#board').getAttribute('aria-busy')==='false');
    assert.ok((await page.locator('#opponent-badge').innerText()).includes('簡易方式で代替'));
    await page.getByText('棋譜の保存',{exact:true}).click();
    const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#download').click()]);
    const file=path.join(out,'worker-unavailable.json');await download.saveAs(file);const record=JSON.parse(fs.readFileSync(file));
    assert.equal(record.computer.diagnostics[0].fallback,'worker-unavailable');S.replay(record);report.fallback=true;
    for(const width of [320,390,432]) {
      await page.setViewportSize({width,height:844});await page.goto(target);await page.locator('#mode').selectOption('search-computer');
      assert.equal(await page.locator('#difficulty-field').isVisible(),true);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:path.join(out,`search-setup-${width}.png`),fullPage:true});report.widths.push(width);
    }
    assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
  } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
