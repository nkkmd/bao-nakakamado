from pathlib import Path
import json, gzip, hashlib, math, sys
root=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).parent/'results'
a=json.loads((root/'collected.json').read_text()); summaries=[]
def subset(gs):
    n=len(gs); cs=[g for g in gs if g['winner'] is not None]; w=sum(g['firstWon'] for g in cs); u=n-len(cs)
    return {'n':n,'completed':len(cs),'firstWins':w,'secondWins':len(cs)-w,'unresolved':u,'firstWinPct':100*w/len(cs) if cs else None,'allGameFirstWinBoundsPct':[100*w/n,100*(w+u)/n] if n else None}
def mean(xs): return sum(xs)/len(xs) if xs else None
def extra(gs):
    return {'uniqueFinalHashes':len(set(g['finalHash'] for g in gs)),
      'firstNyakua':[subset([g for g in gs if g['firstNyakuaRole']==v]) for v in [0,1,None]],
      'byOpening':{f"{i}-{d}":subset([g for g in gs if g['opening']['index']==i and g['opening']['direction']==d]) for i in [5,6] for d in ['left','right']},
      'avgNyakuaByRole':[mean([g['nyakuaByRole'][i] for g in gs]) for i in [0,1]],
      'avgCapturesByRole':[mean([g['capturesByRole'][i] for g in gs]) for i in [0,1]],
      'mtajiEntryByNextRole':[subset([g for g in gs if g['mtajiEntry'] and not g['mtajiEntry']['terminal'] and g['mtajiEntry']['nextRole']==i]) for i in [0,1]],
      'meanMtajiMaterialDiff':mean([g['mtajiEntry']['materialDiff'] for g in gs if g['mtajiEntry']]),
      'meanMtajiFrontDiff':mean([g['mtajiEntry']['frontDiff'] for g in gs if g['mtajiEntry']]),
      'snapshots':{p:{'n':len(xs:=[g['snapshots'][p] for g in gs if p in g['snapshots']]),'materialDiff':mean([x['materialDiff'] for x in xs]),'frontDiff':mean([x['frontDiff'] for x in xs]),'handDiff':mean([x['handDiff'] for x in xs])} for p in ['10','20','30','40']},
      'completedDepths':{d:sum(g.get('completedDepths',{}).get(d,0) for g in gs) for d in sorted(set(d for g in gs for d in g.get('completedDepths',{})))}}
for x in a:
    if x['task']=='proof': summaries.append(x); continue
    gs=[g for r in x['rows'] for g in r['games']]; z={k:v for k,v in x.items() if k!='rows'}; z['diagnostics']=extra(gs)
    if x['metadata']['cfg']['kind']=='opening': z['openingForced']=[subset([g for r in x['rows'] if r['opening']==i for g in r['games']]) for i in range(4)]
    if x['metadata']['cfg']['kind']=='cross': z['policySeatScores']=[{'policy':p,'first':subset([g for g in gs if g['policies'][0]==p]),'second':subset([g for g in gs if g['policies'][1]==p])} for p in x['metadata']['cfg']['policies']]
    summaries.append(z)
