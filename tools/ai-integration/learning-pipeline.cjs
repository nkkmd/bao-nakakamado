"use strict";
// Development data plumbing, MIT. No model training or public AI activation.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const E=require("../../prototype/next-turn-engine.js"), Q=require("../../prototype/search-transition.js").createForEngine(E);
const F=require("../../prototype/search-ai.js"), C=require("../nyakua-three/core.cjs"), I=require("./learning-input.cjs");
const spec=require("./learning-spec.json"), clone=x=>JSON.parse(JSON.stringify(x));
const hash=x=>crypto.createHash("sha256").update(typeof x==="string"?x:JSON.stringify(x)).digest("hex");
const SOURCE_PATHS=["prototype/next-turn-engine.js","prototype/steal.js","prototype/search-transition.js",
  "prototype/search-ai.js","prototype/search-evaluator.js","tools/nyakua-three/core.cjs",
  "tools/nyakua-three/engine.cjs","prototype/bulk-engine.js",
  "tools/ai-integration/learning-input.cjs","tools/ai-integration/learning_input.py",
  "tools/ai-integration/learning-pipeline.cjs","tools/ai-integration/learning-pipeline.test.cjs",
  "tools/ai-integration/verify-learning-pilot.cjs","tools/ai-integration/learning-spec.json"];
