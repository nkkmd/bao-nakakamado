# v0.10.0先後差の調査基盤

[検証計画](../../doc/V010_FIRST_PLAYER_BALANCE_PLAN_20261011.md)に従う研究用コード。公開ルール・公開探索・旧試験原記録は変更しない。

```sh
python3 tools/v010-balance/generate-search.py
node --test tools/v010-balance/check.test.cjs
node tools/v010-balance/run.cjs pilot /tmp/v010-balance-pilot
node tools/v010-balance/run.cjs pilot /tmp/v010-balance-pilot
```

2回目は完成組を監査して新規計測0件で復元する。途中組が残るとHOLDとなる。その.startedを削除して同じIDを再計測しない。manifestまたはソースが違うデータは拒否する。

`research-search.cjs` は現行探索から機械的に派生した研究用ファイル。ノード制御と厳密なroot同評価選択が有効な場合だけ研究方針となる。既定で研究制御を無効にしたときは、公開探索と選択手・ノード数・値が一致することを検査する。全root値は通常遷移の全探索と照合する。

`core.cjs` は南北交換・KETE保存・軽量遷移と通常遷移の照合・初期状態付き棋譜の再生を行う。NORTH開始記録を公開棋譜形式へ偽装しない。`run.cjs` の試走結果は勝率を出さず、運用と多様性だけで候補を選ぶ。`oracle.cjs` は枝刈り・キャッシュのない別の探索計算だが、物理エンジンと評価器は共通である。

コードはMIT。説明文はCC BY-SA 4.0。生成した探索にある元ゲームの著作権表示を保持する。

正式試験の条件は `formal-manifest.json`。運用選択からの再現は `node tools/v010-balance/freeze.cjs` で既存manifestと完全一致を確認する。

```sh
node tools/v010-balance/formal.cjs manifest
node tools/v010-balance/formal.cjs shard /tmp/v010-balance-formal 0
node tools/v010-balance/formal.cjs shard /tmp/v010-balance-formal 0
```

正式shardの実行は実際の測定である。全160shardのデータが揃ったディレクトリだけを `node tools/v010-balance/formal.cjs aggregate <directory>` で監査・集計する。途中の勝率は出さない。完成組はgzipの原bytesとreceiptのSHA-256を保持する。失敗・中断時はartifactを原形で保存し、完了組の再測定を行わず、不完全組はHOLDとして別途調査する。
