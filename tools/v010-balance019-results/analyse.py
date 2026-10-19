"""MIT. Independent Python statistics from sealed raw records. No play/search."""
from pathlib import Path
import json,zipfile,gzip,hashlib,math,collections,statistics
ROOT=Path(__file__).resolve().parents[2];D=ROOT/'doc/v010-balance019';C=D/'completed'
def digest(b):return hashlib.sha256(b).hexdigest()
def jhash(x):return digest(json.dumps(x,separators=(',',':'),ensure_ascii=False).encode())
manifest=json.loads((ROOT/'tools/v010-balance019/manifest.json').read_text());summary=json.loads((C/'summary.json').read_text());receipt=json.loads((C/'preservation-receipt.json').read_text())
assert summary['sourceCommit']==receipt['sourceCommit']=='bf6e7724b663c2918866b5c9637f6547efe7e484'
assert summary['digest']==manifest['digest'];assert str(receipt['runId'])=='39241595646'
rawfiles={}
for name,h in receipt['archives'].items():
 raw=(C/name).read_bytes();assert digest(raw)==h
 with zipfile.ZipFile(C/name) as z:
  for n in z.namelist():
   if n.endswith('.json.gz'):assert n not in rawfiles;rawfiles[n]=z.read(n)
assert len(rawfiles)==624
move_fields=['type','phase','row','index','direction','side','houseChoice','houseTwo']
def moves(g):return [[t['move'].get(k) for k in move_fields] for t in g['turns']]
groups=collections.defaultdict(list);seen=set();seed_keys={}
for name,raw in sorted(rawfiles.items()):
 row=json.loads(gzip.decompress(raw));assert row['digest']==manifest['digest'];assert row['id'] not in seen;seen.add(row['id']);assert len(row['games'])==2
 a,b=row['games'];assert a['firstPlayer']==0 and b['firstPlayer']==1
 assert a['seed']==b['seed']==row['seed'];assert a['firstWin']==b['firstWin'] and moves(a)==moves(b)
 for g in row['games']:assert g['trajectory']==jhash(moves(g))
 profile=a['profile'].split('/');assert b['profile']==a['profile']
 key=int(row['id'].rsplit('-',1)[1]);seed_keys.setdefault(key,row['seed']);assert seed_keys[key]==row['seed']
 groups[(a['openingId'],tuple(profile))].append(row)
assert len(seed_keys)==4 and len(set(seed_keys.values()))==4
reports=[]
for cell in manifest['cells']:
  opening=cell['opening'];ps=cell['profiles'];n=manifest['contract']['pairsPerCell'];rows=groups[(opening['id'],tuple(p['id'] for p in ps))];assert len(rows)==n
  assert {r['id'] for r in rows}=={cell['id']+'-'+str(i) for i in range(n)}
  assert len({r['seed'] for r in rows})==n
  for row in rows:
   i=int(row['id'].rsplit('-',1)[1]);assert row['seed']==int(jhash([manifest['contract']['seedDomain'],i])[:8],16)
  games=[g for r in rows for g in r['games']];one=[r['games'][0] for r in rows]
  first=sum(g['firstWin']==1 for g in games);second=sum(g['firstWin']==0 for g in games);unknown=sum(g['firstWin'] is None for g in games)
  stops=dict(collections.Counter(g['stop'] for g in games));lengths=dict(collections.Counter(str(len(g['turns'])) for g in games));depths=collections.Counter(str(t['stats']['completedDepth']) for g in games for t in g['turns'] if t['stats'])
  seqs=[moves(g) for g in one];variants=[len({jhash(s[:i+1]) for s in seqs if len(s)>i}) for i in range(max(map(len,seqs)))];split=next((i+1 for i,v in enumerate(variants) if v>1),None)
  turns=[t for g in games for t in g['turns'] if t['stats']];nodes=[t['stats']['nodes'] for t in turns];depth=[t['stats']['completedDepth'] for t in turns]
  lo=sum(sum(g['firstWin'] or 0 for g in r['games'])/2 for r in rows)/n;hi=sum(sum(1 if g['firstWin'] is None else g['firstWin'] for g in r['games'])/2 for r in rows)/n;w=math.sqrt(math.log(2/(manifest['contract']['alpha']/manifest['contract']['family']))/(2*n))
  report={'openingId':opening['id'],'cellId':cell['id'],'rootGroup':opening['group'],'profiles':[p['id'] for p in ps],'matched':ps[0]['id']==ps[1]['id'],'pairs':n,'games':len(games),'firstWins':first,'secondWins':second,'unresolved':unknown,'stops':stops,'plyDistribution':lengths,'completedDepthDistribution':dict(depths),'uniqueTrajectories':len({jhash(s) for s in seqs}),'unique12PlyPrefixes':len({jhash(moves(g)[:12]) for g in games}),'firstDivergentPrefixPly':split,'sharedPrefixPlies':split-1 if split else min(map(len,seqs)),'searchTurns':len(turns),'depthZero':sum(d==0 for d in depth),'actualNodes':sum(nodes),'nodesMedian':statistics.median(nodes),'depthMedian':statistics.median(depth),'actualElapsedMs':sum(t['elapsedMs'] for t in turns),'interval': {'lower':max(0,lo-w),'upper':min(1,hi+w),'halfWidth':w}}
  original=next(c for c in summary['cells'] if c['cellId']==cell['id'])
  for k in ['pairs','games','firstWins','secondWins','unresolved','uniqueTrajectories','unique12PlyPrefixes','searchTurns','depthZero','actualNodes','plyDistribution','completedDepthDistribution']:assert report[k]==original[k],(k,cell['id'])
  assert all(stops.get(k,0)==v for k,v in original['stops'].items())
  assert math.isclose(report['actualElapsedMs'],original['actualElapsedMs'],abs_tol=.001)
  if report['interval']:
   for k,v in report['interval'].items():assert math.isclose(v,original['interval'][k],abs_tol=1e-12)
  representative=next(r for r in rows if r['id']==cell['id']+'-0');report['representativeTrace']={'pairId':representative['id'],'seed':representative['seed'],'firstTwelveMoves':[t['move'] for t in representative['games'][0]['turns'][:12]]};report['observedFourthMoves']=list({jhash(g['turns'][3]['move']):g['turns'][3]['move'] for g in one}.values())
  report['hold']=zero_hold=report['depthZero']/max(1,report['searchTurns'])>manifest['contract']['depthZeroHoldFraction'] or unknown/len(games)>manifest['contract']['maxUnresolvedFraction']
  report['severeSide']=None if zero_hold else 'first' if report['interval']['lower']>.75 else 'second' if report['interval']['upper']<.25 else None
  report['observedFirstWinPair']=not zero_hold and any(r['games'][0]['firstWin']==1 for r in rows)
  for k in ['matched','hold','severeSide','observedFirstWinPair','rootGroup']:assert report[k]==original[k],(cell['id'],k)
  reports.append(report)
