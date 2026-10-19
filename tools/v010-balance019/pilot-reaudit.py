"""MIT. Independent pinned-byte and Python raw pilot aggregation; no play/search."""
from pathlib import Path
import collections,gzip,hashlib,json,math,subprocess
R=Path(__file__).resolve().parents[2];D=R/'doc/v010-balance019';P=D/'pilot'
SOURCE='3128eca1559eef22f11324f20cd603e40851ff5c';RESULT='b3d70ec22bad2ec710e7c1c7adf2ff815b6c6608';RUN='39225245641'
def sha(b):return hashlib.sha256(b).hexdigest()
def jhash(x):return sha(json.dumps(x,separators=(',',':'),ensure_ascii=False).encode())
def git(*a):return subprocess.check_output(['git',*a],cwd=R)
files={}
for p in sorted(P.iterdir()):
 assert p.is_file();b=p.read_bytes();rel=str(p.relative_to(R));blob=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest();assert git('rev-parse',RESULT+':'+rel).decode().strip()==blob;files[p.name]=sha(b)
assert len(files)==469
summary=json.loads((P/'pilot.json').read_text());assert summary['gamesVerified']==312;assert summary['sourceCommit']==SOURCE and str(summary['runId'])==RUN
inventory=json.loads((D/'task-inventory.json').read_text());expected=inventory['pilotSeeds'];assert len(expected)==156
assert len({x['seed'] for x in expected})==156
formal={x['seed'] for x in inventory['formalSeeds']};prior=set(json.loads((D/'coverage-receipt.json').read_text())['gameSeeds']);assert not (formal&prior)
assert all(x['seed'] not in formal|prior for x in expected)
fields=['type','phase','row','index','direction','side','houseChoice','houseTwo'];metrics=[];verified_sources={}
for x in expected:
 i=x['cell'];f=f'pilot-{i}.json.gz';raw=(P/f).read_bytes();row=json.loads(gzip.decompress(raw));rec=json.loads((P/f'pilot-receipt-{i}.json').read_text())
 assert rec['sourceCommit']==SOURCE and str(rec['runId'])==RUN;assert rec['sha256']==sha(raw)
 for name,h in rec['sources'].items():
  if name not in verified_sources:verified_sources[name]=sha(git('show',SOURCE+':'+name))
  assert verified_sources[name]==h
 assert row['classification']=='OPERATIONAL-NOT-FORMAL';assert row['cell']['id']==x['id'];assert row['seed']==x['seed']==int(jhash(['BALANCE019-OPERATIONAL-PILOT-20261019-v1',x['id']])[:8],16)
 assert len(row['games'])==2
 a,b=row['games'];assert a['firstPlayer']==0 and b['firstPlayer']==1
 traces=[];stops=collections.Counter();depth0=0;searches=0;nodes=0;turns=0
 for g in row['games']:
  assert g['seed']==x['seed'];assert g['openingId']==row['cell']['opening']['id'];assert g['profile']=='/'.join(p['id'] for p in row['cell']['profiles']);assert g['start']['player']==g['firstPlayer']
  seq=[[t['move'].get(k) for k in fields] for t in g['turns']];assert g['trajectory']==jhash(seq);traces.append(seq)
  assert g['stop']=='normal-terminal' and g['final']['winner'] in (0,1);assert g['firstWin']==int(g['final']['winner']==g['firstPlayer']);stops[g['stop']]+=1
  prefix=row['cell']['opening']['moves'];assert len(g['turns'])>len(prefix)
  for j,t in enumerate(g['turns']):
   turns+=1;assert t['forced']==(j<len(prefix));role=int(t['player']!=g['firstPlayer']);policy=row['cell']['profiles'][role];assert t['policyId']==policy['id']
   if j<len(prefix):assert t['move']==prefix[j] and t['stats'] is None
   else:
    s=t['stats'];searches+=1;depth0+=int(s['completedDepth']==0);nodes+=s['nodes'];assert 0<=s['nodes']<=s['maxNodes']==policy['nodes'];assert s['completedDepth']>0
 assert traces[0]==traces[1];assert a['firstWin']==b['firstWin'];assert b['final']['winner']==1-a['final']['winner']
 assert rec['operations']['normal']==2 and rec['operations']['depthZero']==depth0==0;assert rec['operations']['searchTurns']==searches and rec['operations']['turns']==turns
 expected_rec=summary['rows'][i];assert expected_rec['cellId']==x['id'];assert all(rec[k]==expected_rec[k] for k in rec)
 metrics.append(dict(cellId=x['id'],pairElapsedMs=rec['pairElapsedMs'],peakRssBytes=rec['peakRssBytes'],bytes=len(raw),normal=2,depthZero=0,actualNodes=nodes))
# Normal engine legal replay is independent of trial execution; never call pair/batch.
subprocess.run(['node','tools/v010-balance019/pilot.cjs','verify',str(P)],cwd=R,check=True,capture_output=True)
run=json.loads((D/'pilot-run-audit.json').read_text());assert len(run['jobs'])==30 and all(j['conclusion']=='success' for j in run['jobs']);assert run['runnerHours']<12
r=dict(status='PINNED-BYTES-PYTHON-AGGREGATION-AND-NORMAL-REPLAY-MATCH',sourceCommit=SOURCE,resultCommit=RESULT,runId=RUN,files=files,verifiedOriginalFiles=len(files),games=312,normal=312,depthZero=0,verifiedSourceFiles=verified_sources,pairRunnerHours=sum(x['pairElapsedMs'] for x in metrics)/3600000,allJobsRunnerHours=run['runnerHours'],peakRssBytes=max(x['peakRssBytes'] for x in metrics),rawGameBytes=sum(x['bytes'] for x in metrics),cells=metrics,newGames=0,newProofSearches=0)
(D/'pilot-independent-reaudit.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in r.items() if k not in ('files','cells','verifiedSourceFiles')}))
