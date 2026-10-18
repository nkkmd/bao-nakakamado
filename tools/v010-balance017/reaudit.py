"""MIT. Restore exact completed 017 bytes and replay; never calls shard/play."""
from pathlib import Path,PurePosixPath
import json,sys,hashlib,zipfile,io,tempfile,subprocess
root=Path(__file__).resolve().parents[2]
def sha(b):return hashlib.sha256(b).hexdigest()
def safe(n):
 p=PurePosixPath(n);assert n and not p.is_absolute() and '..' not in p.parts and '\\' not in n;return p
folder=Path(sys.argv[1]);receipt=json.loads((folder/'preservation-receipt.json').read_text())
assert receipt['newGamesDuringArchive']==0
if len(sys.argv)>2:assert receipt['sourceCommit']==sys.argv[2]
if len(sys.argv)>3:assert int(receipt['runId'])==int(sys.argv[3])
archives={}
for n,h in receipt['archives'].items():
 b=(folder/safe(n)).read_bytes();assert sha(b)==h;archives[n]=zipfile.ZipFile(io.BytesIO(b))
used=set()
with tempfile.TemporaryDirectory(prefix='balance017-reaudit-') as td:
 out=Path(td)
 for r in receipt['files']:
  parts=[]
  for p in r['pieces']:
   key=(p['archive'],p['entry']);assert key not in used;used.add(key);safe(p['entry']);b=archives[key[0]].read(key[1]);assert len(b)==p['bytes'] and sha(b)==p['sha256'];parts.append(b)
  b=b''.join(parts);assert len(b)==r['bytes'] and sha(b)==r['sha256'];(out/safe(r['file'])).write_bytes(b)
 assert used=={(n,f) for n,z in archives.items() for f in z.namelist()}
 expected=(folder/'summary.json').read_bytes();assert (out/'summary.json').read_bytes()==expected
 subprocess.run(['node','tools/v010-balance017/study.cjs','aggregate',str(out)],cwd=root,check=True,capture_output=True)
 assert (out/'summary.json').read_bytes()==expected
 for r in receipt['files']:assert sha((out/r['file']).read_bytes())==r['sha256']
print(json.dumps({'status':'AUDITED-COMPLETE','files':len(receipt['files']),'sourceCommit':receipt['sourceCommit'],'runId':receipt['runId'],'summaryBytesMatch':True,'newGames':0,'newProofSearches':0}))
