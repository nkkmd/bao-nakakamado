'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),c=require('./core.cjs'),ref=require('../nyakua-three/core.cjs');
let transitions=0,mirrorStates=0,replays=0,searchChecks=0;
function flip(b){const z=c.E.clone(b);for(const f of ['pits','reserve','nyakuaReserve','pending','houseOwned'])z[f].reverse();z.player=1-z.player;if(z.winner!==null)z.winner=1-z.winner;return z;}
function brute(b,p,d){if(b.winner!==null||!d)return c.score(b,p);const vs=c.children('live',b).map(x=>brute(x.b,p,d-1));return b.player===p?Math.max(...vs):Math.min(...vs);}
for(const policy of ['random','noisy','greedy','reply','search3','search4-mobility'])for(let i=0;i<6;i++){
 const seed=c.seedAt(990000+i),g=c.play('live',[policy,policy],seed,0,true),h=c.play('live',[policy,policy],seed,1,true);assert.equal(g.path.length,h.path.length);assert.equal(g.firstWon,h.firstWon);
 for(let j=0;j<g.path.length;j++){const t=g.path[j];assert.deepEqual(flip(t.after),h.path[j].after);mirrorStates++;c.validate(t.after);
 if(i<2&&j<15){const before=j?g.path[j-1].after:c.E.initialState(),cs=c.children('live',before);assert.deepEqual(cs.map(x=>x.m),c.S.moveVariants({board:before,history:[]}));
 for(const x of cs){assert.deepEqual(x.b,JSON.parse(JSON.stringify(ref.T.advance(before,x.m).b)));const z=c.S.applyWithEvents({board:before,history:[]},x.m);assert.deepEqual(z.game.board,x.b);transitions++;}
 if(j<4){const picked=c.choose('live',before,'search3',c.rng(seed),{searchNodes:0,budgetStops:0});assert.equal(brute(picked.b,before.player,2),Math.max(...cs.map(x=>brute(x.b,before.player,2))));searchChecks++;}}
 }
 assert.deepEqual(c.S.replay(g.path.map(x=>x.entry)).board,g.final);replays++;
}
const result={passed:true,rules:c.E.RULES_VERSION,transitions,mirrorStates,replays,searchChecks};console.log(JSON.stringify(result));if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');
