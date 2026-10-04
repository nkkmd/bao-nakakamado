"use strict";
// MIT. Real-clock calibration only; no formal holdout generation or training.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os");
const E=require("../../prototype/next-turn-engine.js"),Q=require("../../prototype/search-transition.js").createForEngine(E);
const S=require("../../prototype/steal.js").createForEngine(E),F=require("../../prototype/search-ai.js");
const P=require("./learning-pipeline.cjs"),I=require("./learning-input.cjs"),spec=require("./teacher-feasibility-spec.json");
const plain=x=>JSON.parse(JSON.stringify(x)),hash=P.hash;
function tags(s) {const p=s.player,n=I.placement(s,p);return {
  reservedOnly:s.phase==="namua"&&s.reserve[p]===0&&s.nyakuaReserve[p]===1,
  twoPlacement:n===2,threePlacement:n===3,lastOrdinary:s.reserve[p]===1,
  nearTransition:s.phase==="namua"&&s.reserve.reduce((a,n)=>a+n,0)+s.nyakuaReserve.reduce((a,n)=>a+n,0)<=4,
  ownReserved:s.nyakuaReserve[p]>0,opponentReserved:s.nyakuaReserve[1-p]>0,
  namua:s.phase==="namua",mtaji:s.phase==="mtaji",north:p===1,south:p===0};}
