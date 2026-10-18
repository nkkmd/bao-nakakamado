"""MIT. Independent Python statistics from sealed raw records. No play/search."""
from pathlib import Path
import json,zipfile,gzip,hashlib,math,collections,statistics
ROOT=Path(__file__).resolve().parents[2];D=ROOT/'doc/v010-balance017';C=D/'completed'
def digest(b):return hashlib.sha256(b).hexdigest()
def jhash(x):return digest(json.dumps(x,separators=(',',':'),ensure_ascii=False).encode())
manifest=json.loads((ROOT/'tools/v010-balance017/manifest.json').read_text());summary=json.loads((C/'summary.json').read_text());receipt=json.loads((C/'preservation-receipt.json').read_text())
assert summary['sourceCommit']==receipt['sourceCommit']=='033d309e42f6c9396207d96699a828511bb38e9c'
assert summary['digest']==manifest['digest'];assert str(receipt['runId'])=='39082844578'
rawfiles={}
for name,h in receipt['archives'].items():
 raw=(C/name).read_bytes();assert digest(raw)==h
 with zipfile.ZipFile(C/name) as z:
  for n in z.namelist():
   if n.endswith('.json.gz'):assert n not in rawfiles;rawfiles[n]=z.read(n)
assert len(rawfiles)==1440
move_fields=['type','phase','row','index','direction','side','houseChoice','houseTwo']
def moves(g):return [[t['move'].get(k) for k in move_fields] for t in g['turns']]
def short(m):return str(m['index']+1)+('右' if m['direction']=='right' else '左')
groups=collections.defaultdict(list);seen=set();source_receipts=[]
for name,raw in sorted(rawfiles.items()):
 row=json.loads(gzip.decompress(raw));assert row['digest']==manifest['digest'];assert row['id'] not in seen;seen.add(row['id']);assert len(row['games'])==2
 a,b=row['games'];assert a['firstPlayer']==0 and b['firstPlayer']==1
 assert a['seed']==b['seed']==row['seed'];assert a['firstWin']==b['firstWin'] and moves(a)==moves(b)
 for g in row['games']:assert g['trajectory']==jhash(moves(g))
 profile=a['profile'].split('/');assert profile[0]==profile[1]
 groups[(a['openingId'],profile[0])].append(row)
reports=[]
for opening in manifest['openings']:
 for p in manifest['contract']['profiles']:
  rows=groups[(opening['id'],p['id'])];n=8 if opening['forced'] else 128;assert len(rows)==n
  assert len({r['seed'] for r in rows})==n
  for row in rows:
   i=int(row['id'].rsplit('-',1)[1]);assert row['seed']==int(jhash([manifest['contract']['seedDomain'],opening['id'],i])[:8],16)
  games=[g for r in rows for g in r['games']];one=[r['games'][0] for r in rows]
  first=sum(g['firstWin']==1 for g in games);second=sum(g['firstWin']==0 for g in games);unknown=sum(g['firstWin'] is None for g in games)
  stops=dict(collections.Counter(g['stop'] for g in games));lengths=dict(collections.Counter(str(len(g['turns'])) for g in games));depths=collections.Counter(str(t['stats']['completedDepth']) for g in games for t in g['turns'] if t['stats'])
  seqs=[moves(g) for g in one];variants=[len({jhash(s[:i+1]) for s in seqs if len(s)>i}) for i in range(max(map(len,seqs)))];split=next((i+1 for i,v in enumerate(variants) if v>1),None)
  turns=[t for g in games for t in g['turns'] if t['stats']];nodes=[t['stats']['nodes'] for t in turns];depth=[t['stats']['completedDepth'] for t in turns]
  lo=sum(r['games'][0]['firstWin'] or 0 for r in rows)/n;hi=sum(1 if r['games'][0]['firstWin'] is None else r['games'][0]['firstWin'] for r in rows)/n;w=math.sqrt(math.log(2/(.05/6))/(2*n))
  report={'openingId':opening['id'],'profile':p['id'],'forced':opening['forced'],'pairs':n,'games':len(games),'firstWins':first,'secondWins':second,'unresolved':unknown,'stops':stops,'plyDistribution':lengths,'completedDepthDistribution':dict(depths),'uniqueTrajectories':len({jhash(s) for s in seqs}),'unique12PlyPrefixes':len({jhash(moves(g)[:12]) for g in games}),'firstDivergentPrefixPly':split,'sharedPrefixPlies':split-1 if split else min(map(len,seqs)),'naturalOpenings':dict(collections.Counter(' → '.join(short(t['move']) for t in g['turns'][:2]) for g in one)) if not opening['forced'] else None,'searchTurns':len(turns),'depthZero':sum(d==0 for d in depth),'actualNodes':sum(nodes),'nodesMedian':statistics.median(nodes),'depthMedian':statistics.median(depth),'actualElapsedMs':sum(t['elapsedMs'] for t in turns),'interval':None if opening['forced'] else {'lower':max(0,lo-w),'upper':min(1,hi+w),'halfWidth':w}}
  original=next(c for c in summary['cells'] if (c['openingId'],c['profile'])==(opening['id'],p['id']))
  for k in ['pairs','games','firstWins','secondWins','unresolved','uniqueTrajectories','unique12PlyPrefixes','searchTurns','depthZero','actualNodes','plyDistribution','completedDepthDistribution']:assert report[k]==original[k],(k,opening['id'],p['id'])
  assert all(stops.get(k,0)==v for k,v in original['stops'].items())
  assert math.isclose(report['actualElapsedMs'],original['actualElapsedMs'],abs_tol=.001)
  if report['interval']:
   for k,v in report['interval'].items():assert math.isclose(v,original['interval'][k],abs_tol=1e-12)
  reports.append(report)
forced=[c for c in reports if c['forced']];variable=[o['id'] for o in manifest['openings'][1:] if max(c['firstWins'] for c in forced if c['openingId']==o['id'])==16 and min(c['firstWins'] for c in forced if c['openingId']==o['id'])==0]
coverage=[]
for p in manifest['contract']['profiles']:
 for i in range(4):
  os=[o for o in manifest['openings'][1:] if o['firstIndex']==i];cs=[next(c for c in forced if (c['openingId'],c['profile'])==(o['id'],p['id'])) for o in os]
  coverage.append({'profile':p['id'],'firstIndex':i,'replies':len(cs),'firstAllObservedWinsAcrossEveryReply':all(c['firstWins']==16 for c in cs),'secondAllObservedWinsReplyIds':[c['openingId'] for c in cs if c['secondWins']==16],'warning':'Fixed continuation only; not a minimax certificate.'})
result={'status':'INDEPENDENT-PYTHON-RAW-REAGGREGATION-MATCH','resultCommit':'81232071da28e2a7eeda09c4260aa4ed9b723dde','sourceCommit':receipt['sourceCommit'],'runId':receipt['runId'],'manifestDigest':manifest['digest'],'summarySha256':digest((C/'summary.json').read_bytes()),'archiveSha256':receipt['archives'],'pairs':len(rawfiles),'games':sum(c['games'] for c in reports),'normalGames':sum(c['stops'].get('normal-terminal',0) for c in reports),'unresolved':sum(c['unresolved'] for c in reports),'depthZero':sum(c['depthZero'] for c in reports),'cells':reports,'openingWinnerReversalsAcrossConditions':variable,'firstReplyCoverage':coverage,'practicalBalanceAssessment':'HOLD','initialTheoreticalValue':'UNKNOWN','newGames':0,'newProofSearches':0}
(D/'results-analysis.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k not in ['cells','firstReplyCoverage']},ensure_ascii=False))
