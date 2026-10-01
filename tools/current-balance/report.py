#!/usr/bin/env python3
"""Generate the Japanese report from verified summaries, without changing the rules."""
from pathlib import Path
import json

base = Path(__file__).resolve().parent
results = base / 'results'
verification = json.loads((results / 'verification.json').read_text())
assert verification['status'] == 'PASS' and verification['mainGames'] == 29000
policies = ['random', 'noisy', 'greedy', 'reply', 'search3', 'search4', 'search6', 'search4-mobility']
labels = {'random': '無作為', 'noisy': '評価差を許容', 'greedy': '一手評価', 'reply': '相手の一手応答を評価',
          'search3': '3手探索', 'search4': '4手探索', 'search6': '6手探索', 'search4-mobility': '可動性評価の4手探索'}
self_rows = [json.loads((results / ('self-' + p) / 'summary.json').read_text()) for p in policies]
cross_rows = [json.loads((results / ('cross-' + str(i)) / 'summary.json').read_text()) for i in range(5)]
proof = json.loads((results / 'proof' / 'summary.json').read_text())
last = proof['proof']['records'][-1]
assert last['result'] == 'BUDGET_STOP'
assert proof['proof']['records'][-2]['depth'] == 10
assert all(r['result'] == 'UNKNOWN' for r in proof['proof']['records'][:-1])
strong = self_rows[6]
summary = {'reference': self_rows[0]['reference'], 'rulesVersion': '0.6.1', 'runId': self_rows[0]['runId'],
           'runnerCommit': self_rows[0]['runnerCommit'], 'self': self_rows, 'cross': cross_rows, 'proof': proof,
           'verification': verification}
