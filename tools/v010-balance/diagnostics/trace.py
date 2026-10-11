"""MIT. Read-only post-hoc trace statistics; no new games or rule changes."""
from pathlib import Path
import json,gzip,sys,collections
src=Path(sys.argv[1]);out=Path(sys.argv[2]);res={}
for profile in ['primary-8192','low-512','middle-2048']:
    groups=[collections.Counter() for _ in range(400)]
    boards=[set() for _ in range(400)]
    sizes=collections.Counter();mate_at=collections.Counter();states=collections.Counter()
    ny=[collections.Counter(),collections.Counter()];mtaji=[];count=0;start_variants=collections.Counter()
    for p in src.glob(profile+'-*.json.gz'):
        row=json.loads(gzip.decompress(p.read_bytes()));g=row['games'][0];count+=1
        sizes[len(g['turns'])]+=1;forced=False
        for i,t in enumerate(g['turns']):
            groups[i][json.dumps(t['move'],sort_keys=True)]+=1
            a=json.loads(t['before']);boards[i].add(json.dumps([a[3],a[4],a[6],a[7],a[8],a[13]]))
            if not forced and abs(t['stats']['rootScore'] or 0)>=900000:
                mate_at[i+1]+=1;forced=True
            ny[t['player']][i+1]+=t['summary']['stolen']
            if t['phase']=='mtaji' and (i==0 or g['turns'][i-1]['phase']!='mtaji'):
                pits=a[3];v={'ply':i+1,'hand':a[4],'frontSeeds':[sum(p[0]) for p in pits],
                   'boardSeeds':[sum(sum(r) for r in p) for p in pits],
                   'frontOccupied':[sum(n>0 for n in p[0]) for p in pits],
                   'toMove':a[7],'legalMove':t['move'],'state':a}
                mtaji.append(v);states[json.dumps(v,sort_keys=True)]+=1
    first_diff=next((i+1 for i,c in enumerate(groups) if len(c)>1),None)
    res[profile]={'seedPairs':count,'lengthDistribution':dict(sizes),'firstDifferentMovePly':first_diff,
       'moveVariantsPerPly':[len(c) for c in groups if c],
       'boardVariantsPerPly':[len(b) for b in boards if b],
       'firstTerminalSearchValuePly':dict(mate_at),
       'nyakuaByPlayerPly':[dict(c) for c in ny],
       'mtajiStartVariants':[{'count':n,'data':json.loads(k)} for k,n in states.items()],
       'commonPrefix':[json.loads(next(iter(c))) for c in groups[:first_diff-1 if first_diff else max(sizes)]],
       'firstDifferenceOptions':dict(groups[first_diff-1]) if first_diff else {}}
    print(profile,'pairs',count,'lengths',dict(sizes),'first move variation',first_diff,'first mate value',dict(mate_at),'mtaji states',len(states))
out.write_text(json.dumps(res,indent=2)+'\n')
