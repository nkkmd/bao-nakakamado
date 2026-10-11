'use strict';
// MIT. Frozen manifest, compressed per-pair checkpoints, audit-only aggregation.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const C=require('./core.cjs'),{atomic}=require('./run.cjs'),{summarize}=require('./stats.cjs');
const manifestPath=path.join(__dirname,'formal-manifest.json');
const extra=['tools/v010-balance/formal.cjs','tools/v010-balance/stats.cjs','tools/v010-balance/freeze.cjs',
  'tools/v010-balance/generate-search.py','tools/v010-balance/oracle.cjs','tools/v010-balance/check.test.cjs',
  '.github/workflows/v010-balance-formal.yml'];
function sourceHashes(){return {...C.fingerprint(),...Object.fromEntries(extra.map(p=>[p,C.hash(fs.readFileSync(path.join(C.root,p)))]))};}
function manifest(){const m=JSON.parse(fs.readFileSync(manifestPath));assert.equal(m.contract.id,'NAKAKAMADO-V010-FIRST-PLAYER-FORMAL-001');
  assert.deepEqual(m.sourceSha256,sourceHashes());assert.equal(m.digest,C.hash({contract:m.contract,sourceSha256:m.sourceSha256,pilot:m.pilot}));return m;}
function tasks(m){const rows=[];
  for(const profile of m.contract.profiles)for(let i=0;i<profile.pairs;i++){
    // Different profiles share seed blocks for an optional paired diagnostic.
    const seed=Number.parseInt(C.hash([m.contract.seedDomain,i]).slice(0,8),16);
    rows.push({id:`${profile.id}-${i}`,index:i,seed,profile});}
  return rows;
}
function audit(row,m,t){assert.equal(row.digest,m.digest);assert.equal(row.id,t.id);assert.equal(row.seed,t.seed);
  assert.equal(row.profile,t.profile.id);assert.equal(row.checksum,C.hash(row.games));assert.equal(row.games.length,2);
  for(const [side,g] of row.games.entries()){
    assert.equal(g.seed,t.seed);assert.equal(g.firstPlayer,side);assert.equal(g.profile,t.profile.id);C.auditGame(g);
    assert.ok(g.turns.length<=m.contract.maxPlies);
    // Reconstruct repeat detection from normal states; don't trust the stop flag.
    let board=C.E.clone(g.start),repeat=false;const seen=new Set([C.positionKey(board)]);
    for(const turn of g.turns){board=C.Q.applyMove(board,turn.move).state;
      if(C.Q.outcome(board)==='ongoing'){
        const k=C.positionKey(board);if(seen.has(k))repeat=true;seen.add(k);
      }}
    if(g.stop==='state-repeat')assert.ok(repeat);else assert.equal(repeat,false);
    if(g.stop==='ply-limit')assert.equal(g.turns.length,m.contract.maxPlies);
    for(const turn of g.turns){assert.ok(turn.stats);assert.ok(turn.stats.nodes<=t.profile.nodes);
      assert.equal(turn.stats.maxNodes,t.profile.nodes);assert.equal(turn.stats.evaluatorId,'NAKAKAMADO-HANDCRAFT-V010-v1');
      assert.equal(turn.stats.searchId,'NAKAKAMADO-BALANCE-SEARCH-V010-v1');
      if(turn.stats.completedDepth){assert.ok(turn.stats.exactRootScores);
        assert.equal(Math.max(...turn.stats.exactRootScores.map(x=>x.score)),turn.stats.rootScore);
        assert.ok(turn.stats.exactRootScores.some(x=>C.Public.moveKey(x.move)===C.Public.moveKey(turn.move)&&x.score===turn.stats.rootScore));
      }else {assert.equal(turn.stats.rootScore,null);assert.equal(turn.stats.exactRootScores,null);}
    }
  }
  // Exact deterministic research must be equivariant under seat exchange.
  assert.equal(row.games[0].trajectory,row.games[1].trajectory);
  assert.deepEqual(row.games[1].final,C.mirror(row.games[0].final));
  assert.equal(row.games[0].firstWin,row.games[1].firstWin);
}
function shard(out,shardId,m=manifest()){assert.ok(Number.isInteger(shardId)&&shardId>=0&&shardId<m.contract.shards);
  fs.mkdirSync(out,{recursive:true});const all=tasks(m),rows=all.filter((_,i)=>i%m.contract.shards===shardId);
  const mf=path.join(out,'manifest.json');if(fs.existsSync(mf))assert.deepEqual(JSON.parse(fs.readFileSync(mf)),m);else atomic(mf,m);
  let newPairs=0,reusedPairs=0;
  for(const t of rows){const file=path.join(out,t.id+'.json.gz'),marker=file+'.started';let row;
    if(fs.existsSync(file)){row=JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));audit(row,m,t);reusedPairs++;}
    else{
      if(fs.existsSync(marker))throw Error('HOLD interrupted formal pair: '+t.id);
      fs.writeFileSync(marker,JSON.stringify({id:t.id,digest:m.digest,seed:t.seed}),{flag:'wx'});
      const games=[0,1].map(first=>C.play(t.profile,t.seed,first,{maxPlies:m.contract.maxPlies}));
      row={id:t.id,digest:m.digest,seed:t.seed,profile:t.profile.id,games,checksum:C.hash(games)};audit(row,m,t);
      fs.writeFileSync(file+'.tmp',zlib.gzipSync(JSON.stringify(row),{level:9}),{flag:'wx'});fs.renameSync(file+'.tmp',file);newPairs++;
    }
    console.log(JSON.stringify({id:t.id,shardId,newPairs,reusedPairs}));
  }
  const receipt={digest:m.digest,shardId,expectedPairs:rows.length,newPairs,reusedPairs,completedPairs:rows.length,
    environment:{node:process.version,cpu:require('node:os').cpus()[0]?.model},
    files:Object.fromEntries(rows.map(t=>[t.id+'.json.gz',C.hash(fs.readFileSync(path.join(out,t.id+'.json.gz')))]))};
  const file=path.join(out,`shard-${shardId}.json`);if(fs.existsSync(file))fs.unlinkSync(file);atomic(file,receipt);return receipt;
}
function aggregate(out,m=manifest()){const rows=tasks(m),files=fs.readdirSync(out);
  assert.equal(files.filter(f=>f.endsWith('.json.gz')).length,rows.length);
  for(let shardId=0;shardId<m.contract.shards;shardId++){
    const receipt=JSON.parse(fs.readFileSync(path.join(out,`shard-${shardId}.json`)));assert.equal(receipt.digest,m.digest);
    const expected=rows.filter((_,i)=>i%m.contract.shards===shardId);assert.equal(receipt.completedPairs,expected.length);
    assert.equal(receipt.shardId,shardId);assert.equal(Object.keys(receipt.files).length,expected.length);
    for(const t of expected)assert.equal(receipt.files[t.id+'.json.gz'],C.hash(fs.readFileSync(path.join(out,t.id+'.json.gz'))));
  }
  // Stream each compressed pair; never retain the full multi-GB game corpus.
  const states=new Map(m.contract.profiles.map(p=>[p.id,{pairs:[],searchTurns:0,turns:0,depthZero:0,
    depths:[],times:[],trajectories:new Set(),firstMoves:new Map(),phaseWins:{namua:[0,0],mtaji:[0,0]},
    reasons:{},events:{nyakua:0,takasia:0},normal:0,safetyStops:0,repeats:0,plyLimits:0}]));
  for(const t of rows){const row=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(out,t.id+'.json.gz'))));audit(row,m,t);
    const a=states.get(t.profile.id);a.pairs.push(row.games.map(g=>({firstWin:g.firstWin})));
    for(const g of row.games){a.trajectories.add(g.trajectory);
      a[g.stop==='normal-terminal'?'normal':g.stop==='safety-stop'?'safetyStops':g.stop==='state-repeat'?'repeats':'plyLimits']++;
      const key=C.Public.moveKey(g.turns[0]?.move);
      if(!a.firstMoves.has(key))a.firstMoves.set(key,{games:0,firstWins:0,secondWins:0,unresolved:0});
      const opening=a.firstMoves.get(key);opening.games++;
      g.firstWin===null?opening.unresolved++:g.firstWin?opening.firstWins++:opening.secondWins++;
      a.reasons[g.final.reason||g.stop]=(a.reasons[g.final.reason||g.stop]||0)+1;
      if(g.firstWin!==null)a.phaseWins[g.final.phase][g.firstWin?0:1]++;
      for(const turn of g.turns){a.turns++;a.times.push(turn.elapsedMs);if(turn.stats){a.searchTurns++;a.depths.push(turn.stats.completedDepth);a.depthZero+=Number(turn.stats.completedDepth===0);}
        a.events.nyakua+=turn.summary.stolen;a.events.takasia+=Number(Boolean(turn.summary.takasiaAfter));}
    }
  }
  const q=(a,p)=>a.length?[...a].sort((x,y)=>x-y)[Math.ceil(a.length*p)-1]:null;
  const supplementary=m.contract.profiles.filter(p=>p.role!=='primary').length;
  const reports=m.contract.profiles.map(p=>{const a=states.get(p.id),stat=summarize(a.pairs,p.role==='primary'?.05:.05/Math.max(1,supplementary));
    const ops={games:a.pairs.length*2,turns:a.turns,searchTurns:a.searchTurns,depthZero:a.depthZero,
      medianDepth:q(a.depths,.5),p95Ms:q(a.times,.95),maxMs:a.times.reduce((x,y)=>Math.max(x,y),0),
      uniqueTrajectories:a.trajectories.size,distinctFirstMoves:a.firstMoves.size,
      normal:a.normal,safetyStops:a.safetyStops,repeats:a.repeats,plyLimits:a.plyLimits};
    return {...p,...stat,operations:ops,interpretationHold:ops.depthZero/ops.searchTurns>.01,
      firstMoves:Object.fromEntries(a.firstMoves),phaseWins:a.phaseWins,reasons:a.reasons,events:a.events};});
  const result={status:'AUDITED-COMPLETE',manifestDigest:m.digest,profiles:reports,technicalFailures:0,
    conditionsApply:'fixed evaluator, node budget and exact-tie policy; not a minimax proof'};
  const file=path.join(out,'summary.json');if(fs.existsSync(file))fs.unlinkSync(file);atomic(file,result);return result;
}
if(require.main===module){const [cmd,out,id]=process.argv.slice(2);
  if(cmd==='manifest'){const m=manifest();if(out)atomic(out,m);console.log(JSON.stringify({digest:m.digest,tasks:tasks(m).length}));}
  else if(cmd==='shard')console.log(JSON.stringify(shard(out,Number(id))));
  else if(cmd==='aggregate')console.log(JSON.stringify(aggregate(out)));
  else throw Error('manifest|shard|aggregate required');}
module.exports={manifest,sourceHashes,tasks,audit,shard,aggregate};
