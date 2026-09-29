// Exploratory, reproducible comparison only. The playable engine is untouched.
// node tools/fixed-pit-bulk-study.cjs summary 1000 random,noisy,greedy
// node tools/fixed-pit-bulk-study.cjs cases 1000 random 30
// node tools/fixed-pit-bulk-study.cjs case 17 random
"use strict";
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const original = require('../prototype/engine.js');
const file = path.join(__dirname, '../prototype/engine.js');
const source = fs.readFileSync(file, 'utf8');
const needle = '      state.reserve[player] -= 1;\n      setAt(state, cursor, countAt(state, cursor) + 1);';
if (source.split(needle).length !== 2) throw new Error('Engine NAMUA placement changed: review the study');
const replacement = `      const placement = state.reserve[1 - player] === 0 ? state.reserve[player] : 1;
      state.reserve[player] -= placement;
      setAt(state, cursor, countAt(state, cursor) + placement);`;
const context = {module:{exports:{}}};
vm.runInNewContext(source.replace(needle,replacement),context,{filename:'fixed-pit-engine-exploratory.js'});
const fixed = context.module.exports;
const engines = {current:original, fixed};
const INITIAL_TOTAL = 64;
const LIMIT = 400;
function rng(seed) {
  let x=seed>>>0;
  return () => { x^=x<<13; x^=x>>>17; x^=x<<5; return (x>>>0)/4294967296; };
}
function total(b) {
  return b.reserve.reduce((a,c)=>a+c,0) + b.pending.reduce((a,c)=>a+c,0)
    + b.pits.flat(2).reduce((a,c)=>a+c,0);
}
function score(b,side) {
  if (b.winner!==null) return b.winner===side?100000:-100000;
  const front=p=>b.pits[p][0].reduce((a,c)=>a+c,0);
  const all=p=>b.reserve[p]+b.pits[p].flat().reduce((a,c)=>a+c,0);
  return 2*(front(side)-front(1-side)) + all(side)-all(1-side);
}
function step(engine,b,move,steal=true) {
  const side=b.player;
  const bulk=engine===fixed && b.phase==='namua' && b.reserve[1-side]===0
    && b.reserve[side]>1 && move.type!=='pass' ? b.reserve[side]:0;
  const {state,events}=engine.applyMoveForSearch(b,move);
  const captures=events.filter(e=>e.kind==='capture').length;
  const stolen=steal && b.phase==='namua' && captures>=2 && state.reserve[1-side]>0 ? 1:0;
  if (stolen) { state.reserve[1-side]--; state.reserve[side]++; }
  if (total(state)!==INITIAL_TOTAL || state.reserve.some(x=>x<0)) {
    throw new Error(`KETE conservation or negative hand: ${total(state)}`);
  }
  // After an ended move legalMoves returns [] because winner is set. Test the
  // actual no-move rule on the same position with that flag removed.
  if (state.reason==='no-move') {
    const open=engine.clone(state);
    open.winner=null;open.reason='';
    if (engine.legalMoves(open).length!==0 || state.winner!==side) {
      throw new Error('False no-move result');
    }
  }
  return {state,bulk,stolen,captures};
}
function choose(engine,b,policy,random,steal) {
  const moves=engine.moveVariantsForSearch(b);
  if (!moves.length) throw new Error('No legal move without terminal state');
  if (moves.length===1) return moves[0];
  if (policy==='random') return moves[Math.floor(random()*moves.length)];
  const values=moves.map(move=>{
    const after=step(engine,b,move,steal).state;
    let value=score(after,b.player)+(move.type==='capture'?2:0);
    if (policy==='reply' && after.winner===null) {
      value=Math.min(...engine.moveVariantsForSearch(after)
        .map(reply=>score(step(engine,after,reply,steal).state,b.player)));
    }
    return {move,value};
  });
  const best=Math.max(...values.map(x=>x.value));
  const choice=values.filter(x=>x.value>=best-(policy==='noisy'?7:0));
  return choice[Math.floor(random()*choice.length)].move;
}
function game(seed,policy,variant,first=0,steal=true,details=false) {
  const engine=engines[variant],random=rng(seed);
  let board=engine.initialState();board.player=first;
  const m={seed,policy,variant,first,steal,plies:0,passes:0,stolen:0,
    firstZero:null,bulkMoves:0,bulkKete:0,bulkDirectNoMove:0,mtaji:false};
  const trace=[];
  while(board.winner===null && m.plies<LIMIT) {
    const before=board,move=choose(engine,before,policy,random,steal);
    const r=step(engine,before,move,steal);
    board=r.state;
    m.plies++;
    m.passes+=move.type==='pass';m.stolen+=r.stolen;
    if(r.bulk){m.bulkMoves++;m.bulkKete+=r.bulk;m.bulkDirectNoMove+=board.reason==='no-move';}
    if(m.firstZero===null && board.reserve.includes(0) && board.reserve[0]!==board.reserve[1]) {
      m.firstZero=board.reserve[0]===0?0:1;
    }
    m.mtaji ||= board.phase==='mtaji';
    if(details)trace.push({ply:m.plies,before,move,after:board,bulk:r.bulk,captures:r.captures,stolen:r.stolen});
  }
  return {...m,winner:board.winner,reason:board.reason,board,
    firstZeroWins:m.firstZero!==null && board.winner===m.firstZero,...(details?{trace}:{})};
}
function seedAt(i) {return (0x924f3aa1 + i*0x9e3779b1)>>>0;}
function summary(n,policies) {
  for(const policy of policies)for(const steal of [true,false]){
    const pair={policy,steal,n,changedWinner:0,toFirst:0,toSecond:0,seatSymmetryErrors:0};
    const results={current:[],fixed:[]};
    for(let i=0;i<n;i++){
      const seed=seedAt(i),a=game(seed,policy,'current',0,steal),b=game(seed,policy,'fixed',0,steal);
      if(!steal && JSON.stringify(a.board)!==JSON.stringify(b.board)) {
        throw new Error('No-steal control position diverged');
      }
      results.current.push(a);results.fixed.push(b);
      if(a.winner!==b.winner){pair.changedWinner++;pair[b.winner===0?'toFirst':'toSecond']++;}
      // Also verify the same starting order after exchanging SOUTH/NORTH.
      const c=game(seed,policy,'current',1,steal),d=game(seed,policy,'fixed',1,steal);
      pair.seatSymmetryErrors+=c.winner!==1-a.winner || c.reason!==a.reason;
      pair.seatSymmetryErrors+=d.winner!==1-b.winner || d.reason!==b.reason;
    }
    console.log(JSON.stringify({pair}));
    for(const variant of ['current','fixed']){
      const r=results[variant],sum=f=>r.reduce((s,x)=>s+f(x),0);
      console.log(JSON.stringify({policy,steal,variant,n,
        firstWins:sum(x=>x.winner===0),unfinished:sum(x=>x.winner===null),
        avgPlies:sum(x=>x.plies)/n,firstZero:sum(x=>x.firstZero!==null),
        firstZeroWins:sum(x=>x.firstZeroWins),noMove:sum(x=>x.reason==='no-move'),
        mtaji:sum(x=>x.mtaji),bulkGames:sum(x=>x.bulkMoves>0),
        bulkMoves:sum(x=>x.bulkMoves),bulkKete:sum(x=>x.bulkKete),
        bulkDirectNoMove:sum(x=>x.bulkDirectNoMove),avgPass:sum(x=>x.passes)/n}));
    }
  }
}
function inspectBulk(t) {
  const after=t.after,side=t.before.player,empty=1-side;
  const options=fixed.moveVariantsForSearch(t.before);
  const outcomes=options.map(move=>step(fixed,t.before,move));
  const beforeAsMtaji=fixed.clone(t.before);
  beforeAsMtaji.player=empty;beforeAsMtaji.phase='mtaji';
  const legalBefore=fixed.legalMoves(beforeAsMtaji).length;
  return {ply:t.ply,side,empty,hand:t.bulk,move:t.move,
    afterReason:after.reason,opponentMtajiMovesBefore:legalBefore,
    choices:options.length,choicesCauseNoMove:outcomes.filter(x=>x.state.reason==='no-move').length,
    choicesCauseFrontEmpty:outcomes.filter(x=>x.state.reason==='front-empty').length,
    before:t.before,after};
}
function cases(n,policy,limit) {
  const found=[];
  for(let i=0;i<n;i++){
    const g=game(seedAt(i),policy,'fixed',0,true,true);
    for(const t of g.trace)if(t.bulk && t.after.reason==='no-move'){
      const x=inspectBulk(t);
      found.push({i,seed:g.seed,...x});
      if(found.length===limit)break;
    }
    if(found.length===limit)break;
  }
  const summary={searched:n,policy,found:found.length,
    zeroAlreadyHadNoMtajiMove:found.filter(x=>x.opponentMtajiMovesBefore===0).length,
    allBulkChoicesNoMove:found.filter(x=>x.choicesCauseNoMove===x.choices).length,
    immediateResponseUnavailable:found.filter(x=>x.after.reserve[x.empty]===0).length};
  console.log(JSON.stringify({summary}));
  for(const x of found)console.log(JSON.stringify({i:x.i,seed:x.seed,ply:x.ply,
    side:x.side,hand:x.hand,move:x.move,opponentMtajiMovesBefore:x.opponentMtajiMovesBefore,
    choices:x.choices,noMoveChoices:x.choicesCauseNoMove,frontEmptyChoices:x.choicesCauseFrontEmpty,
    afterFront:x.after.pits[x.empty][0],afterBack:x.after.pits[x.empty][1]}));
}
// Bounded tactical check from the exhausted player's last non-pass choice.
// A safe option avoids an immediate loss against every legal opponent reply
// (and, if the hand has emptied, every legal reply after the forced pass).
// It makes no assertion about later optimal play.
function escapeWindow(trace,index) {
  const bulk=trace[index],empty=1-bulk.before.player;
  let last=-1;
  for(let j=index-1;j>=0;j--)if(trace[j].before.player===empty && trace[j].move.type!=='pass'){
    last=j;break;
  }
  if(last<0)return null;
  const origin=trace[last].before,moves=fixed.moveVariantsForSearch(origin);
  let safe=0;
  for(const candidate of moves){
    const after=step(fixed,origin,candidate).state;
    if(after.winner===empty){safe++;continue;}
    if(after.winner!==null)continue;
    if(after.player!==1-empty)throw new Error('Unexpected turn after own candidate');
    let danger=false;
    for(const reply of fixed.moveVariantsForSearch(after)){
      const r=step(fixed,after,reply).state;
      if(r.winner!==null){if(r.winner!==empty)danger=true;continue;}
      if(r.reserve[empty]!==0)continue;
      if(r.phase==='mtaji'){
        if(r.player===empty && fixed.legalMoves(r).length===0)danger=true;
        continue;
      }
      if(r.player!==empty)throw new Error('Expected exhausted player to pass');
      const pass=fixed.legalMoves(r);
      if(pass.length!==1 || pass[0].type!=='pass')throw new Error('Expected pass');
      const afterPass=step(fixed,r,pass[0]).state;
      for(const second of fixed.moveVariantsForSearch(afterPass)){
        const end=step(fixed,afterPass,second).state;
        if(end.winner!==null && end.winner!==empty)danger=true;
      }
    }
    if(!danger)safe++;
  }
  return {lastOwnPly:trace[last].ply,ownChoices:moves.length,safeAlternatives:safe,
    handBeforeLastMove:origin.reserve[empty]};
}
function avoid(n,policy,limit){
  const found=[];
  for(let i=0;i<n && found.length<limit;i++){
    const g=game(seedAt(i),policy,'fixed',0,true,true);
    for(let j=0;j<g.trace.length;j++){
      const t=g.trace[j];
      if(t.bulk && t.after.reason==='no-move'){
        found.push({i,bulkPly:t.ply,...escapeWindow(g.trace,j)});
        if(found.length===limit)break;
      }
    }
  }
  console.log(JSON.stringify({summary:{requested:limit,found:found.length,
    robustEscape:found.filter(x=>x.safeAlternatives>0).length,
    noRobustEscape:found.filter(x=>x.safeAlternatives===0).length}}));
  for(const x of found)console.log(JSON.stringify(x));
}
function printCase(i,policy){
  const g=game(seedAt(i),policy,'fixed',0,true,true);
  for(const t of g.trace)if(t.bulk){
    const x=inspectBulk(t);
    console.log(JSON.stringify({seedIndex:i,seed:g.seed,...x},null,2));
  }
}
if(require.main===module){
  const [mode='summary',amount='1000',arg='random,noisy,greedy',last='30']=process.argv.slice(2);
  if(mode==='summary')summary(Number(amount),arg.split(','));
  else if(mode==='cases')cases(Number(amount),arg,Number(last));
  else if(mode==='avoid')avoid(Number(amount),arg,Number(last));
  else if(mode==='case')printCase(Number(amount),arg);
  else throw new Error(`Unknown mode ${mode}`);
}
module.exports={original,fixed,step,game,seedAt,inspectBulk};