function coverage(rows) {return Object.fromEntries(spec.selectionOrder.map(k=>[k,rows.filter(r=>tags(r.state)[k]).length]));}
function replayCertificate(row) {
  assert.ok(spec.policies.includes(row.origin.policy));
  assert.ok(Number.isInteger(row.origin.seedIndex)&&row.origin.seedIndex>=spec.seedStartIndex&&row.origin.seedIndex<spec.seedStartIndex+spec.seedCount);
  assert.equal(row.origin.seed,require("../nyakua-three/core.cjs").seedAt(row.origin.seedIndex));
  assert.equal(row.origin.first,row.origin.seedIndex%2);
  let g=S.initialGame();g.board.player=row.origin.first;
  assert.equal(row.moves.length,row.origin.ply);
  for(const m of row.moves)g=S.apply(g,m);
  assert.deepEqual(g.board,row.state,"Normal replay differs from collected state");
  I.validate(g.board);assert.equal(Q.outcome(g.board),"ongoing");
  assert.equal(hash(I.positionKey(row.state)),row.id);assert.deepEqual(I.encode(row.state),row.input);
  return g;
}
function reservedOnlyEvidence(row) {
  if(!tags(row.state).reservedOnly)return null;
  const g=replayCertificate(row),previous=g.history.at(-2),reply=g.history.at(-1),p=row.state.player;
  assert.equal(previous.player,p);assert.equal(previous.stolen,1);assert.ok(previous.captures>=2);
  assert.equal(reply.player,1-p);assert.equal(reply.stolen,0);
  let checkedVariants=0;
  for(const move of Q.moveVariants(row.state)) {
    assert.notEqual(move.type,"pass");const next=Q.applyMove(row.state,move),normal=S.apply(g,move);
    assert.deepEqual(next.state,normal.board);assert.equal(next.summary.ordinaryPlaced,0);
    assert.equal(next.summary.reservedPlaced,1);assert.equal(next.summary.placed,1);checkedVariants++;
  }
  assert.ok(checkedVariants>0);
  return {previousOwnStolen:previous.stolen,previousOwnCaptures:previous.captures,replyStolen:reply.stolen,
    currentOrdinary:0,currentProtected:1,checkedVariants,ordinaryPlaced:0,reservedPlaced:1,totalPlaced:1};
}
function certificate(candidate) {
  const {origin,states,state}=candidate,moves=[];
  for(let ply=0;ply<origin.ply;ply++) {
    const before=states[ply],after=Q.stateKey(states[ply+1]);
    const m=Q.moveVariants(before).find(m=>Q.stateKey(Q.applyMove(before,m).state)===after);
    assert.ok(m,"Missing legal replay edge");moves.push(m);
  }
  const row={id:hash(I.positionKey(state)),origin,state:plain(state),input:I.encode(state),moves};
  replayCertificate(row);row.reservedOnlyEvidence=reservedOnlyEvidence(row);return row;
}
function collectCorpus() {
  const bins=Object.fromEntries(spec.selectionOrder.map(k=>[k,[]])),regular=[],seen=new Set();
  const scannedCoverage=Object.fromEntries(spec.selectionOrder.map(k=>[k,0]));let paths=0,positions=0;
  const cutoffs={};
  for(const policy of spec.policies)for(let i=0;i<spec.seedCount;i++) {
    const seedIndex=spec.seedStartIndex+i,t=P.trajectory(policy,seedIndex);paths++;
    cutoffs[t.cutoff||"normal-terminal"]=(cutoffs[t.cutoff||"normal-terminal"]||0)+1;
    for(let ply=spec.openingPlies;ply<t.states.length;ply++) {
      const state=t.states[ply];if(Q.outcome(state)!=="ongoing")continue;I.validate(state);positions++;
      const key=I.positionKey(state);if(seen.has(key))continue;seen.add(key);
      const ts=tags(state),candidate={state,states:t.states,origin:{policy,seedIndex,seed:t.seed,first:seedIndex%2,ply}};
      for(const k of spec.selectionOrder)if(ts[k]){scannedCoverage[k]++;if(bins[k].length<spec.maxPositions)bins[k].push(candidate);}
      if(spec.regularSamplePlies.includes(ply)&&regular.length<spec.maxPositions)regular.push(candidate);
    }
  }
  const chosen=[],selected=new Set();
  const add=c=>{const key=I.positionKey(c.state);if(!selected.has(key)){chosen.push(c);selected.add(key);}};
  for(const k of spec.selectionOrder) {
    for(const c of bins[k]) {
      if(chosen.filter(x=>tags(x.state)[k]).length>=spec.minimumCoverage[k])break;
      if(chosen.length>=spec.maxPositions)break;add(c);
    }
  }
  for(const c of regular){if(chosen.length>=spec.maxPositions)break;add(c);}
  const rows=chosen.map(certificate);
  assert.equal(rows.length,spec.maxPositions,"Not enough unique positions");
  const selectedCoverage=coverage(rows);
  const missing=spec.selectionOrder.filter(k=>selectedCoverage[k]<spec.minimumCoverage[k]);
  return {id:spec.id,namespace:spec.namespace,rows,collection:{paths,positions,uniquePositions:seen.size,
    scannedCoverage,selectedCoverage,missingCoverage:missing,cutoffs,replayMismatches:0},traceSha256:hash(rows)};
}
function sourceHashes() {
  const extra=["tools/ai-integration/teacher-feasibility-spec.json","tools/ai-integration/teacher-feasibility.cjs",
    "tools/ai-integration/teacher-feasibility.test.cjs","tools/ai-integration/reserved-only-reachable-fixtures.json"];
  return {...P.sources(),...Object.fromEntries(extra.map(p=>[p,hash(fs.readFileSync(path.join(__dirname,"../..",p),"utf8"))]))};
}
function environment() {return {node:process.version,platform:process.platform,arch:process.arch,
  cpu:os.cpus()[0]?.model||"unrecorded",logicalCPUs:os.cpus().length,pythonEncodingVersion:"not-used-in-real-clock-measurement"};}
