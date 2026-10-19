"""MIT. Independent Python statistics from sealed raw records. No play/search."""
from pathlib import Path
import json,zipfile,gzip,hashlib,math,collections,statistics
ROOT=Path(__file__).resolve().parents[2];D=ROOT/'doc/v010-balance018';C=D/'completed'
def digest(b):return hashlib.sha256(b).hexdigest()
def jhash(x):return digest(json.dumps(x,separators=(',',':'),ensure_ascii=False).encode())
manifest=json.loads((ROOT/'tools/v010-balance018/manifest.json').read_text());summary=json.loads((C/'summary.json').read_text());receipt=json.loads((C/'preservation-receipt.json').read_text())
assert summary['sourceCommit']==receipt['sourceCommit']=='80ba721ef8e2377f06931393318ae13104c74bae'
assert summary['digest']==manifest['digest'];assert str(receipt['runId'])=='39139965350'
rawfiles={}
for name,h in receipt['archives'].items():
 raw=(C/name).read_bytes();assert digest(raw)==h
 with zipfile.ZipFile(C/name) as z:
  for n in z.namelist():
   if n.endswith('.json.gz'):assert n not in rawfiles;rawfiles[n]=z.read(n)
assert len(rawfiles)==1536
move_fields=['type','phase','row','index','direction','side','houseChoice','houseTwo']
def moves(g):return [[t['move'].get(k) for k in move_fields] for t in g['turns']]
groups=collections.defaultdict(list);seen=set();seed_keys={}
for name,raw in sorted(rawfiles.items()):
 row=json.loads(gzip.decompress(raw));assert row['digest']==manifest['digest'];assert row['id'] not in seen;seen.add(row['id']);assert len(row['games'])==2
 a,b=row['games'];assert a['firstPlayer']==0 and b['firstPlayer']==1
 assert a['seed']==b['seed']==row['seed'];assert a['firstWin']==b['firstWin'] and moves(a)==moves(b)
 for g in row['games']:assert g['trajectory']==jhash(moves(g))
 profile=a['profile'].split('/');assert b['profile']==a['profile']
 key=(a['openingId'],int(row['id'].rsplit('-',1)[1]));seed_keys.setdefault(key,row['seed']);assert seed_keys[key]==row['seed']
 groups[(a['openingId'],tuple(profile))].append(row)
assert len(seed_keys)==128 and len(set(seed_keys.values()))==128
reports=[]
for cell in manifest['cells']:
  opening=cell['opening'];ps=cell['profiles'];n=manifest['contract']['pairsPerCell'];rows=groups[(opening['id'],tuple(p['id'] for p in ps))];assert len(rows)==n
  assert {r['id'] for r in rows}=={cell['id']+'-'+str(i) for i in range(n)}
  assert len({r['seed'] for r in rows})==n
  for row in rows:
   i=int(row['id'].rsplit('-',1)[1]);assert row['seed']==int(jhash([manifest['contract']['seedDomain'],opening['id'],i])[:8],16)
  games=[g for r in rows for g in r['games']];one=[r['games'][0] for r in rows]
  first=sum(g['firstWin']==1 for g in games);second=sum(g['firstWin']==0 for g in games);unknown=sum(g['firstWin'] is None for g in games)
  stops=dict(collections.Counter(g['stop'] for g in games));lengths=dict(collections.Counter(str(len(g['turns'])) for g in games));depths=collections.Counter(str(t['stats']['completedDepth']) for g in games for t in g['turns'] if t['stats'])
  seqs=[moves(g) for g in one];variants=[len({jhash(s[:i+1]) for s in seqs if len(s)>i}) for i in range(max(map(len,seqs)))];split=next((i+1 for i,v in enumerate(variants) if v>1),None)
  turns=[t for g in games for t in g['turns'] if t['stats']];nodes=[t['stats']['nodes'] for t in turns];depth=[t['stats']['completedDepth'] for t in turns]
  lo=sum(sum(g['firstWin'] or 0 for g in r['games'])/2 for r in rows)/n;hi=sum(sum(1 if g['firstWin'] is None else g['firstWin'] for g in r['games'])/2 for r in rows)/n;w=math.sqrt(math.log(2/(manifest['contract']['alpha']/manifest['contract']['family']))/(2*n))
  report={'openingId':opening['id'],'cellId':cell['id'],'profiles':[p['id'] for p in ps],'matched':ps[0]['id']==ps[1]['id'],'pairs':n,'games':len(games),'firstWins':first,'secondWins':second,'unresolved':unknown,'stops':stops,'plyDistribution':lengths,'completedDepthDistribution':dict(depths),'uniqueTrajectories':len({jhash(s) for s in seqs}),'unique12PlyPrefixes':len({jhash(moves(g)[:12]) for g in games}),'firstDivergentPrefixPly':split,'sharedPrefixPlies':split-1 if split else min(map(len,seqs)),'searchTurns':len(turns),'depthZero':sum(d==0 for d in depth),'actualNodes':sum(nodes),'nodesMedian':statistics.median(nodes),'depthMedian':statistics.median(depth),'actualElapsedMs':sum(t['elapsedMs'] for t in turns),'interval': {'lower':max(0,lo-w),'upper':min(1,hi+w),'halfWidth':w}}
  original=next(c for c in summary['cells'] if c['cellId']==cell['id'])
  for k in ['pairs','games','firstWins','secondWins','unresolved','uniqueTrajectories','unique12PlyPrefixes','searchTurns','depthZero','actualNodes','plyDistribution','completedDepthDistribution']:assert report[k]==original[k],(k,cell['id'])
  assert all(stops.get(k,0)==v for k,v in original['stops'].items())
  assert math.isclose(report['actualElapsedMs'],original['actualElapsedMs'],abs_tol=.001)
  if report['interval']:
   for k,v in report['interval'].items():assert math.isclose(v,original['interval'][k],abs_tol=1e-12)
  representative=next(r for r in rows if r['id']==cell['id']+'-0');report['representativeTrace']={'pairId':representative['id'],'seed':representative['seed'],'firstTwelveMoves':[t['move'] for t in representative['games'][0]['turns'][:12]]};report['observedFirstDecisionMoves']=list({jhash(g['turns'][2]['move']):g['turns'][2]['move'] for g in one}.values())
  report['hold']=zero_hold=report['depthZero']/max(1,report['searchTurns'])>manifest['contract']['depthZeroHoldFraction'] or unknown/len(games)>manifest['contract']['maxUnresolvedFraction']
  report['severeSide']=None if zero_hold else 'first' if report['interval']['lower']>.75 else 'second' if report['interval']['upper']<.25 else None
  report['counterCandidate']=not zero_hold and report['interval']['lower']>.25
  for k in ['matched','hold','severeSide','counterCandidate']:assert report[k]==original[k],(cell['id'],k)
  reports.append(report)
