# MIT. Index preserved records only; no games or searches.
import collections,gzip,hashlib,json,pathlib,zipfile
front=json.loads(pathlib.Path('doc/v010-balance018/decision-frontier.json').read_text())
target=next(x['stateKey'] for x in front['openings'] if x['openingId']=='opening-2-1')
rows=[]
for study in ('001','002','003'):
 path=pathlib.Path(f'doc/v010-research-completed/study-{study}/original-records-001.zip')
 counts=collections.Counter(); scanned=0
 with zipfile.ZipFile(path) as archive:
  for name in sorted(archive.namelist()):
   if not name.endswith('.json.gz'):continue
   record=json.loads(gzip.decompress(archive.read(name)))
   for game in record.get('games',[]):
    scanned+=1
    for turn in game.get('turns',[]):
     if turn.get('before')==target:counts[json.dumps(turn['move'],sort_keys=True,separators=(',',':'))]+=1
 rows.append(dict(study=study,archive=str(path),sha256=hashlib.sha256(path.read_bytes()).hexdigest(),gamesIndexed=scanned,matchedTurns=sum(counts.values()),moves=[dict(move=json.loads(key),count=value) for key,value in sorted(counts.items())]))
result=dict(method='Exact turns.before match in preserved gzip records; canonical orientation only; index, not independent replay audit.',targetStateKey=target,studies=rows,fullHistoricalCoverageComplete=False,newGames=0,newProofSearches=0)
pathlib.Path('doc/v010-balance019/prior-index.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps([dict(study=r['study'],matchedTurns=r['matchedTurns']) for r in rows]))