function measure(row,analyze=F.createAI(Q).analyzeMove) {
  replayCertificate(row);assert.deepEqual(row.reservedOnlyEvidence,reservedOnlyEvidence(row));
  const before=JSON.stringify(row.state),result=analyze(row.state,spec.teacher);
  assert.equal(JSON.stringify(row.state),before,"Teacher mutated input");
  assert.ok(Q.moveVariants(row.state).some(m=>F.moveKey(m)===F.moveKey(result.move)),"Illegal teacher move");
  assert.ok(Number.isFinite(result.stats.elapsedMs)&&result.stats.elapsedMs>=0);
  const label=P.labelFor(row.state,result,spec.teacher);
  return {id:row.id,origin:row.origin,tags:tags(row.state),label,result,environment:environment(),
    observedAtJST:new Date().toLocaleString("sv-SE",{timeZone:"Asia/Tokyo"})+"+09:00"};
}
function validateMeasurement(m,row) {
  assert.equal(m.id,row.id);assert.deepEqual(m.origin,row.origin);assert.deepEqual(m.tags,tags(row.state));
  assert.ok(Number.isFinite(m.result.stats.elapsedMs)&&m.result.stats.elapsedMs>=0);
  assert.ok(Q.moveVariants(row.state).some(move=>F.moveKey(move)===F.moveKey(m.result.move)));
  assert.deepEqual(m.label,P.labelFor(row.state,m.result,spec.teacher));
}
function atomic(file,value) {fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+".tmp",JSON.stringify(value)+"\n");fs.renameSync(file+".tmp",file);}
function runShard(root,shard,{corpus,analyze}={}) {
  assert.ok(Number.isInteger(shard)&&shard>=0&&shard<spec.shards);
  const data=corpus||collectCorpus(),sources=sourceHashes(),fingerprint=hash({spec,sources,trace:data.traceSha256});
  const directory=path.join(root,"shard-"+shard);fs.mkdirSync(directory,{recursive:true});
  atomic(path.join(directory,"corpus.json"),data);let reused=0,generated=0;
  for(let i=shard;i<data.rows.length;i+=spec.shards) {
    const row=data.rows[i],file=path.join(directory,row.id+".json");let measurement;
    if(fs.existsSync(file)) {
      const saved=JSON.parse(fs.readFileSync(file,"utf8"));
      assert.equal(saved.fingerprint,fingerprint,"Stale measurement fingerprint");assert.equal(hash(saved.measurement),saved.sha256,"Measurement checksum");
      measurement=saved.measurement;validateMeasurement(measurement,row);reused++;
    }else {
      measurement=measure(row,analyze);validateMeasurement(measurement,row);
      atomic(file,{fingerprint,sha256:hash(measurement),measurement});generated++;
    }
    console.log(JSON.stringify({shard,id:row.id,completedDepth:measurement.result.stats.completedDepth,
      elapsedMs:measurement.result.stats.elapsedMs,accepted:measurement.label.accepted}));
  }
  const manifest={id:spec.id,shard,shards:spec.shards,fingerprint,sources,traceSha256:data.traceSha256,
    rowIds:data.rows.filter((r,i)=>i%spec.shards===shard).map(r=>r.id),reused,generated,environment:environment()};
  atomic(path.join(directory,"manifest.json"),manifest);return manifest;
}
function distribution(values) {const v=[...values].sort((a,b)=>a-b);return {n:v.length,
  mean:v.reduce((a,n)=>a+n,0)/v.length,median:v[Math.floor((v.length-1)/2)],p95:v[Math.ceil(v.length*.95)-1],max:v.at(-1)};}
