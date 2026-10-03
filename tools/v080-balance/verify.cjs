'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),c=require('./core.cjs'),{tasks,config}=require('./config.cjs');
const root=process.argv[2]||path.join(__dirname,'results'),plain=x=>JSON.parse(JSON.stringify(x));
function compact(g){const {final,path,...r}=g;return {...r,finalHash:crypto.createHash('sha256').update(JSON.stringify(final)).digest('hex')};}
function flip(b){const z=c.E.clone(b);for(const f of ['pits','reserve','nyakuaReserve','pending','houseOwned'])z[f].reverse();z.player=1-z.player;if(z.winner!==null)z.winner=1-z.winner;return z;}
let replays=0,mirrorStates=0,anomalies=0;const all=[];
for(const task of tasks){const dir=path.join(root,task),s=JSON.parse(fs.readFileSync(path.join(dir,'summary.json')));assert.ok(s.completed);assert.equal(s.metadata.task,task);assert.deepEqual(s.metadata.cfg,config(task));assert.equal(s.metadata.rules,'0.8.0');
 for(const [p,h] of Object.entries(s.metadata.hashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,p))).digest('hex'),h);
 const sig=crypto.createHash('sha256').update(JSON.stringify({...s.metadata,node:undefined,runId:undefined,commit:undefined})).digest('hex');assert.equal(sig,s.signature);
 if(task==='proof'){assert.ok(s.records.every(r=>['UNKNOWN','NODE_BUDGET','TIME_BUDGET'].includes(r.result)));all.push({task,...s});continue;}
 const rows=fs.readdirSync(dir).filter(p=>p.startsWith('block-')).sort().flatMap(p=>{const b=JSON.parse(fs.readFileSync(path.join(dir,p)));assert.equal(b.signature,s.signature);return b.rows;});assert.equal(rows.length,s.metadata.cfg.n);
 for(let i=0;i<rows.length;i++){assert.equal(rows[i].seedIndex,s.metadata.cfg.offset+i);assert.equal(rows[i].seed,c.seedAt(rows[i].seedIndex));assert.equal(rows[i].games.length,s.metadata.cfg.kind==='cross'?2:1);}
 const games=rows.flatMap(r=>r.games),re=c.summarize(games);for(const [k,v] of Object.entries(re))if(k!=='wilson95Pct'||s.metadata.cfg.kind!=='cross')assert.deepEqual(v,s.summary[k]);
 for(let i=0;i<rows.length;i++){if(![0,Math.floor(rows.length/2),rows.length-1].includes(i)&&rows[i].games.every(g=>g.winner!==null))continue;
 for(let j=0;j<rows[i].games.length;j++){const stored=rows[i].games[j],g=c.play('live',stored.policies,stored.seed,0,true,j===1,rows[i].opening);assert.deepEqual(compact(g),stored);replays++;if(stored.winner===null)anomalies++;
 for(const t of g.path)c.validate(t.after);assert.deepEqual(c.S.replay(g.path.map(t=>t.entry)).board,g.final);
 if(i===0&&j===0){const h=c.play('live',stored.policies,stored.seed,1,true,false,rows[i].opening);assert.equal(g.path.length,h.path.length);for(let k=0;k<g.path.length;k++){assert.deepEqual(flip(g.path[k].after),h.path[k].after);mirrorStates++;}fs.writeFileSync(path.join(dir,'example.json'),JSON.stringify(g)+'\n');}
 if(stored.winner===null)fs.writeFileSync(path.join(dir,'anomaly-'+i+'-'+j+'.json'),JSON.stringify(g)+'\n');}}
 all.push({task,...s,rows});console.log('Verified '+task);}
const verification={passed:true,replays,mirrorStates,anomalies,sourceHashesVerified:true,checkpointSignaturesVerified:true};fs.writeFileSync(path.join(root,'verification.json'),JSON.stringify(verification,null,2)+'\n');fs.writeFileSync(path.join(root,'collected.json'),JSON.stringify(all)+'\n');console.log(JSON.stringify(verification));
