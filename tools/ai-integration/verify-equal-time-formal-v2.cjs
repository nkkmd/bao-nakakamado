"use strict";
// MIT. Read-only verifier; validates every frozen contract field against archived pilot records.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),V=require('./equal-time-formal-v2.cjs'),M=require('./equal-time-match.cjs');
const root=path.resolve(__dirname,'../..');
function archivedPilots(){
 const receipts=V.checkPilotArchives(),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'bao-pilot-audit-'));
 const script=`import pathlib,zipfile,stat,sys
base=pathlib.Path(sys.argv[1])
for b,p in zip([25,75,150],sys.argv[2:]):
 dest=base/('pilot-'+str(b));dest.mkdir()
 expected={'binding.json','summary.json'}|{f'pair-{i}-side-{s}.json' for i in range(4) for s in [0,1]}
 with zipfile.ZipFile(p) as z:
  assert len(z.infolist())==10 and set(z.namelist())==expected
  assert sum(x.file_size for x in z.infolist())<=8*1024*1024 and z.testzip() is None
  for x in z.infolist():
   assert not x.is_dir() and not stat.S_ISLNK(x.external_attr>>16) and not (x.flag_bits&1)
   (dest/x.filename).write_bytes(z.read(x))
`;
 try{execFileSync('python3',['-c',script,temporary,...receipts.map(r=>path.join(root,r.file))],{stdio:'pipe',timeout:30000});
  return V.auditPilots([25,75,150].map(b=>path.join(temporary,'pilot-'+b)));
 }finally{for(const d of fs.readdirSync(temporary)){const dir=path.join(temporary,d);for(const f of fs.readdirSync(dir))fs.unlinkSync(path.join(dir,f));fs.rmdirSync(dir);}fs.rmdirSync(temporary);}
}
function verifyContract(contract,manifest,summaries){assert.deepEqual(contract,V.buildContract(manifest,summaries,V.preflight()),'Frozen contract field or pilot provenance changed');return contract;}
function verify(directory,{progress=()=>{}}={}){
 const contract=JSON.parse(fs.readFileSync(path.join(directory,'contract.json'))),manifest=JSON.parse(fs.readFileSync(path.join(directory,'openings.json'))),summaries=archivedPilots();
 verifyContract(contract,manifest,summaries);const report=V.auditFrozen(directory,{regenerate:true,progress});
 return {...report,pilotGamesAudited:summaries.reduce((n,s)=>n+s.games,0),pilotStrengthScoresRead:false,
  pilotRecordsSha256:summaries.map(s=>({budgetMs:s.budgetMs,recordsSha256:s.recordsSha256})),allContractFieldsVerified:true};
}
if(require.main===module){try{assert.ok(process.argv.length===3||process.argv.length===4);const report=verify(path.resolve(process.argv[2]),{progress:x=>console.log(JSON.stringify(x))});
 if(process.argv[3]){assert.ok(!fs.existsSync(process.argv[3]));fs.writeFileSync(process.argv[3],JSON.stringify(report,null,2)+'\n');}console.log(JSON.stringify(report,null,2));}
 catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={archivedPilots,verifyContract,verify};
