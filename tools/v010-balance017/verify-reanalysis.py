"""MIT. Separate Python aggregation from immutable ZIPs; no JS statistics reuse."""
from pathlib import Path
import json,zipfile,io,gzip,hashlib,collections
root=Path(__file__).resolve().parents[2]
report=json.loads((root/'doc/v010-balance017/exploratory-reanalysis.json').read_text())
groups={}
with zipfile.ZipFile(root/'doc/v010-balance/formal-original-artifacts.zip') as outer:
 for name in outer.namelist():
  with zipfile.ZipFile(io.BytesIO(outer.read(name))) as inner:
   for f in inner.namelist():
    if not f.endswith('.json.gz'):continue
    row=json.loads(gzip.decompress(inner.read(f)))
    a=groups.setdefault(row['profile'],{'pairs':0,'games':0,'firstWins':0,'secondWins':0,'seeds':set(),'traces':collections.Counter(),'stops':collections.Counter(),'prefix':collections.defaultdict(set)})
    a['pairs']+=1;a['seeds'].add(row['seed']);g0,g1=row['games'];assert g0['firstPlayer']==0 and g1['firstPlayer']==1
    assert g0['trajectory']==g1['trajectory'] and g0['firstWin']==g1['firstWin']
    a['traces'][g0['trajectory']]+=1
    for i,t in enumerate(g0['turns']):a['prefix'][i].add(json.dumps([tr['move'] for tr in g0['turns'][:i+1]],sort_keys=True))
    for g in row['games']:
     a['games']+=1;a['stops'][g['stop']]+=1
     if g['firstWin'] is not None:a['firstWins' if g['firstWin'] else 'secondWins']+=1
for p in report['profiles']:
 a=groups[p['profile']['id']]
 for key in ['pairs','games','firstWins','secondWins']:assert p[key]==a[key]
 assert p['stops']==a['stops'] and p['uniqueSeeds']==len(a['seeds'])
 assert p['distinctNormalizedTrajectories']==len(a['traces'])
 assert p['largestTrajectoryClusterPairs']==max(a['traces'].values())
 assert p['firstDivergentPrefixPly']==next(i+1 for i,v in a['prefix'].items() if len(v)>1)
result={'status':'INDEPENDENT-PYTHON-AGGREGATION-MATCH','profiles':len(groups),'pairs':sum(a['pairs'] for a in groups.values()),'games':sum(a['games'] for a in groups.values()),'sourceArchiveSha256':report['sourceArchiveSha256'],'reportSha256':hashlib.sha256((root/'doc/v010-balance017/exploratory-reanalysis.json').read_bytes()).hexdigest(),'newGames':0,'newProofSearches':0}
(root/'doc/v010-balance017/reanalysis-reaudit.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
