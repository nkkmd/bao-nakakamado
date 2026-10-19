"""MIT. Join preserved proof jobs to their own fixed root manifest, no search."""
import copy,gzip,hashlib,json,pathlib,zipfile
R=pathlib.Path(__file__).resolve().parents[2];D=R/'doc/v010-balance019'
def sha(b):return hashlib.sha256(b).hexdigest()
def norm(b):
 b=copy.deepcopy(b);b.pop('turn',None)
 c=copy.deepcopy(b)
 for k in ('pits','reserve','nyakuaReserve','houseOwned','pending'):c[k].reverse()
 c['player']=1-c['player']
 if c['winner'] is not None:c['winner']=1-c['winner']
 if c.get('takasia'):c['takasia']['player']=1-c['takasia']['player']
 return min(json.dumps(x,sort_keys=True,separators=(',',':')) for x in (b,c))
fields=['pits','reserve','nyakuaReserve','houseOwned','player','phase','winner','reason','pending','turn','takasia']
inv=json.loads((D/'input-inventory.json').read_text());targets={'prefix-2':inv['startKey']}
for b in inv['branches']:
 n='third-'+b['third']['direction'];targets[n]=b['stateKey']
 for i,r in enumerate(b['replies']):targets[n+'-reply-'+str(i)]=r['stateKey']
keys={norm(dict(zip(fields,json.loads(v)[3:]))):k for k,v in targets.items()}
names=['followup','certainty','gc','branch','reply','deepen','pn007','retro008','deepen009','retro010','retro011','deepen012','split013','split014','table015','partition016']
rows=[]
for i,name in enumerate(names,1):
 mp=R/f'tools/v010-{name}/manifest.json';m=json.loads(mp.read_text());roots=m.get('roots',m.get('proofRoots'));matches={r['id']:keys[norm(r['state'])] for r in roots if norm(r['state']) in keys}
 ap=R/(f'doc/v010-research-completed/study-{i:03d}/original-records-001.zip' if i<=3 else f'doc/v010-{name}/completed/original-records-001.zip')
 jobs=[]
 with zipfile.ZipFile(ap) as z:
  for n in z.namelist():
   if not n.startswith('proof-') or not n.endswith('.json.gz'):continue
   x=json.loads(gzip.decompress(z.read(n)))
   if x.get('rootId') not in matches:continue
   result=x.get('result',{});jobs.append(dict(file=n,sha256=sha(z.read(n)),rootId=x['rootId'],targetState=matches[x['rootId']],target=x.get('target'),status=result.get('status'),winner=result.get('winner'),depth=result.get('depth'),attempts=[{k:a[k] for k in ('depth','status') if k in a} for a in result.get('attempts',[])],classification='local-proof' if result.get('status')=='PROVED' else 'finite-horizon-or-budget-result-not-unbounded-proof'))
 rows.append(dict(study=f'{i:03d}',manifest=str(mp.relative_to(R)),manifestSha256=sha(mp.read_bytes()),archive=str(ap.relative_to(R)),archiveSha256=sha(ap.read_bytes()),matchedRoots=matches,jobs=jobs))
out=dict(method='Join proof rootId only within its fixed study manifest. Seat-normalized full board comparison except turn, rule compatibility inherited from fixed manifest. Separate proof and finite-horizon/budget result; no new verification or search.',studies=rows,newGames=0,newProofSearches=0)
(D/'coverage-obligations.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print(json.dumps([dict(study=r['study'],roots=r['matchedRoots'],jobs=len(r['jobs'])) for r in rows]))
