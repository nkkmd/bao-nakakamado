'use strict';
// MIT. Normal-engine read-only replay and legal enumeration; never calls AI.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),z=require('node:zlib'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {C}=require('../v010-followup/core.cjs'),M=require('../v010-balance019/manifest.json'),summary=require('../../doc/v010-balance019/completed/summary.json');
const out=fs.mkdtempSync(path.join(os.tmpdir(),'study019-frontier-'));
try{
 cp.execFileSync('python3',['-c',"import zipfile,sys,pathlib;z=zipfile.ZipFile(sys.argv[1]);d=pathlib.Path(sys.argv[2]);[(d/n).write_bytes(z.read(n)) for n in z.namelist() if n.endswith('.json.gz')]",'doc/v010-balance019/completed/original-records-001.zip',out]);
 const reports=[];
 for(const cell of M.cells){const prior=summary.cells.find(c=>c.cellId===cell.id);let selected=null;
 for(let i=0;i<4;i++){const id=cell.id+'-'+i,row=JSON.parse(z.gunzipSync(fs.readFileSync(path.join(out,id+'.json.gz'))));if(row.games[0].firstWin!==0)continue;
  const g=row.games[0];let game={board:C.E.clone(g.start),history:[]},firstFree=null,firstMultiple=null;
  for(const [j,t]of g.turns.entries()){
   assert.equal(t.before,C.Q.stateKey(game.board));const legal=C.S.moveVariants(game);assert.ok(legal.some(m=>C.Public.moveKey(m)===C.Public.moveKey(t.move)));
   if(!t.forced&&t.player===g.firstPlayer){const item={ply:j+1,stateKey:t.before,chosenMove:t.move,legalMoves:legal,legalCount:legal.length};if(!firstFree)firstFree=item;if(!firstMultiple&&legal.length>1)firstMultiple=item;}
   game=C.S.apply(game,t.move);
  }
  assert.deepEqual(game.board,g.final);assert.ok(firstFree);const original={pairId:id,seed:row.seed,stateKey:firstFree.stateKey,chosenMove:firstFree.chosenMove,legalMoves:firstFree.legalMoves,interpretation:'Read-only first free first-player decision from earliest losing seed in this cell; no additional search'};assert.deepEqual(original,prior.firstDefeatFreeDecision);
  selected={cellId:cell.id,rootGroup:cell.opening.group,third:cell.opening.id.split('-')[1],profiles:cell.profiles.map(p=>p.id),pairId:id,seed:row.seed,firstFree,firstMultiple};break;
 }
 if(selected)reports.push(selected);else assert.equal(prior.firstDefeatFreeDecision,null);
 }
 const r={status:'NORMAL-ENGINE-READONLY-LOSS-FRONTIER-MATCH',resultCommit:'5015ee1f968a3ced31a83648524b9ac0132e3369',sourceCommit:'bf6e7724b663c2918866b5c9637f6547efe7e484',manifestDigest:M.digest,cellsWithObservedDefeat:reports.length,firstFreeSingleLegal:reports.filter(x=>x.firstFree.legalCount===1).length,firstFreeMultipleLegal:reports.filter(x=>x.firstFree.legalCount>1).length,laterMultipleLegalObserved:reports.filter(x=>x.firstMultiple&&x.firstMultiple.ply>x.firstFree.ply).length,cells:reports,scope:'Earliest losing seed per cell. First free turn and earliest multi-legal first-player turn in that same replay; not all alternative continuations or a proof of their effectiveness.',newGames:0,newProofSearches:0};
 fs.writeFileSync('doc/v010-balance019/loss-frontier.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({cellsWithObservedDefeat:r.cellsWithObservedDefeat,firstFreeSingleLegal:r.firstFreeSingleLegal,firstFreeMultipleLegal:r.firstFreeMultipleLegal,laterMultipleLegalObserved:r.laterMultipleLegalObserved,newGames:0,newProofSearches:0}));
}finally{fs.rmSync(out,{recursive:true});}
