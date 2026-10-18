"""MIT. Restore exact completed 018 bytes and replay; never calls shard/play."""
from pathlib import Path,PurePosixPath
import json,sys,hashlib,zipfile,io,tempfile,subprocess,os
root=Path(__file__).resolve().parents[2]
def sha(b):return hashlib.sha256(b).hexdigest()
def safe(n):
 p=PurePosixPath(n);assert n and not p.is_absolute() and '..' not in p.parts and '\\' not in n;return p
assert len(sys.argv)==5,'usage: reaudit.py completed-directory resultsCommit sourceCommit runId'
folder=Path(sys.argv[1]).resolve();receipt=json.loads((folder/'preservation-receipt.json').read_text())
assert receipt['newGamesDuringArchive']==0
assert receipt['sourceCommit']==sys.argv[3]
assert int(receipt['runId'])==int(sys.argv[4])
for f in folder.iterdir():
 if f.is_file():
  data=f.read_bytes();blob=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
  pinned=subprocess.check_output(['git','rev-parse',sys.argv[2]+':'+str(f.relative_to(root))],cwd=root,text=True).strip()
  assert blob==pinned
archives={}
for n,h in receipt['archives'].items():
 b=(folder/safe(n)).read_bytes();assert sha(b)==h;archives[n]=zipfile.ZipFile(io.BytesIO(b))
used=set()
with tempfile.TemporaryDirectory(prefix='balance018-reaudit-') as td:
 out=Path(td)
 for r in receipt['files']:
  parts=[]
  for p in r['pieces']:
   key=(p['archive'],p['entry']);assert key not in used;used.add(key);safe(p['entry']);b=archives[key[0]].read(key[1]);assert len(b)==p['bytes'] and sha(b)==p['sha256'];parts.append(b)
  b=b''.join(parts);assert len(b)==r['bytes'] and sha(b)==r['sha256'];(out/safe(r['file'])).write_bytes(b)
 assert used=={(n,f) for n,z in archives.items() for f in z.namelist()}
 expected=(folder/'summary.json').read_bytes();summary=json.loads(expected);assert summary['sourceCommit']==receipt['sourceCommit'];assert str(summary['runId'])==str(receipt['runId']);assert (out/'summary.json').read_bytes()==expected
 subprocess.run(['node','tools/v010-balance018/study.cjs','aggregate',str(out)],cwd=root,check=True,capture_output=True,env={k:v for k,v in os.environ.items() if k not in ['GITHUB_SHA','GITHUB_RUN_ID']})
 assert (out/'summary.json').read_bytes()==expected
 for r in receipt['files']:assert sha((out/r['file']).read_bytes())==r['sha256']
print(json.dumps({'status':'AUDITED-COMPLETE','files':len(receipt['files']),'sourceCommit':receipt['sourceCommit'],'runId':receipt['runId'],'summaryBytesMatch':True,'newGames':0,'newProofSearches':0}))
