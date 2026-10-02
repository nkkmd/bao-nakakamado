"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs');
const E=require('../prototype/next-turn-engine.js'),S=require('../prototype/steal.js').createForEngine(E);
const C=require('./nyakua-three/core.cjs');
const plain=x=>JSON.parse(JSON.stringify(x));
function game(seed,policy='random',first=0){
 const ref=C.play('three',[policy,policy],seed,first,true);let g=S.initialGame();g.board.player=first;const trace=[];
 for(const t of ref.path){const before=g.board;g=S.apply(g,t.move);assert.deepEqual(plain(g.board),plain(t.after));trace.push({before,move:t.move,after:g.board,...g.history.at(-1)});}
 return {...ref,board:g.board,history:g.history,trace};
}
if(require.main===module){const n=Number(process.argv[2]||100),summaries=[];let transitions=0,mirrors=0,replays=0;
 for(const policy of ['random','noisy','greedy','reply']){const games=[];
  for(let i=0;i<n;i++){const g=game(C.seedAt(300000+i),policy);games.push(g);assert.equal(g.passes,0);
   if(i<10){const mirrored=game(g.seed,policy,1);assert.equal(g.trace.length,mirrored.trace.length);mirrors++;
    for(let j=0;j<g.trace.length;j++){const b=E.clone(g.trace[j].after);for(const field of ['pits','reserve','nyakuaReserve','pending','houseOwned'])b[field].reverse();b.player=1-b.player;if(b.winner!==null)b.winner=1-b.winner;assert.deepEqual(b,mirrored.trace[j].after);
     const before={board:g.trace[j].before,history:[]};const moves=S.moveVariants(before),refMoves=C.children('three',before.board).map(x=>x.m);assert.deepEqual(plain(moves),plain(refMoves));
     for(const m of moves){const a=S.apply(before,m),z=S.applyWithEvents(before,m);assert.deepEqual(a,z.game);assert.deepEqual(z.events.at(-1).state,a.board);assert.deepEqual(plain(a.board),plain(C.T.advance(before.board,m).b));C.validate(a.board);transitions++;}
    }assert.deepEqual(S.replay(g.history).board,g.board);replays++;
   }
  }summaries.push({policy,...C.summarize(games)});
 }
 const result={rulesVersion:E.RULES_VERSION,mainGames:4*n,transitions,mirrorPairs:mirrors,replays,summaries};if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
module.exports={E,S,game,seedAt:C.seedAt};