(results / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
def interval(v):
    return f'{v[0]:.1f}〜{v[1]:.1f}%'

text = f'''# 現行v0.6.1の先攻・後攻の有利不利

2026年10月1日。対象：main `{summary['reference']}`。状態：試験・集計検証完了。現行の各人1列8穴、折り返し、盤上各人6・2・2配置、初期ハンド各12個、NYUMBA6個基準、NYAKUAで相手の最後の1個を保護、一穴全投入、共通MTAJI移行を固定した。

## 結論

最後の1個保護を採用した現行仕様でも、探索を使う方針では先手への偏りが残る。単純な4方針の自己対局では先手勝率47.82〜53.68%だが、3手探索56.3%、4手探索60.8%、可動性評価の4手探索65.6%、6手探索{strong['firstWinPct']:.1f}%だった。先後が均衡したとは扱わない。

異なる方針同士の先後交代でも、探索を含む組合せに先手への偏りが見られる。ただし、すべての方針で先手が有利という結果ではない。最善プレイでの先手必勝・後手必勝は今回の予算内では証明していない。

## 実行条件

GitHub Actionsの[Current v0.6.1 first-player balance](https://github.com/nkkmd/bao-nakakamado/actions/runs/{summary['runId']})で実行した。実行commitは `{summary['runnerCommit']}`、Node.js v24.19.0。14タスク、最大4ジョブ同時。各100局または100組を原子的なブロックファイルで保存した。準備確認は正式対局数へ加えていない。

自己対局24,000局、先後交代5,000局、計29,000局。追加の座席交換1,600局は主集計に含めない。すべて同じ初期局面から始め、擬似乱数で着手選択や同点手の選択を変える。独立した29,000種類の初期局面を比較した試験ではない。

自己対局のseed indexは10000から、先後交代は30000から。1組2局では方針の先後を交換し、同じ個体の乱数列を引き継ぐ。画面の簡易コンピューターは同点時の最初の手を選ぶが、本試験の評価方針は同点候補を乱数で選ぶ。画面のコンピューター同士の固定一局の結果とは区別する。

## 自己対局

| 着手方針 | 対局数 | 先手勝利 | 後手勝利 | 先手勝率 | 参考95%区間 | 平均手番 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
'''
for r in self_rows:
    text += f"| {labels[r['policy']]} | {r['n']:,} | {r['firstWins']:,} | {r['secondWins']:,} | {r['firstWinPct']:.2f}% | {interval(r['wilson95Pct'])} | {r['avgPlies']:.2f} |\n"
text += '''
無作為ではほぼ半々、一手評価と評価差許容では後手が少し多く勝つ。一方、相手の応手を見る方針や探索方針では先手が多く勝ち、評価と探索条件によって偏りの大きさが変わる。単純方針だけを根拠に先後の有利不利が小さいと結論づけない。

参考区間は固定方針と擬似乱数で生じる勝敗に対するWilson区間。ゲーム固有の最善プレイの勝率、人間同士の勝率、異なる評価器を使ったときの勝率の区間ではない。複数方針の勝率を任意の重みで合算して均衡判定をしない。

## 異なる方針同士の先後交代

各組合せ500組・1,000局。両局とも先手勝ち、先後1勝ずつ、両局とも後手勝ちの組数も確認した。

| 方針A／方針B | 先手勝利 | 後手勝利 | 先手勝率 | 組単位の参考95%区間 | 両局先手勝ち | 1勝ずつ | 両局後手勝ち |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
'''
for r in cross_rows:
    p = r['pairFirstWins']
    text += f"| {labels[r['a']]}／{labels[r['b']]} | {r['firstWins']} | {r['secondWins']} | {r['firstWinPct']:.1f}% | {interval(r['pairCluster95Pct'])} | {p['both']} | {p['split']} | {p['neither']} |\n"
text += f'''
1組2局は独立した2標本とは扱わず、組ごとの先手得点0・0.5・1の平均と標準誤差から正規近似95%区間を求めた。先後を交代して方針の強さを混ぜる条件でも、探索を含む組合せに偏りが残ることを示す。ただし、全ゲーム木を解いた結論ではない。

## 進行・検証と必勝探索

- 主集計29,000局はすべて通常の `front-empty` または `no-move` で終局した。400手番での未終局、連続種まき安全上限、KETE総数違反、負数、反復異常による失敗は0件。パスも0件。
- 8方針各100組の座席交換で、全手後の盤面・勝者・手番数が交換対称になり、不一致は0件。先手側をNORTHに変更しても同じ先手の結果になり、上下の座席実装による偏りは見つからなかった。
- 製品エンジンとの候補手・遷移384件が一致し、最後の1個保護の対象候補5件も一致した。探索144条件は独立した総当たりで最善評価の選択と一致した。
- 取得した全ブロックのseed・対局数・勝敗・集計・ソースSHA-256を検証した。13対局タスクの開始・中間・末尾を再実行し、計{verification['reproducedGames']}局の勝敗・手番数・最終盤面SHA-256が一致した。
- 必勝探索は最大深さ18、各深さ100万ノードの予定で実行し、深さ1〜10を完了したがすべて `UNKNOWN`。深さ11で1,000,001ノードに達して予算停止した。先手必勝・後手必勝の証明は得ていない。`UNKNOWN` を均衡確認や引き分けとは扱わない。

## 記録と解釈

今回、ルール変更は行っていない。最後の1個保護は採用を維持しつつ、先後均衡を目的とする調整は続ける必要がある。次の調整候補を比較するときは、単純方針だけでなく、今回の探索方針と先後交代を対照に含める。

旧v0.6.0のハンド6個の必勝証明や、ハンド12個・8個の勝率は別ルールの結果である。今回の現行ハンド12個の判定へ引き継がない。今回の6手探索の勝率も必勝証明とは区別する。

[試験設計・再実行方法](../tools/current-balance/README.md)、[全条件の集計](../tools/current-balance/results/summary.json)、[集計・再現検証](../tools/current-balance/results/verification.json)、[実行・artifact取得記録](../tools/current-balance/results/provenance.json)、[対局単位の保存データ](../tools/current-balance/results/records.json.gz)を参照する。`records.json.gz` は各タスクのmetadata・summary・blockを保存したgzip JSONで、ブロックを再展開して `verify.cjs` で再検証できる。
'''
(base.parent.parent / 'doc' / 'CURRENT_FIRST_PLAYER_BALANCE_20261001.md').write_text(text)
print(json.dumps({'mainGames': verification['mainGames'], 'search6FirstWinPct': strong['firstWinPct'], 'proof': last['result']}))