function sources(){return Object.fromEntries(SOURCE_PATHS.map(p=>[p,hash(fs.readFileSync(path.join(__dirname,"../..",p),"utf8"))]));}
function splitFor(group,namespace=spec.pilot.namespace) {
  const bucket=parseInt(hash([spec.split.salt,namespace,group]).slice(0,8),16)%100;
  return bucket<spec.split.trainBelow?"train":bucket<spec.split.validationBelow?"validation":"final";
}
function labelFor(state,result,teacher=spec.pilot.teacher) {
  if(Q.outcome(state)!=="ongoing")return {accepted:false,reason:"non-ongoing"};
  I.validate(state);
  const st=result.stats;
  if(result.outcome!=="ongoing" || st.safetyStops!==0 || /unresolved/.test(result.scoreMeaning))return {accepted:false,reason:"safety-stop-in-search"};
  if(st.timedOut!==false || st.completedDepth!==teacher.maxDepth || !Number.isSafeInteger(st.rootScore))return {accepted:false,reason:"incomplete-depth"};
  if(result.scoreMeaning!=="completed-depth-heuristic"||Math.abs(st.rootScore)>1000000
    ||st.evaluatorId!==require("../../prototype/search-evaluator.js").ID)throw Error("Teacher identity or score range");
  if(!Q.moveVariants(state).some(m=>F.moveKey(m)===F.moveKey(result.move)))throw Error("Teacher returned illegal move");
  return {accepted:true,kind:Math.abs(st.rootScore)>100000?"finite-depth-terminal-line":"finite-depth-heuristic",
    rawScore:st.rootScore,target:Math.max(-1,Math.min(1,st.rootScore/spec.targetScale)),
    perspective:state.player,completedDepth:st.completedDepth,quiescenceDepth:teacher.quiescenceDepth,
    safetyStops:st.safetyStops,timedOut:st.timedOut,scoreMeaning:result.scoreMeaning,
    move:result.move,searchId:F.SEARCH_ID,evaluatorId:st.evaluatorId};
}
function trajectory(policy,seedIndex) {
  if(!spec.pilot.policies.includes(policy)||!Number.isSafeInteger(seedIndex)||seedIndex<0)throw Error("Trajectory policy or seed index");
  let b=E.initialState(); b.player=seedIndex%2;
  const seed=C.seedAt(seedIndex), random=[C.rng(seed^0xa341316c),C.rng(seed^0xc8013ea4)];
  const states=[b],seen=new Set(),physical=s=>JSON.stringify([s.pits,s.reserve,s.nyakuaReserve,s.houseOwned,s.player,s.phase]);
  seen.add(physical(b));let cutoff=null;
  while(Q.outcome(b)==="ongoing" && states.length-1<spec.pilot.maxPlies) {
    const p=b.player, cs=Q.moveVariants(b).map(move=>({move,next:Q.applyMove(b,move).state}));
    if(!cs.length)throw Error("Ongoing state without moves");
    let pool=cs;
    if(policy!=="random") {
      const values=cs.map(c=>policy==="reply"&&Q.outcome(c.next)==="ongoing"
        ? Math.min(...Q.moveVariants(c.next).map(m=>C.score(Q.applyMove(c.next,m).state,p)))
        : C.score(c.next,p)+(c.move.type==="capture"?2:0));
      const best=Math.max(...values);pool=cs.filter((c,i)=>values[i]>=best-(policy==="noisy"?7:0));
    }
    b=pool[Math.floor(random[p]()*pool.length)].next;states.push(b);
    if(Q.outcome(b)==="safety-stop"){cutoff="relay-limit";break;}
    if(Q.outcome(b)==="ongoing"&&seen.has(physical(b))){cutoff="repetition";break;}seen.add(physical(b));
  }
  if(Q.outcome(b)==="ongoing"&&!cutoff)cutoff="400-ply";
  return {states,seed,cutoff};
}
function makeUnit(policy,seedIndex,{analyze}={}) {
  const t=trajectory(policy,seedIndex), unitId=policy+"-"+seedIndex;
  const prefix=t.states.slice(0,spec.pilot.openingPlies+1);
  if(prefix.length<=spec.pilot.openingPlies || prefix.some(s=>Q.outcome(s)!=="ongoing"))
    return {unitId,policy,seedIndex,seed:t.seed,group:null,rows:[],rejected:[{reason:"short-opening"}],cutoff:t.cutoff};
  const group=hash(prefix.map(I.positionKey));
  const ai=analyze||F.createAI(Q,{now:()=>0}).analyzeMove;
  const plies=[...spec.pilot.samplePlies];
  if(spec.pilot.sampleLastNonTerminal)plies.push(t.states.findLastIndex(s=>Q.outcome(s)==="ongoing"));
  const rows=[],rejected=[];
  for(const ply of [...new Set(plies)].sort((a,b)=>a-b)) {
    if(ply<spec.pilot.openingPlies)continue;
    const state=t.states[ply];if(!state)continue;
    if(Q.outcome(state)!=="ongoing"){rejected.push({ply,reason:"non-ongoing"});continue;}
    const result=ai(state,spec.pilot.teacher),label=labelFor(state,result);
    if(!label.accepted){rejected.push({ply,reason:label.reason});continue;}
    rows.push({unitId,group,ply,state:clone(state),positionKey:I.positionKey(state),
      exactStateKey:Q.stateKey(state),input:I.encode(state),label});
  }
  return {unitId,policy,seedIndex,seed:t.seed,group,rows,rejected,cutoff:t.cutoff};
}
function validateUnit(u) {
  const policy=u.policy,index=u.seedIndex;
  if(!spec.pilot.policies.includes(policy)||!Number.isInteger(index)||index<spec.pilot.seedStartIndex
    ||index>=spec.pilot.seedStartIndex+spec.pilot.seedCount||u.unitId!==policy+"-"+index||u.seed!==C.seedAt(index))throw Error("Unit metadata");
  for(const r of u.rows) {
    if(r.unitId!==u.unitId||r.group!==u.group||r.ply<spec.pilot.openingPlies
      ||I.positionKey(r.state)!==r.positionKey||Q.stateKey(r.state)!==r.exactStateKey
      ||JSON.stringify(I.encode(r.state))!==JSON.stringify(r.input))throw Error("Row encoding or identity mismatch");
    const l=labelFor(r.state,{outcome:"ongoing",move:r.label.move,scoreMeaning:r.label.scoreMeaning,
      stats:{...r.label,rootScore:r.label.rawScore}},spec.pilot.teacher);
    if(JSON.stringify(l)!==JSON.stringify(r.label))throw Error("Invalid label");
  }
}
function audit(units) {
  const ids=new Set(),groups=new Map(),partitions=new Map(),all=[];
  for(const u of units) {
    validateUnit(u);if(ids.has(u.unitId))throw Error("Duplicate checkpoint unit");ids.add(u.unitId);
    if(u.group)groups.set(u.group,splitFor(u.group));
    for(const row of u.rows) {
      const split=splitFor(row.group),k=row.positionKey;
      if(!partitions.has(k))partitions.set(k,new Set());partitions.get(k).add(split);all.push({...row,split});
    }
  }
  const kept=[],quarantined=[],seen=new Set();let withinSplitDuplicates=0;
  for(const r of all.sort((a,b)=>a.unitId.localeCompare(b.unitId,"en")||a.ply-b.ply)) {
    if(partitions.get(r.positionKey).size>1){quarantined.push({unitId:r.unitId,ply:r.ply,positionSha256:hash(r.positionKey)});continue;}
    if(seen.has(r.positionKey)){withinSplitDuplicates++;continue;}seen.add(r.positionKey);kept.push(r);
  }
  const splitCounts={train:0,validation:0,final:0},coverage={namua:0,mtaji:0,north:0,south:0,
    ownReserved:0,opponentReserved:0,threePlacement:0,twoPlacement:0,reservedOnly:0,lastOrdinary:0,nearTransition:0};
  for(const r of kept) {
    const s=r.state,p=s.player;splitCounts[r.split]++;coverage[s.phase]++;coverage[p?"north":"south"]++;
    coverage.ownReserved+=s.nyakuaReserve[p]>0;coverage.opponentReserved+=s.nyakuaReserve[1-p]>0;
    coverage.threePlacement+=I.placement(s,p)===3;coverage.twoPlacement+=I.placement(s,p)===2;
    coverage.reservedOnly+=s.reserve[p]===0&&s.nyakuaReserve[p]===1;coverage.lastOrdinary+=s.reserve[p]===1;
    coverage.nearTransition+=s.phase==="namua"&&s.reserve.reduce((a,n)=>a+n,0)+s.nyakuaReserve.reduce((a,n)=>a+n,0)<=4;
  }
  const independentPartitions=new Map();
  for(const r of kept){const k=hash(I.encode(r.state));if(independentPartitions.has(k)&&independentPartitions.get(k)!==r.split)throw Error("Post-audit input leakage");independentPartitions.set(k,r.split);}
  const labelKinds=kept.reduce((a,r)=>(a[r.label.kind]=(a[r.label.kind]||0)+1,a),{});
  const saturatedLabels=kept.filter(r=>Math.abs(r.label.rawScore)>spec.targetScale).length;
  return {rows:kept,summary:{units:units.length,groups:groups.size,candidateRows:all.length,
    retainedRows:kept.length,splitCounts,quarantinedCopies:quarantined.length,
    crossSplitCollisionKeys:[...partitions.values()].filter(s=>s.size>1).length,withinSplitDuplicates,
    postAuditCrossSplitLeaks:0,coverage,labelKinds,saturatedLabels,
    rejected:units.flatMap(u=>u.rejected).reduce((a,r)=>(a[r.reason]=(a[r.reason]||0)+1,a),{}),
    cutoffs:units.reduce((a,u)=>(a[u.cutoff||"normal-terminal"]=(a[u.cutoff||"normal-terminal"]||0)+1,a),{}),
    traceSha256:hash(kept)},quarantined};
}
function runPilot(directory) {
  fs.mkdirSync(directory,{recursive:true});
  const sourceHashes=sources(),fingerprint=hash({spec,sourceHashes}),units=[];let reused=0,generated=0;
  for(const policy of spec.pilot.policies)for(let i=0;i<spec.pilot.seedCount;i++) {
    const seedIndex=spec.pilot.seedStartIndex+i,file=path.join(directory,policy+"-"+seedIndex+".json");
    let unit;
    if(fs.existsSync(file)) {
      const saved=JSON.parse(fs.readFileSync(file,"utf8"));
      if(saved.fingerprint!==fingerprint||hash(saved.unit)!==saved.sha256)throw Error("Checkpoint fingerprint or checksum mismatch: "+file);
      unit=saved.unit;validateUnit(unit);reused++;
    }else {
      unit=makeUnit(policy,seedIndex);validateUnit(unit);
      const temp=file+".tmp";fs.writeFileSync(temp,JSON.stringify({fingerprint,sha256:hash(unit),unit})+"\n");fs.renameSync(temp,file);generated++;
    }
    if(unit.unitId!==policy+"-"+seedIndex)throw Error("Checkpoint filename and unit mismatch");
    units.push(unit);
  }
  const a=audit(units);
  const result={status:"PASS",designId:spec.id,scope:"pipeline-pilot-not-training-not-strength-not-formal-holdout",
    encodingId:I.ID,inputSize:I.INPUT_SIZE,fingerprint,sourceHashes,...a.summary,checkpointReuse:{generated,reused}};
  fs.writeFileSync(path.join(directory,"pilot-dataset.json"),JSON.stringify({fingerprint,namespace:spec.pilot.namespace,rows:a.rows})+"\n");
  fs.writeFileSync(path.join(directory,"pilot-summary.json"),JSON.stringify(result,null,2)+"\n");
  return result;
}
if(require.main===module) {
  if(process.argv.length!==3)throw Error("Usage: node tools/ai-integration/learning-pipeline.cjs CHECKPOINT_DIRECTORY");
  console.log(JSON.stringify(runPilot(process.argv[2]),null,2));
}
module.exports={hash,spec,sources,splitFor,labelFor,trajectory,makeUnit,validateUnit,audit,runPilot};
