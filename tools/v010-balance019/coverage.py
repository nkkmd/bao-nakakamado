"""MIT. Read-only historical state/path index. Never plays or searches."""
import collections,copy,gzip,hashlib,io,json,pathlib,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[2]
D=ROOT/'doc/v010-balance019'
def dump(x):return json.dumps(x,ensure_ascii=False,separators=(',',':'),sort_keys=True)
def sha(b):return hashlib.sha256(b).hexdigest()
def swap(a):
 a=copy.deepcopy(a)
 for i in (3,4,5,6,11):a[i].reverse()
 a[7]=1-a[7]
 if a[9] is not None:a[9]=1-a[9]
 if a[13] is not None:a[13]['player']=1-a[13]['player']
 return a
def canonical(a,ignore_turn=False):
 a=copy.deepcopy(a)
 if ignore_turn:a[12]=None
 return min(dump(a),dump(swap(a)))
inv=json.loads((D/'input-inventory.json').read_text());targets=[('prefix-2',inv['startKey'],inv['forcedPrefix'])]
for b in inv['branches']:
 name='third-'+b['third']['direction'];path=inv['forcedPrefix']+[b['third']]
 targets.append((name,b['stateKey'],path))
 for i,r in enumerate(b['replies']):targets.append((name+'-reply-'+str(i),r['stateKey'],path+[r['fourth']]))
indices=[{canonical(json.loads(k),ignore):name for name,k,p in targets} for ignore in (False,True)]
assert all(len(x)==14 for x in indices)
rows=[];hits=[];games=collections.Counter();proofs=collections.Counter();seen_games=set();game_seeds=set()
PREFIX=json.loads(inv['startKey'])[:3]
def boardkey(b):
 return PREFIX+[b['pits'],b['reserve'],b['nyakuaReserve'],b['houseOwned'],b['player'],b['phase'],b['winner'],b['reason'],b['pending'],b.get('turn'),b.get('takasia')]
def match(key,loc,kind,extra):
 try:a=json.loads(key) if isinstance(key,str) else key
 except (ValueError,TypeError):return
 if not isinstance(a,list) or len(a)!=14 or a[:3]!=PREFIX:return
 for ignore,idx in zip((False,True),indices):
  target=idx.get(canonical(a,ignore))
  if target:hits.append(dict(location=loc,kind=kind,target=target,match='position-without-turn' if ignore else 'complete-state',**extra))
def walk(x,loc,kind='metadata'):
 if isinstance(x,dict):
  if 'games' in x and isinstance(x['games'],list):
   for gi,g in enumerate(x['games']):
    game_seeds.add(g.get('seed'));ident=sha(dump(g).encode());duplicate=ident in seen_games;seen_games.add(ident);games[loc.split('!')[0]]+=1
    moves=[]
    for ti,t in enumerate(g.get('turns',[])):
     extra=dict(game=gi,ply=ti+1,move=t.get('move'),seed=g.get('seed'),profile=g.get('profile'),duplicateRecord=duplicate)
     match(t.get('before'),loc,'game-turn',extra)
     moves.append(t.get('move'))
     for name,key,path in targets:
      if moves==path:match(t.get('after'),loc,'game-path',dict(game=gi,ply=ti+1,pathTarget=name,duplicateRecord=duplicate))
   # Games are handled once, not recursively as arbitrary metadata.
  if 'status' in x and ('attempts' in x or 'certificate' in x or 'nodes' in x):
   proofs[x['status']]+=1
  status=x.get('status');k='proof-certificate' if status=='PROVED' and 'nodes' in x else kind
  for key,value in x.items():
   if key=='games':continue
   if key in ('stateKey','startKey','before','after') and isinstance(value,str):match(value,loc+':'+key,k,dict(status=status))
   elif isinstance(value,dict) and all(f in value for f in ('pits','reserve','nyakuaReserve','houseOwned','player','phase','winner','reason','pending')):match(boardkey(value),loc+':'+key,k,dict(status=status))
   elif isinstance(value,(dict,list)):walk(value,loc+':'+key,k)
 elif isinstance(x,list):
  for i,v in enumerate(x):walk(v,loc+':'+str(i),kind)
def archive(data,loc):
 with zipfile.ZipFile(io.BytesIO(data)) as z:
  assert len(z.namelist())==len(set(z.namelist()))
  count=0
  for n in sorted(z.namelist()):
   if n.endswith('/'):continue
   b=z.read(n);where=loc+'!'+n
   if n.endswith('.zip'):count+=archive(b,where)
   elif n.endswith(('.json','.json.gz')):
    if n.endswith('.gz'):b=gzip.decompress(b)
    walk(json.loads(b),where);count+=1
  return count
paths=[ROOT/'doc/v010-balance/formal-original-artifacts.zip']
paths+=sorted((ROOT/'doc/v010-research-completed').glob('study-*/*.zip'))
paths+=sorted((ROOT/'doc').glob('v010-*/completed/*.zip'))
paths+=[ROOT/'doc/v010-followup/proof-checkpoint/original-proof-artifacts.zip']
for p in paths:
 data=p.read_bytes();loc=str(p.relative_to(ROOT));before=len(hits);n=archive(data,loc)
 rows.append(dict(path=loc,sha256=sha(data),jsonFiles=n,gameRecords=games[loc],matchedOccurrences=len(hits)-before));print(loc,n,flush=True)
# Fixed inputs/registries outside archives also carry proof-root obligations.
metadata=[]
for base in ('tools','doc'):
 for p in sorted((ROOT/base).glob('v010-*/**/*.json')):
  if 'v010-balance019' in str(p) or '/pilot/' in str(p) or '/completed/' in str(p):continue
  if p.stat().st_size>10000000:continue
  b=p.read_bytes();before=len(hits);walk(json.loads(b),str(p.relative_to(ROOT)))
  metadata.append(dict(path=str(p.relative_to(ROOT)),sha256=sha(b),matchedOccurrences=len(hits)-before))
result=dict(status='HISTORICAL-INDEX-COMPLETE-NOT-REPLAY-AUDIT',method='Seat swap only (same pit indices/directions); full rule identifiers and all state fields retained. Separate turn-free position matches. Exact move-prefix paths indexed separately. Raw occurrences and duplicate games are not independent samples.',archives=rows,metadata=metadata,targets=[dict(id=n,stateKey=k,path=p) for n,k,p in targets],gameRecordsByArchive=dict(games),uniqueSerializedGames=len(seen_games),gameSeeds=sorted(s for s in game_seeds if s is not None),proofStatuses=dict(proofs),matches=hits,limitations=['Index does not validate certificates or replay games; use existing successful independent audits.','Proof root statuses must be joined to fixed registries before interpreting an obligation; metadata match alone is not proof.','Position-without-turn and complete-state matches are kept separate.','No inference that an unobserved move loses or was never considered internally by any prior search.'],newGames=0,newProofSearches=0)
detail=gzip.compress((json.dumps(hits,ensure_ascii=False,separators=(',',':'))+'\n').encode(),mtime=0)
(D/'coverage-matches.json.gz').write_bytes(detail)
result.pop('matches');result['matchesFile']='coverage-matches.json.gz';result['matchesSha256']=sha(detail);result['matchCounts']=[dict(kind=k[0],target=k[1],match=k[2],occurrences=v) for k,v in sorted(collections.Counter((h['kind'],h['target'],h['match']) for h in hits).items())]
(D/'coverage-receipt.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(archives=len(rows),games=sum(games.values()),hits=len(hits))))
