'use strict';
// MIT. Complete legal first/reply registry and pinned reachable proof roots.
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),C=require('../v010-balance/core.cjs');
function openings(){const list=[{id:'reference',moves:[],startKey:C.Q.stateKey(C.E.initialState()),forced:false}];
 const first=C.Q.moveVariants(C.E.initialState());
 first.forEach((m,i)=>{const b=C.Q.applyMove(C.E.initialState(),m).state;
   C.Q.moveVariants(b).forEach((reply,j)=>{const next=C.Q.applyMove(b,reply).state;
     list.push({id:`opening-${i}-${j}`,firstIndex:i,replyIndex:j,moves:[m,reply],startKey:C.Q.stateKey(next),forced:true});});});
 return list;}
function game(profile){return JSON.parse(z.gunzipSync(fs.readFileSync(path.join(__dirname,'inputs/'+profile+'-0.json.gz')))).games[0];}
function roots(){const b=C.E.initialState(),list=[{id:'initial',state:b,path:[],scope:'initial'}];
 C.Q.moveVariants(b).forEach((m,i)=>list.push({id:'after-first-'+i,state:C.Q.applyMove(b,m).state,path:[m],scope:'after-first',firstIndex:i}));
 for(const [profile,plies] of [['primary-8192',[21,23,25,27,28,29]],['low-512',[29]],['middle-2048',[33]]]){
   const g=game(profile);for(const ply of plies){let state=C.E.clone(g.start);const moves=g.turns.slice(0,ply-1).map(t=>t.move);
     for(const m of moves)state=C.Q.applyMove(state,m).state;
     list.push({id:`${profile}-before-${ply}`,state,path:moves,scope:'reachable-trace',ply});}}
 return list;}
function traceGames(){const a=['primary-8192','low-512','middle-2048'].map(game);
 const packed=path.join(C.root,'doc/v010-balance/diagnostics/intervention-records.zip');
 const data=require('node:child_process').execFileSync('python3',['-c',
 'import json,zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps([json.loads(z.read(n))["game"] for n in z.namelist() if n.endswith(".json")]))',packed],{maxBuffer:32*1024*1024});
 return a.concat(JSON.parse(data));}
module.exports={openings,roots,traceGames};
