# 現行v0.6.1の先後比較

対象：main `7f9160a2ac9a8e066efa3aeffd09b0bf99a47a8f`。各人1列8穴、折り返し、盤上各人 `0,0,0,0,6,2,2,0`、ハンド各12個、NYUMBA6個基準、NYAKUAで最後の1個を保護、一穴全投入、共通MTAJI移行を固定する。製品ルールは変更しない。

## 試験設計

- 自己対局：`random,noisy,greedy,reply` を各5,000局。`search3,search4,search6,search4-mobility` を各1,000局。計24,000局。seed index 10000から開始。
- 先後交代：無作為／一手評価、評価差許容／応答評価、応答評価／4手探索、4手／6手探索、6手探索／可動性評価4手探索の5組。各500組・1,000局、計5,000局。同じ個体の擬似乱数列を先後交代で引き継ぐ。seed index 30000から開始。
- 座席交換：8方針各100組・200局。SOUTH先手とNORTH先手で全手後の盤面・勝者・手番数を交換照合する。主集計29,000局へ加えない。
- 必勝探索：初期局面から深さ18まで、各深さ100万ノード上限。`UNKNOWN` と予算停止は均衡の証明とは扱わない。必勝判定が出た場合は全応手を覆う証明を別途検証してから結論に使う。

旧試験の選択・評価・探索・集計コードを再利用し、`protectLast: true` を明示する。旧コードの既定値はfalseで保持する。ライブの製品ルールとの候補手・遷移照合と、独立した総当たりによる探索選択検査を実行してから試験する。

各対局は400手番以内の通常終局、KETE保存、非負整数、反復異常なし、安全上限未到達を要求する。パスも0件であることを確認する。失敗した対局を除外して勝率を計算しない。

自己対局は固定方針・seed群における先手勝率とWilson95%区間を参考表示する。先後交代は1組2局に依存があるため、独立した局としてWilson区間を付けず、組ごとの先手得点0・0.5・1の平均から組単位の正規近似95%区間を表示する。先後交代の両局先手勝ち・1勝ずつ・両局後手勝ちも保存する。複数方針を任意の重みで合算した勝率をゲーム固有の有利不利とは扱わない。

## 実行と保存

GitHub Actionsの **Current v0.6.1 first-player balance** を第一候補とする。14タスクを最大4ジョブ同時で実行し、各100局または100組のJSONを原子的に保存する。中断時も完了したブロックはartifactへ残す。再実行は同じsignatureのブロックのみ再利用できる。ソースSHA-256、対象ルール、実行commit、run IDを保存する。

```sh
node tools/current-balance/check.cjs
node tools/current-balance/run.cjs self-random /tmp/current-balance/self-random
node tools/current-balance/run.cjs self-search6 /tmp/current-balance/self-search6
node tools/current-balance/run.cjs cross-3 /tmp/current-balance/cross-3
node tools/current-balance/run.cjs proof /tmp/current-balance/proof
```

第4引数は準備確認だけの局数・組数、proofではノード予算の上書き。準備確認は正式集計へ足さない。各タスクの最終結果は `summary.json`、対局ごとのseed・勝敗・手番数・最終盤面SHA-256は `block-*.json` に保存する。