function aggregate(root,output) {
  const measurements=[],manifests=[];let corpus;
  for(let shard=0;shard<spec.shards;shard++) {
    const directory=path.join(root,"shard-"+shard),manifest=JSON.parse(fs.readFileSync(path.join(directory,"manifest.json")));
    const data=JSON.parse(fs.readFileSync(path.join(directory,"corpus.json")));assert.equal(hash(data.rows),data.traceSha256);
    assert.equal(manifest.shard,shard);assert.equal(manifest.shards,spec.shards);
    assert.equal(manifest.fingerprint,hash({spec,sources:sourceHashes(),trace:data.traceSha256}));
    assert.deepEqual(manifest.sources,sourceHashes());assert.equal(manifest.traceSha256,data.traceSha256);
    if(corpus)assert.equal(corpus.traceSha256,data.traceSha256);else corpus=data;
    assert.deepEqual(manifest.rowIds,data.rows.filter((r,i)=>i%spec.shards===shard).map(r=>r.id));
    for(const id of manifest.rowIds) {
      const saved=JSON.parse(fs.readFileSync(path.join(directory,id+".json"))),row=data.rows.find(r=>r.id===id);
      assert.equal(saved.fingerprint,manifest.fingerprint);assert.equal(hash(saved.measurement),saved.sha256);
      replayCertificate(row);assert.deepEqual(row.reservedOnlyEvidence,reservedOnlyEvidence(row));
      validateMeasurement(saved.measurement,row);measurements.push(saved.measurement);
    }
    manifests.push(manifest);
  }
  assert.equal(measurements.length,spec.maxPositions);assert.equal(new Set(measurements.map(m=>m.id)).size,measurements.length);
  const accepted=measurements.filter(m=>m.label.accepted),acceptedCoverage=coverage(corpus.rows.filter(r=>accepted.some(m=>m.id===r.id)));
  const missing=spec.selectionOrder.filter(k=>acceptedCoverage[k]<spec.minimumCoverage[k]);
  const rejectionReasons=measurements.filter(m=>!m.label.accepted).reduce((a,m)=>(a[m.label.reason]=(a[m.label.reason]||0)+1,a),{});
  const passed=accepted.length/measurements.length>=spec.decision.minimumAcceptedFraction&&missing.length===0&&corpus.collection.missingCoverage.length===0;
  const result={id:spec.id,status:passed?"FEASIBLE-FOR-NEXT-COLLECTION-STAGE":"HOLD",scope:spec.scope,
    teacher:spec.teacher,clock:spec.clock,positions:measurements.length,accepted:accepted.length,acceptedFraction:accepted.length/measurements.length,
    rejectionReasons,acceptedCoverage,missingAcceptedCoverage:missing,collection:corpus.collection,
    timeMs:distribution(measurements.map(m=>m.result.stats.elapsedMs)),acceptedTimeMs:accepted.length?distribution(accepted.map(m=>m.result.stats.elapsedMs)):null,
    completedDepths:measurements.reduce((a,m)=>(a[m.result.stats.completedDepth]=(a[m.result.stats.completedDepth]||0)+1,a),{}),
    timedOut:measurements.filter(m=>m.result.stats.timedOut).length,safetyAffected:measurements.filter(m=>m.result.stats.safetyStops>0).length,
    saturatedLabels:accepted.filter(m=>Math.abs(m.label.rawScore)>P.spec.targetScale).length,
    labelKinds:accepted.reduce((a,m)=>(a[m.label.kind]=(a[m.label.kind]||0)+1,a),{}),
    illegalMoves:0,inputMutations:0,replayMismatches:0,
    serializedAcceptedBytes:Buffer.byteLength(JSON.stringify(accepted)),sources:sourceHashes(),
    fingerprint:manifests[0].fingerprint,corpusTraceSha256:corpus.traceSha256,measurementTraceSha256:hash(measurements),manifests,measurements};
  if(output)atomic(output,result);return result;
}
if(require.main===module) {
  const [command,root,argument]=process.argv.slice(2);
  if(command==="collect"&&root)atomic(root,collectCorpus());
  else if(command==="shard"&&root&&argument!==undefined)console.log(JSON.stringify(runShard(path.resolve(root),Number(argument)),null,2));
  else if(command==="aggregate"&&root&&argument) {
    const r=aggregate(path.resolve(root),argument);const {measurements,manifests,sources,...summary}=r;console.log(JSON.stringify(summary,null,2));
  }else throw Error("Usage: teacher-feasibility.cjs collect FILE | shard DIRECTORY INDEX | aggregate DIRECTORY FILE");
}
module.exports={spec,tags,coverage,replayCertificate,reservedOnlyEvidence,certificate,collectCorpus,sourceHashes,measure,validateMeasurement,runShard,distribution,aggregate};