coverage=[]
for third in ['left','right']:
 for policy in ['base','mobility']:
  cs=[c for c in reports if c['openingId'].startswith('third-'+third) and c['profiles'][0].startswith(policy+'-')]
  row={'third':third,'firstPolicy':policy,'conditions':len(cs),'hold':any(c['hold'] for c in cs),'minimumFirstWins':min(c['firstWins'] for c in cs),'priorityForSeparateConfirmation':all(not c['hold'] and c['firstWins']>0 for c in cs),'interpretation':'Exploratory observations only; no counterplay confirmation or nonexistence proof'}
  assert row==next(c for c in summary['exploratoryCandidates'] if (c['third'],c['firstPolicy'])==(third,policy));coverage.append(row)
partitions=[]
for third in ['left','right']:
 for group in ['third-only','fourth-forced']:
  for matched in [True,False]:
   cs=[c for c in reports if c['openingId'].startswith('third-'+third) and c['rootGroup']==group and c['matched']==matched]
   partitions.append({'third':third,'rootGroup':group,'matched':matched,'cells':len(cs),'allFirstWinCells':sum(c['firstWins']==8 for c in cs),'allSecondWinCells':sum(c['secondWins']==8 for c in cs),'mixedCells':sum(c['firstWins']>0 and c['secondWins']>0 for c in cs),'unresolvedCells':sum(c['unresolved']>0 for c in cs),'warning':'Counts of cells only, not pooled independent win rates.'})
result={'status':'INDEPENDENT-PYTHON-RAW-REAGGREGATION-MATCH','resultCommit':'5015ee1f968a3ced31a83648524b9ac0132e3369','sourceCommit':receipt['sourceCommit'],'runId':receipt['runId'],'manifestDigest':manifest['digest'],'summarySha256':digest((C/'summary.json').read_bytes()),'archiveSha256':receipt['archives'],'pairs':len(rawfiles),'games':sum(c['games'] for c in reports),'normalGames':sum(c['stops'].get('normal-terminal',0) for c in reports),'unresolved':sum(c['unresolved'] for c in reports),'depthZero':sum(c['depthZero'] for c in reports),'uniqueSeedCount':len(seed_keys),'seedValues':list(seed_keys.values()),'simultaneousIntervalHalfWidth':reports[0]['interval']['halfWidth'],'cells':reports,'candidateRobustness':coverage,'partitions':partitions,'practicalBalanceAssessment':'HOLD','initialTheoreticalValue':'UNKNOWN','newGames':0,'newProofSearches':0}
(D/'results-analysis.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k not in ['cells','candidateRobustness']},ensure_ascii=False))