summary={'study':'V080-BALANCE-20261003','dateJST':'2026-10-03','totalGames':sum(x.get('summary',{}).get('n',0) for x in summaries),'tasks':summaries}
(root/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
def f(v):return f'{v:.1f}' if v is not None else '—'
def interval(x,k='wilson95Pct'):return '–'.join(f(v) for v in x[k]) if k in x else '—'
lines=['# v0.8.0の先攻・後攻の有利不利：詳細調査','', '調査日：2026年10月3日（日本時間）。調査ID：V080-BALANCE-20261003。','',
'対象は現行の `prototype/next-turn-engine.js` と `prototype/steal.js`。4列32穴、ハンド22個ずつ、NYAKUAの最後の1個保護、別確保分の次手3個投入、共通MTAJI、512回安全上限を使用した。初期配置と製品コードを変更していない。','',
f"正式対局は計{summary['totalGames']:,}局。旧試験と今回の準備試験はこの対局数に加えない。全局の全着手で総KETE64個と非負整数を検査した。",'',
'## 同じ方針同士の比較','', '|方針|局数|先攻勝|後攻勝|未決着|先攻勝率|95%区間|平均手数|平均NYAKUA|', '|---|---:|---:|---:|---:|---:|---:|---:|---:|']
for x in summaries:
 if not x['task'].startswith('self-'):continue
 s=x['summary'];lines.append(f"|{x['task'][5:]}|{s['n']}|{s['firstWins']}|{s['secondWins']}|{s['n']-s['completed']}|{f(s['firstWinPct'])}%|{interval(s)}%|{f(s['avgPlies'])}|{f(s['avgNyakua'])}|")
lines+=['','randomは全合法な選択肢から一様選択。noisyは即時評価の最良値から7点以内をランダム選択、greedyは即時評価、replyは相手の1手応答まで。search3/4/5/6は3/4/5/6手先の反復深化ミニマックスで、6手先は一着手30,000ノード上限。評価は `2×前列KETE差＋盤上・ハンド・確保分の総KETE差`。mobility付きは合法手数の差を2倍、前列占有穴数差を加える。根で同点の手は乱数で選択する。公開AI-GEN4や人間の熟練者の実力を再現したものではない。','',
'深さは要求値であり、ノード予算で未完了なら直前に完了した深さの評価を使用する。完了深さの頻度は集約JSONの `diagnostics.completedDepths` に保存。合法手が1つの着手は探索を省略する。','',
'## 異なる方針の先後交換','', '|方針A / B|組数|局数|先攻勝率|組単位95%区間|2局とも後攻勝 / 分割 / 2局とも先攻勝|', '|---|---:|---:|---:|---:|---|']
for x in summaries:
 if not x['task'].startswith('cross-'):continue
 s=x['summary'];p=x['metadata']['cfg']['policies'];lines.append(f"|{' / '.join(p)}|{s['completePairs']}|{s['n']}|{f(s['pairedFirstWinPct'])}%|{interval(s,'pairCluster95Pct')}%|{' / '.join(map(str,s['pairCounts']))}|")
lines+=['','Aが先攻・Bが後攻の対局と、Bが先攻・Aが後攻の対局を同じseedで組にした。乱数列は方針主体に付けて交換する。組の平均得点（0、0.5、1）を単位に標準誤差で区間を計算。通常終局していない対局が含まれる組はこの区間から除外し、未決着の数は元集計に残す。','',
'## 初手を固定した比較','', '4種類の合法初手を均等に指定し、その後だけ同じ探索方針で対戦した。初手は方針の推奨手に限らない。各初手250局、通常の初期局面から開始。初手ごとに異なるseedを使う。勝率は、その初手以後に指定方針で続けた成績であり最善応答の保証ではない。','', '|その後の方針|初手の穴・方向|局数|先攻勝率|未決着|', '|---|---|---:|---:|---:|']
for x in summaries:
 if not x['task'].startswith('open-'):continue
 for i,s in enumerate(x['openingForced']):lines.append(f"|{x['task'][5:]}|前列index {[5,5,6,6][i]}・{['left','right','left','right'][i]}|{s['n']}|{f(s['firstWinPct'])}%|{s['unresolved']}|")
lines+=['','indexは0始まり。南側の盤表示ではindex 5がA6、index 6がA7に対応する。','',
'## NYAKUA・段階移行の観察','', '|方針|NYAKUA平均：先攻 / 後攻|最初のNYAKUAが先攻：局数 / 先攻勝率|最初が後攻：局数 / 先攻勝率|NYAKUAなし：局数 / 先攻勝率|MTAJI移行時平均総KETE差（先攻−後攻）|', '|---|---:|---:|---:|---:|---:|']
for x in summaries:
 if not x['task'].startswith('self-'):continue
 d=x['diagnostics'];c=d['firstNyakua'];lines.append(f"|{x['task'][5:]}|{' / '.join(f(v) for v in d['avgNyakuaByRole'])}|{c[0]['n']} / {f(c[0]['firstWinPct'])}%|{c[1]['n']} / {f(c[1]['firstWinPct'])}%|{c[2]['n']} / {f(c[2]['firstWinPct'])}%|{f(d['meanMtajiMaterialDiff'])}|")
lines+=['','これは結果に条件を付けた観察であり、最初のNYAKUAが勝率の差を引き起こしたと証明しない。盤面の優劣がNYAKUAと勝敗の両方に関係する可能性がある。10/20/30/40手時点の盤上総数・前列・ハンド差、MTAJIの最初の手番別成績もJSONに保存した。各時点に到達した局だけの平均なので、既に終局した局を含む全対局の平均と混同しない。','',
'## 初期局面の強制勝ち探索','', '実際の通常終局を葉にした3値AND/OR探索。深さ末端と安全上限はUNKNOWN。勝つ側は1手を選べばよいが、相手側は全合法手・NYUMBA選択を確認する。各深さ1,000万ノード、総時間900秒。強制勝ち判定が出た場合は別証明書を検証するまで確定結論としない。','', '|深さ|判定|ノード数|秒|', '|---:|---|---:|---:|']
p=next(x for x in summaries if x['task']=='proof')
for r in p['records']:lines.append(f"|{r['depth']}|{r['result']}|{r['nodes']:,}|{r['elapsedMs']/1000:.1f}|")
lines+=['','UNKNOWNはその深さ以内に通常終局へ強制的に導く勝ちが検出されないという結果。打切り深さは探索未完了。長い必勝戦略の不在や完全最善手での均衡を意味しない。','',
'## 解釈・検証・保存','', '勝率の分母は通常終局局数。512回安全上限・同一局面反復・400手打切りは未決着として勝敗から除外する。全試験局を分母にして未決着を先攻敗／先攻勝に置いた上下限をJSONに保存。手数平均は打切りまでを含む。','',
'各方針・条件は異なるseed集合。自己対戦の区間はWilson法。区間は指定された確率的方針と初期局面での変動を示し、ゲーム全体や人間の母集団の区間ではない。探索方針には同じ局面・同じ棋譜へ収束する性質があるため、独立seedでも多様な対局を意味しない。異なる条件の総対局数を合算して単一の勝率や独立標本区間を出さない。複数条件を比較しているため、50%を外れた区間だけで普遍的な先後差を主張しない。','',
'GitHub Actionsで実行。20局／20組ごとに原子的チェックポイントを保存し、コードSHA-256と条件署名を検査する。失敗時もartifact保存を試みる。再実行時は同じ署名の完了ブロックを復元すると再開できる。全taskの集計・ソース・署名を照合し、各taskの先頭・中央・末尾と全未決着局を再実行、代表棋譜を現行の棋譜再生関数で再構築した。南北交換でも全着手の一致を確認した。検証数は `verification.json` を参照。','',
'[実行方法](../tools/v080-balance/README.md)、[集約結果](../tools/v080-balance/results/summary.json)、[検証結果](../tools/v080-balance/results/verification.json)、[対局単位の原記録](../tools/v080-balance/results/checkpoints.json.gz)。原記録はJSONファイル名→内容のgzipアーカイブで、展開後に同じ検証を実行できる。','']
Path('doc/V080_FIRST_PLAYER_BALANCE_20261003.md').write_text('\n'.join(lines))
files={str(p.relative_to(root)):p.read_text() for p in sorted(root.rglob('*.json')) if p.name not in ['collected.json','summary.json','verification.json'] or p.parent!=root}
(root/'checkpoints.json.gz').write_bytes(gzip.compress(json.dumps({'format':'v080-balance-checkpoints','files':files},ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
(root/'collected.json').unlink()
h={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [root/'summary.json',root/'verification.json',root/'checkpoints.json.gz']}
(root/'SHA256.json').write_text(json.dumps(h,indent=2)+'\n')
print(json.dumps({'games':summary['totalGames'],'archiveBytes':(root/'checkpoints.json.gz').stat().st_size}))
