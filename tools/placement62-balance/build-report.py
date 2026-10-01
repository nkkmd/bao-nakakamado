#!/usr/bin/env python3
"""Consolidate verified placement-62 checkpoints and the unchanged baseline."""
from pathlib import Path
import json
import hashlib

root = Path(__file__).resolve().parents[2]
directory = Path(__file__).resolve().parent / 'results'
baseline = json.loads((root / 'tools/current-balance/results/summary.json').read_text())
tasks = ['self-random', 'self-noisy', 'self-greedy', 'self-reply', 'self-search3',
         'self-search4', 'self-search6', 'self-search4-mobility',
         'cross-0', 'cross-1', 'cross-2', 'cross-3', 'cross-4', 'proof']
records = {task: json.loads((directory / task / 'summary.json').read_text()) for task in tasks}
verification = json.loads((directory / 'verification.json').read_text())
assert verification['status'] == 'PASS' and verification['mainGames'] == 29000
shared = ['../../prototype/bounce-engine.js', '../../prototype/steal.js',
          '../balance-options/core.cjs', '../balance-options/variant-engine.cjs']
for task, item in records.items():
    assert item['completed'] and item['countOverride'] is None and item['totalKete'] == 40
    for name in shared:
        assert item['hashes'][name] == baseline['self'][0]['hashes'][name]
    assert item['runnerCommit'] == 'cbe866016ddb156c03c9575192bc4ef7321012a4'
    assert item['runId'] == '36876125049'
self_rows = [records[task] for task in tasks if task.startswith('self-')]
cross_rows = [records[task] for task in tasks if task.startswith('cross-')]
summary = {'reference': self_rows[0]['reference'], 'runId': self_rows[0]['runId'],
           'runnerCommit': self_rows[0]['runnerCommit'], 'rulesVersion': '0.6.1',
           'candidateTotalKete': 40, 'baselineTotalKete': 44,
           'decision': 'EVALUATED_ONLY', 'self': self_rows, 'cross': cross_rows,
           'proof': records['proof'], 'baselineSourceSha256': hashlib.sha256(
               (root / 'tools/current-balance/results/summary.json').read_bytes()).hexdigest(),
           'baselineRunId': baseline['runId'], 'sharedSourceHashesMatched': True}