coverage=[]
for evaluator in ['base','mobility']:
 cs=[c for c in reports if c['profiles'][0].startswith(evaluator+'-')];assert len(cs)==12
 coverage.append({'firstEvaluator':evaluator,'cells':12,'counterCells':sum(c['counterCandidate'] for c in cs),'allTwelveSupported':all(c['counterCandidate'] for c in cs),'failedCellIds':[c['cellId'] for c in cs if not c['counterCandidate']]})
old_folder=ROOT/'doc/v010-balance017/completed';old_summary=json.loads((old_folder/'summary.json').read_text());old_receipt=json.loads((old_folder/'preservation-receipt.json').read_text());prior_choices={};prior_counts=collections.Counter();assert digest((old_folder/'summary.json').read_bytes())==next(r['sha256'] for r in old_receipt['files'] if r['file']=='summary.json')
for archive,h in old_receipt['archives'].items():
 assert digest((old_folder/archive).read_bytes())==h
 with zipfile.ZipFile(old_folder/archive) as z:
  for name in z.namelist():
   if 'opening-2-' not in name or not name.endswith('.json.gz'):continue
   row=json.loads(gzip.decompress(z.read(name)));g=row['games'][0];prior_counts[g['openingId']]+=1;prior_choices.setdefault(g['openingId'],{}).update({jhash(g['turns'][2]['move']):g['turns'][2]['move']})
assert dict(prior_counts)=={'opening-2-0':48,'opening-2-1':48}
matched_agreement=0
for c in reports:
 if not c['matched']:continue
 old=next(o for o in old_summary['cells'] if o['openingId']==c['openingId'] and o['profile']==c['profiles'][0]);matched_agreement+=int((old['firstWins']>old['secondWins'])==(c['firstWins']>c['secondWins']))
result={'status':'INDEPENDENT-PYTHON-RAW-REAGGREGATION-MATCH','resultCommit':'6c712782f35f21335d5af12472579ef5e7f4f6d6','sourceCommit':receipt['sourceCommit'],'runId':receipt['runId'],'manifestDigest':manifest['digest'],'summarySha256':digest((C/'summary.json').read_bytes()),'archiveSha256':receipt['archives'],'pairs':len(rawfiles),'games':sum(c['games'] for c in reports),'normalGames':sum(c['stops'].get('normal-terminal',0) for c in reports),'unresolved':sum(c['unresolved'] for c in reports),'depthZero':sum(c['depthZero'] for c in reports),'cells':reports,'candidateRobustness':coverage,'matchedFirstSevereCells':sum(c['matched'] and c['severeSide']=='first' for c in reports),'matchedSecondSevereCells':sum(c['matched'] and c['severeSide']=='second' for c in reports),'matchedDirectionAgreementWith017':matched_agreement,'prior017FirstDecisionChoices':{k:list(v.values()) for k,v in prior_choices.items()},'practicalBalanceAssessment':'HOLD','initialTheoreticalValue':'UNKNOWN','newGames':0,'newProofSearches':0}
(D/'results-analysis.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k not in ['cells','candidateRobustness']},ensure_ascii=False))
