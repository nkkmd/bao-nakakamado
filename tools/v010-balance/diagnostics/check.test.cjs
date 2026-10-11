'use strict';
// MIT. Certificate and original trace integrity; zero new intervention games.
const fs=require('node:fs'),z=require('node:zlib'),path=require('node:path'),assert=require('node:assert/strict'),test=require('node:test');
const C=require('../core.cjs'),P=require('./proof.cjs');
const dir=path.join(__dirname,'../../../doc/v010-balance/diagnostics');
test('bounded proof certificates replay every defensive response under normal rules',()=>{
 let proved=0,unknown=0;
 for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.json.gz'))){const c=JSON.parse(z.gunzipSync(fs.readFileSync(path.join(dir,file))));
   if(c.status==='PROVED'){assert.ok(P.verify(c)>0);proved++;}else {assert.equal(c.status,'UNKNOWN');assert.ok(!c.nodes);unknown++;}}
 assert.equal(proved,3);assert.equal(unknown,2);
});
test('deleting a defensive response or falsifying the winner invalidates the proof',()=>{
 const c=JSON.parse(z.gunzipSync(fs.readFileSync(path.join(dir,'primary-8192-ply29.json.gz'))));
 assert.equal(c.target,1);assert.equal(c.nodes[c.root].children.length,2);
 const missing=C.E.clone(c);missing.nodes[missing.root].children.pop();assert.throws(()=>P.verify(missing));
 const wrong=C.E.clone(c);wrong.target=0;assert.throws(()=>P.verify(wrong));
});
test('depth sensitivity is finite search, with all exact root scores saved',()=>{
 const r=JSON.parse(fs.readFileSync(path.join(dir,'initial-depths.json')));assert.equal(r.rows.length,11);
 for(const x of r.rows){assert.equal(x.completedDepth,x.requestedDepth);assert.equal(x.exactRootScores.length,4);
   assert.equal(x.rootScore,Math.max(...x.exactRootScores.map(x=>x.score)));assert.ok(Math.abs(x.rootScore)<900000);}
});
test('all intervention records replay normally and under seat exchange, without new games',()=>{
 const bytes=require('node:child_process').execFileSync('python3',['-c',
  'import json,zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps([json.loads(z.read(n)) for n in z.namelist() if n.endswith(".json")]))',
  path.join(dir,'intervention-records.zip')],{maxBuffer:32*1024*1024});
 const rows=JSON.parse(bytes);assert.equal(rows.length,35);
 for(const row of rows){assert.equal(row.checksum,C.hash(row.game));C.auditGame(row.game);
   let b=C.mirror(row.game.start);for(const t of row.game.turns)b=C.S.apply({board:b,history:[]},t.move).board;
   assert.deepEqual(b,C.mirror(row.game.final));}
});