(directory / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
labels = {'random': '無作為', 'noisy': '評価差を許容', 'greedy': '一手評価',
          'reply': '相手の一手応答を評価', 'search3': '3手探索', 'search4': '4手探索',
          'search6': '6手探索', 'search4-mobility': '可動性評価の4手探索'}
table = []
progress = []
for candidate in self_rows:
    control = next(row for row in baseline['self'] if row['policy'] == candidate['policy'])
    assert control['n'] == candidate['n'] and control['seedStartIndex'] == candidate['seedStartIndex']
    ci = candidate['wilson95Pct']
    table.append(f"| {labels[candidate['policy']]} | {candidate['n']:,} | {control['firstWinPct']:.2f}% | {candidate['firstWinPct']:.2f}% | {100-candidate['firstWinPct']:.2f}% | {ci[0]:.1f}〜{ci[1]:.1f}% |")
    progress.append(f"| {labels[candidate['policy']]} | {control['avgPlies']:.2f} | {candidate['avgPlies']:.2f} | {control['mtajiPlayedPct']:.2f}% | {candidate['mtajiPlayedPct']:.2f}% | {candidate['nyakuaPct']:.2f}% | {candidate['bulkPct']:.2f}% |")
cross_table = []
for candidate in cross_rows:
    control = next(row for row in baseline['cross'] if (row['a'], row['b']) == (candidate['a'], candidate['b']))
    assert control['n'] == candidate['n'] and control['seedStartIndex'] == candidate['seedStartIndex']
    ci = candidate['pairCluster95Pct']
    cross_table.append(f"| {labels[candidate['a']]}／{labels[candidate['b']]} | {control['firstWinPct']:.1f}% | {candidate['firstWinPct']:.1f}% | {ci[0]:.1f}〜{ci[1]:.1f}% |")
proof = records['proof']['proof']['records']
completed = [item['depth'] for item in proof if item['result'] == 'UNKNOWN']
last = proof[-1]
assert last['result'] == 'BUDGET_STOP'
assert json.loads((directory / 'proof/certificate-check.json').read_text())['status'] == 'NOT_APPLICABLE'
text = '''# 初期配置6・2と現行6・2・2の先攻・後攻比較

2026年10月1日。基準：main `482ac28b8be2df11df873441196be53fc505df46`、現行v0.6.1。状態：正式試験・集計検証完了。採用判断は行わず、遊べる試作の初期配置は変更していない。

## 試験した変更

「NYUMBA6・2」は、各人のNYUMBA（5番）に6個、6番に2個、7番を空にする配置として試験した。ハンドは両者12個を維持する。

| 項目 | 現行の対照 | 候補 |
| --- | --- | --- |
| 自分から見た1〜8番穴 | 0・0・0・0・6・2・2・0 | 0・0・0・0・6・2・0・0 |
| 各人の盤上KETE | 10個 | 8個 |
| 各人のハンド | 12個 | 12個 |
| 両者の総KETE | 44個 | 40個 |
| 捕獲 | 毎回全捕獲 | 同じ |
| NYAKUA | 最後の1個を保護 | 同じ |
| 一穴全投入・共通MTAJI移行 | 維持 | 同じ |

削除した盤上KETEをハンドへ移していない。総KETE数も変わるため、数を保ったまま位置だけを変えた比較ではない。前のNYUMBA残数による連続捕獲上限案は採用せず、今回も毎回全捕獲を維持した。

## 結論

無作為・評価差許容・一手評価では候補の先手勝率は49.72〜50.96%だった。一方、相手の一手応答を評価すると38.42%、3手探索37.4%、4手探索34.6%、可動性評価4手探索33.1%となり、これらの方針では現行の先手寄りから後手寄りへ偏りが変わった。

6手探索では候補の先手勝率77.2%となり、現行の100%から低下しても先手寄りが残った。異方針の先後交代でも、応答評価／4手探索は先手37.4%、6手探索／可動性評価4手探索は74.6%で、偏りの方向が一致しない。

**この配置では先後均衡を確認できなかった。** 初期配置の変更は先後の偏りに影響するが、単純方針の50%付近だけを根拠に均衡したとは扱えない。4手まで後手有利の傾向が出る一方、6手では先手寄りとなるため、単純に「後手有利のゲームへ変わった」とも結論づけない。人間・最善プレイでの先後の有利不利は確定していない。

## 自己対局の先手勝率

| 着手方針 | 新旧それぞれの局数 | 現行6・2・2 | 候補6・2 | 候補の後手勝率 | 候補先手の参考95%区間 |
| --- | ---: | ---: | ---: | ---: | ---: |
''' + '\n'.join(table) + '''

同じ初期局面から、同点手などの選択を擬似乱数で変えた固定方針の自己対局。各方針の勝率を任意の重みで合算しない。Wilson区間はこの条件下の参考値で、ゲーム固有の最善プレイの勝率区間ではない。同じseedを使用した新旧の対局は対応があるため、表の別々の区間だけで差の統計的有意性を判定しない。

## 異なる方針の先後交代

各組合せ500組、1組2局、計1,000局。同じ個体の乱数列を先後交代でも維持する。

| 方針A／方針B | 現行先手勝率 | 候補先手勝率 | 候補の組単位参考95%区間 |
| --- | ---: | ---: | ---: |
''' + '\n'.join(cross_table) + '''

1組2局を独立な2標本とは扱わず、組ごとの先手得点0・0.5・1の平均と標準誤差から参考区間を求めた。自己対局とは異なる方針の強さを混ぜるため、これだけで均衡やゲーム固有の先手・後手必勝を判定しない。

## 対局の進行

| 方針 | 現行平均手番 | 候補平均手番 | 現行MTAJI実着手 | 候補MTAJI実着手 | 候補NYAKUAあり | 候補全投入あり |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
''' + '\n'.join(progress) + f'''

主試験29,000局はすべて前列全空または合法手なしによる通常終局。400手番での未終局、連続種まき安全上限到達、KETE総数違反、負数、反復異常、パスは0件。追加の座席交換1,600局も正常に処理され、全手後の局面・選択手・勝者・手番数の対応に不一致はなかった。全局面の停止証明ではない。

## 実行と検証

[GitHub Actions: Placement 6-2 first-player balance](https://github.com/nkkmd/bao-nakakamado/actions/runs/36876125049)で実行した。実行commit `cbe866016ddb156c03c9575192bc4ef7321012a4`、Node.js v24.19.0、14タスク、最大4ジョブ同時。各100局または100組を原子的なJSONブロックへ保存した。準備確認の少数対局は正式集計に含めない。

候補の自己対局24,000局と異方針の先後交代5,000局、計29,000局。対照は[現行の29,000局](CURRENT_FIRST_PLAYER_BALANCE_20261001.md)を再利用した。ゲームエンジン、NYAKUA、探索・評価、隔離エンジン読込の4ソースSHA-256が両試験で一致することを確認し、方針・局数・seed開始位置も一致させた。対照を今回新たに再実行したという意味ではない。

- 候補の到達局面から全合法応手504遷移を現行の製品エンジンに入力し、局面・着手記録が一致。最後の1個保護の対象候補8件も一致。
- 候補の開始・中間・終盤で、探索2・3・4手と材料・可動性評価を独立した全幅ミニマックスと144条件で照合し、不一致0。
- 取得したartifactのZIP SHA-256、全JSONブロックの署名・seed・対局数・勝敗・進行・集計・ソースSHA-256を検証。
- 13対局タスクの開始・中間・末尾を再実行し、計{verification['reproducedGames']}局の勝敗・手番数・最終盤面SHA-256まで一致。
- 必勝探索は深さ1〜{max(completed)}を完了してすべてUNKNOWN、深さ{last['depth']}で{last['nodes']:,}ノードに達して予算停止。先手必勝・後手必勝の証明は得られず、UNKNOWNを均衡や引き分けとは扱わない。

## 記録と扱い

今回の指示は先後の有利不利の調査であり、候補配置を遊べる試作へ採用していない。初期配置は現行6・2・2のまま。NYAKUAの最後の1個保護、一穴全投入なども維持する。

[試験条件・再現方法](../tools/placement62-balance/README.md)、[全条件の集計](../tools/placement62-balance/results/summary.json)、[集計・再現検証](../tools/placement62-balance/results/verification.json)、[実行・取得記録](../tools/placement62-balance/results/provenance.json)、[対局単位のチェックポイント](../tools/placement62-balance/results/records.json.gz)を保存した。gzip JSONを展開すればartifactの保持期間後も各対局の検証を再実行できる。
'''
(root / 'doc/PLACEMENT62_BALANCE_20261001.md').write_text(text)
print(json.dumps({'report': 'doc/PLACEMENT62_BALANCE_20261001.md', 'selfRows': len(self_rows),
                  'crossRows': len(cross_rows), 'mainGames': 29000}))
