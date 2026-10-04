"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const A=require('./formal-collection.cjs'),R=require('./formal-registry.cjs'),AR=require('./formal-artifact.cjs');
const F=require('../../prototype/search-ai.js'),E=require('../../prototype/next-turn-engine.js'),Q=require('../../prototype/search-transition.js').createForEngine(E);
const clone=x=>JSON.parse(JSON.stringify(x)),key=Buffer.alloc(32,37),now=F.createAI(Q,{now:()=>0}).analyzeMove;
let registry,plan;function fixture(){registry||=require('./formal-development-exclusions.json');plan||=A.prepare(registry,A.development);return {registry,plan};}
function temp(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bao-formal-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
function rehash(p){const {digest,...payload}=p;p.digest=A.hash(payload);return p;}
function zip(dir,out,extra){const result=cp.spawnSync('python3',['-c',"import pathlib,sys,zipfile; p=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2],'w'); [z.write(f,f.name) for f in sorted(p.iterdir()) if f.is_file()]; z.writestr(sys.argv[3], '{}') if len(sys.argv)>3 else None; z.close()",dir,out,...(extra?[extra]:[])],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);return fs.readFileSync(out);}
function receipt(bytes,name='formal-dev-shard-0'){return {repository:'nkkmd/bao-nakakamado',runId:123,attempt:1,headSha:'a'.repeat(40),artifactId:456,name,digest:'sha256:'+A.shaBytes(bytes)};}
const origin={repository:'nkkmd/bao-nakakamado',runId:123,attempt:1,headSha:'a'.repeat(40)};
test('registered configuration is immutable and development seeds never use the formal namespace',()=>{
 A.configCheck(A.formal);A.configCheck(A.development);const c=clone(A.formal);c.teacher.maxDepth=1;assert.throws(()=>A.configCheck(c));
 assert.notEqual(A.formal.namespace,A.development.namespace);assert.ok(A.development.seedStartIndex+A.development.seedCount<A.formal.seedStartIndex);
});
test('frozen registry detects altered hashes and sources, and excludes both known positions and opening groups',()=>{
 const {registry,plan}=fixture();R.validateRegistry(registry);const broken=clone(registry);broken.positionHashes[0]='b'.repeat(64);assert.throws(()=>R.validateRegistry(broken));
 const rows=clone(plan.rows.slice(0,3));rows.forEach(r=>r.split='validation');
 const reg={positionHashes:[rows[0].id],inputHashes:[],openingGroups:[rows[1].group]};const a=A.candidateAudit(rows,reg,A.formal);
 assert.ok(a.counts.knownPositions+a.counts.knownOpenings>=2);assert.equal(a.rows.some(r=>r.id===rows[0].id),false);
});
test('entire candidate universe is checked before capping; side-normalized duplicates across splits are all quarantined',()=>{
 const {plan}=fixture(),a=clone(plan.rows[0]),b=clone(a);b.unitId+='-second';b.group='b'.repeat(64);b.split=a.split==='train'?'validation':'train';
 const empty={positionHashes:[],inputHashes:[],openingGroups:[]};const r=A.candidateAudit([a,b],empty,{...A.development,maximumTeacherRequests:1});assert.equal(r.rows.length,0);assert.equal(r.counts.crossSplitCopies,2);
 b.split=a.split;assert.equal(A.candidateAudit([a,b],empty,A.development).rows.length,1);
});
test('candidate ordering is stable across input permutations and normal replay validates opening and seed provenance',()=>{
 const {plan,registry}=fixture();assert.deepEqual(A.roundRobin(plan.rows),A.roundRobin([...plan.rows].reverse()));A.validatePlan(plan,registry);
 for(const change of [r=>r.moves[0]={type:'pass'},r=>r.seed++,r=>r.group='b'.repeat(64),r=>r.input[0]^=1,r=>r.state.pits[0][0][0]++]){
  const row=clone(plan.rows[0]);change(row);assert.throws(()=>A.replay(row,A.development));}
});
test('authenticated sealing rejects wrong keys, payload edits, IV/tag truncation and swapped checkpoint bindings',()=>{
 const binding={purpose:'test',index:1},box=A.encrypt({marker:'private'},key,binding);assert.deepEqual(A.decrypt(box,key,binding),{marker:'private'});
 assert.throws(()=>A.decrypt(box,Buffer.alloc(32,1),binding));assert.throws(()=>A.decrypt(box,key,{...binding,index:2}));
 for(const field of ['data','tag','iv']){const b=clone(box);b[field]=Buffer.from('corrupt').toString('base64');assert.throws(()=>A.decrypt(b,key,binding));}
 assert.equal(JSON.stringify(box).includes('private'),false);
});
test('partial encrypted checkpoint resume runs only missing requests and does not replace rejected first measurements',t=>{
 const dir=temp(t),{plan,registry}=fixture();let calls=0;const analyze=(s,c)=>{calls++;const r=now(s,c);if(calls===1)r.stats.timedOut=true;return r;};
 const first=A.runShard(dir,plan,registry,key,0,{analyze,maximumNew:2,origin});assert.equal(first.generated,2);
 const resumed=A.runShard(dir,plan,registry,key,0,{analyze,origin});assert.equal(resumed.reused,2);assert.equal(calls,resumed.requested);
 const complete=A.runShard(dir,plan,registry,key,0,{analyze:()=>{throw Error('Teacher reran');},origin});assert.equal(complete.generated,0);
 const i=0,m=A.decrypt(A.read(path.join(dir,'shard-0','request-'+i+'.sealed.json')),key,A.measurementBinding(plan,i));assert.equal(m.label.accepted,false);
 const manifest=fs.readFileSync(path.join(dir,'shard-0','manifest.json'));assert.throws(()=>A.runShard(dir,plan,registry,Buffer.alloc(32,1),0,{analyze,origin}));assert.deepEqual(fs.readFileSync(path.join(dir,'shard-0','manifest.json')),manifest);
});
test('changed frozen plan or corrupted checkpoint is rejected instead of silently regenerating',t=>{
 const dir=temp(t),{plan,registry}=fixture();A.runShard(dir,plan,registry,key,0,{analyze:now,maximumNew:1,origin});
 const changed=rehash({...clone(plan),selection:{modified:true}});assert.throws(()=>A.runShard(dir,changed,registry,key,0,{analyze:now,origin}));
 const file=path.join(dir,'shard-0','request-0.sealed.json'),box=A.read(file);box.data='AAAA';A.atomic(file,box);
 assert.throws(()=>A.runShard(dir,plan,registry,key,0,{analyze:now,origin}));
});
test('terminal-line cap is applied in frozen order and never exceeds twenty percent, including tiny partitions',()=>{
 const rows=Array.from({length:10},(_,i)=>({id:i,measurement:{label:{kind:i<8?'finite-depth-terminal-line':'finite-depth-heuristic'}}}));
 assert.deepEqual(A.capTerminal(rows,.2).map(r=>r.id),[8,9]);rows.push(...[10,11].map(id=>({id,measurement:{label:{kind:'finite-depth-heuristic'}}})));
 assert.deepEqual(A.capTerminal(rows,.2).map(r=>r.id),[0,8,9,10,11]);assert.equal(A.capTerminal(rows.slice(0,8),.2).length,0);
});
test('global aggregation requires every shard, keeps final payload out of public output, and preserves existing seal',t=>{
 const dir=temp(t),{plan,registry}=fixture(),out=path.join(dir,'dataset');
 A.runShard(dir,plan,registry,key,0,{analyze:now,origin});assert.throws(()=>A.aggregate(dir,plan,registry,key,out));
 for(let i=1;i<plan.config.shards;i++)A.runShard(dir,plan,registry,key,i,{analyze:now,origin});
 const summary=A.aggregate(dir,plan,registry,key,out);assert.equal(summary.final.sealed,true);assert.equal('rows' in summary.final,false);assert.equal('coverage' in summary.final,false);
 assert.equal(fs.existsSync(path.join(out,'final.json')),false);const bytes=fs.readFileSync(path.join(out,'final.sealed.json'));
 assert.deepEqual(A.aggregate(dir,plan,registry,key,out),summary);assert.deepEqual(fs.readFileSync(path.join(out,'final.sealed.json')),bytes);
});
test('opening final requires a frozen matching model, passing fixed validation criteria and one-use gate',t=>{
 const dir=temp(t),{plan,registry}=fixture(),out=path.join(dir,'dataset');for(let i=0;i<plan.config.shards;i++)A.runShard(dir,plan,registry,key,i,{analyze:now,origin});
 const summary=A.aggregate(dir,plan,registry,key,out);assert.equal(summary.status,'READY-FOR-TRAINING-DESIGN');
 const model=path.join(dir,'model'),criteria=path.join(dir,'criteria.json'),opened=path.join(dir,'opened.json');fs.writeFileSync(model,'development-model-only');
 A.atomic(criteria,{selectionFrozen:true,passed:true,criteria:[{metric:'development-error',operator:'<=',threshold:1,observed:.5},{metric:'development-success',operator:'>=',threshold:.5,observed:.5}]});
 const gate={schema:1,planDigest:summary.planDigest,auditDigest:summary.auditDigest,finalDigest:summary.final.digest,modelSha256:A.shaBytes(fs.readFileSync(model)),validationGateSha256:A.shaBytes(fs.readFileSync(criteria)),authorizedToOpenOnce:true,frozenAtJST:'2026-10-04T23:30:00+09:00'};
 assert.throws(()=>A.openFinal(out,key,{...gate,modelSha256:'b'.repeat(64)},model,criteria,opened));assert.equal(fs.existsSync(opened),false);
 A.openFinal(out,key,gate,model,criteria,opened);assert.equal(A.hash(A.read(opened).rows),summary.final.digest);
 assert.throws(()=>A.openFinal(out,key,gate,model,criteria,path.join(dir,'opened-again.json')));
});
test('pinned artifact receipt rejects run, attempt, head, name, expiry and digest mismatches',()=>{
 const r=receipt(Buffer.from('zip')),run={id:123,run_attempt:1,head_sha:r.headSha,repository:{full_name:r.repository}},artifact={id:456,name:r.name,digest:r.digest,expired:false,workflow_run:{id:123,head_sha:r.headSha}};
 AR.checkReceipt(r,run,artifact);for(const bad of [{...run,run_attempt:2},{...run,head_sha:'b'.repeat(40)},{...run,id:124}])assert.throws(()=>AR.checkReceipt(r,bad,artifact));
 for(const bad of [{...artifact,digest:'sha256:'+'b'.repeat(64)},{...artifact,expired:true},{...artifact,name:'other'}])assert.throws(()=>AR.checkReceipt(r,run,bad));
});
test('verified ZIP restores partial encrypted checkpoints and rejects traversal, duplicate entries and changed bytes before output',t=>{
 const dir=temp(t),{plan,registry}=fixture();A.runShard(dir,plan,registry,key,0,{analyze:now,maximumNew:2,origin});
 const bytes=zip(path.join(dir,'shard-0'),path.join(dir,'good.zip')),r=receipt(bytes),destination=path.join(dir,'restored','shard-0');
 const restored=AR.restoreArchive(bytes,r,destination,plan,registry,key);assert.equal(restored.restored,2);
 const resumed=A.runShard(path.join(dir,'restored'),plan,registry,key,0,{analyze:now,origin});assert.equal(resumed.reused,2);
 for(const extra of ['../escape.json','manifest.json']){const bad=zip(path.join(dir,'shard-0'),path.join(dir,'bad.zip'),extra),target=path.join(dir,'bad-output');assert.throws(()=>AR.restoreArchive(bad,receipt(bad),target,plan,registry,key));assert.equal(fs.existsSync(target),false);}
 assert.throws(()=>AR.restoreArchive(Buffer.concat([bytes,Buffer.from('changed')]),r,path.join(dir,'changed'),plan,registry,key));
});
test('artifact download strips authorization at the signed redirect and validates immutable metadata',async()=>{
 const bytes=Buffer.from('zip'),r=receipt(bytes),calls=[];
 const run={id:123,run_attempt:1,head_sha:r.headSha,repository:{full_name:r.repository}},artifact={id:456,name:r.name,digest:r.digest,expired:false,workflow_run:{id:123,head_sha:r.headSha}};
 const fetchImpl=async(url,options)=>{calls.push({url,options});if(url.endsWith('/runs/123/attempts/1'))return{status:200,json:async()=>run};if(url.endsWith('/artifacts/456'))return{status:200,json:async()=>artifact};
  if(url.endsWith('/zip'))return{status:302,headers:{get:()=> 'https://signed.example/archive'}};return{status:200,arrayBuffer:async()=>bytes};};
 assert.deepEqual(await AR.downloadPinned(r,{fetchImpl,token:'development-token'}),bytes);assert.equal(calls.at(-1).options.headers,undefined);assert.equal(calls[0].options.headers.Authorization,'Bearer development-token');
});

test('insufficient strata stop at candidate preflight before any real teacher request',()=>{
 const {plan}=fixture(),good=A.candidateGates(plan);assert.equal(good.status,'CANDIDATES-SUFFICIENT-FOR-TEACHER');
 const insufficient={...clone(plan),config:A.formal};const result=A.candidateGates(insufficient);assert.equal(result.status,'HOLD-BEFORE-TEACHER');
 assert.equal(result.teacherRequestsExecuted,0);assert.equal('rows' in result.final,false);assert.equal('coverage' in result.final,false);
});
