'use strict';
const c=require('./core.cjs'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),assert=require('node:assert/strict');
const hashes=Object.fromEntries(['opening-diagnostic.js','core.cjs','../../prototype/app.js','../../prototype/next-turn-engine.js','../../prototype/steal.js'].map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,p))).digest('hex')]));
const rows=[];
for(const mobility of [false,true])for(let depth=1;depth<=8;depth++){
let nodes=0;const table=new Map();function solve(b,d){nodes++;if(b.winner!==null||d===0)return c.score(b,0,mobility);const k=d+':'+c.key(b);if(table.has(k))return table.get(k);const cs=c.children('live',b),v=cs.map(x=>solve(x.b,d-1)),value=b.player===0?Math.max(...v):Math.min(...v);table.set(k,value);return value;}
const values=c.children('live',c.E.initialState()).map(x=>({move:x.m,value:solve(x.b,depth-1)}));rows.push({mobility,depth,nodes,values});}
let rootExactValuePickChecks=0;
for(const mobility of [false,true])for(let depth=3;depth<=6;depth++)for(let seed=1;seed<=5;seed++){
 const row=rows.find(r=>r.depth===depth&&r.mobility===mobility),picked=c.choose('live',c.E.initialState(),'search'+depth+(mobility?'-mobility':''),c.rng(seed),{searchNodes:0,budgetStops:0});
 assert.equal(row.values.find(v=>JSON.stringify(v.move)===JSON.stringify(picked.m)).value,Math.max(...row.values.map(v=>v.value)));rootExactValuePickChecks++;
}
const app=fs.readFileSync(path.join(__dirname,'../../prototype/app.js'),'utf8'),start=app.indexOf('  function evaluate(board, player)'),end=app.indexOf('  function scheduleComputer()',start);assert.ok(start>=0&&end>start);
const snippet=app.slice(start,end)+'\nthis.pick=chooseComputerMove;';
function uiGame(first){const context=vm.createContext({E:c.E,S:c.S,game:c.S.initialGame()});context.variants=()=>c.S.moveVariants(context.game);context.game.board.player=first;vm.runInContext(snippet,context);const seen=new Set(),trace=[];let reason=null;
while(context.game.board.winner===null&&trace.length<400){const before=context.game.board,k=c.key(before);if(seen.has(k)){reason='repetition';break;}seen.add(k);const m=JSON.parse(JSON.stringify(context.pick()));context.game=c.S.apply(context.game,m);c.validate(context.game.board);trace.push({move:m,entry:context.game.history.at(-1),after:context.game.board});if(context.game.board.reason==='relay-limit'){reason='relay-limit';break;}}
reason ||= context.game.board.winner===null?'400-ply':context.game.board.reason;const cutoff=['repetition','relay-limit','400-ply'].includes(reason);return {first,plies:trace.length,reason,firstWon:cutoff?null:context.game.board.winner===first,nyakua:trace.reduce((a,t)=>a+t.entry.stolen,0),trace,final:context.game.board};}
const ui=[uiGame(0),uiGame(1)];assert.equal(ui[0].firstWon,ui[1].firstWon);assert.equal(ui[0].plies,ui[1].plies);for(let j=0;j<ui[0].plies;j++){const b=c.E.clone(ui[0].trace[j].after);for(const f of ['pits','reserve','nyakuaReserve','pending','houseOwned'])b[f].reverse();b.player=1-b.player;if(b.winner!==null)b.winner=1-b.winner;assert.deepEqual(b,ui[1].trace[j].after);}assert.deepEqual(c.S.replay(ui[0].trace.map(t=>t.entry)).board,ui[0].final);
const result={rules:'0.8.0',node:process.version,rootExactValuePickChecks,hashes,rootValues:rows,uiDeterministicSelfPlay:ui,uiFunctionExtractedFromProduct:true,uiMirrorStates:ui[0].plies};
const out=process.argv[2]||path.join(__dirname,'results','opening-diagnostic.json');fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({rootRows:rows.length,rootExactValuePickChecks,ui:ui.map(({trace,final,...x})=>x)}));
