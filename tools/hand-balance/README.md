# 初期ハンド12個・8個・6個の比較試験

> このコードは旧v0.6.0の再現用です。`createForEngine(E, { protectLast: false })` を明示し、最後の1個を奪える旧条件を保持します。v0.6.1の履歴確認は `node tools/nyakua-protect-last-study.cjs 1000`、現行v0.8.0の確認は `node tools/next-turn-live-check.cjs 100 /tmp/next-turn-live-results.json` です。[現行仕様](../../prototype/README.md)を参照してください。

基準：試作v0.6.0、`ec3961c6d178ae5c146d1ffbdeabdce274575b46`。製品の初期ハンド12個は変更せず、試験の初期局面だけ上書きします。共通の `../../prototype/bounce-engine.js` と `../../prototype/steal.js` を使用します。

- [12個・8個の先行報告](../../doc/HAND12_VS_HAND8_BALANCE_20261001.md)
- [6個の追加報告・3条件の比較](../../doc/HAND6_BALANCE_20261001.md)

Node.js v24.19.0で実行。外部ライブラリ不要。以下はリポジトリ直下から始めるコマンドです。再実行は `reproduced-` の別名へ保存し、記録済み集計を維持します。

```sh
node --test prototype/bounce.test.cjs prototype/app.test.cjs prototype/steal.test.js tools/fixed-pit-bulk-study.test.cjs tools/fixed-pit-triggered-study.test.cjs
cd tools/hand-balance
node balance-check.cjs
node balance.cjs self 5000 random,noisy,greedy,reply results/reproduced-hand6-baseline.json 6
node balance.cjs self 1000 search3,search4,search6,search4-mobility results/reproduced-hand6-search.json 6
node crossplay.cjs 500 6 results/reproduced-hand6-crossplay.json
node balance.cjs proof 16 1000000 results/reproduced-hand6-proof.json 6
node certificate.cjs
node verify-certificate.cjs
node certificate-check.cjs
node examples.cjs
```

`balance.cjs` は `self 局数 方針CSV 出力JSON ハンドCSV` または `proof 最大深さ ノード予算 出力JSON ハンドCSV`。ハンドCSVの既定値は `12,8,6`。方針は `random,noisy,greedy,reply,search3,search4,search6,search4-mobility` を使用しました。`crossplay.cjs` は `組数 ハンドCSV 出力JSON` で、方針の5組合せを固定し各組で先後交代します。試験を再現するseed範囲はコードに固定しています。

証明生成・検証はハンド6個・深さ13専用です。3つの証明コマンドは `results/winning-certificate.json`、`certificate-generation.json`、`certificate-verification.json` を再生成します。証明検証器は探索や評価関数を読み込まず、後手の全合法応手を列挙して表示イベント付き遷移で確認します。これは同じ規則エンジンを使う検証であり、独立した規則実装との照合ではありません。

| 保存ファイル（results内） | 内容 |
|---|---|
| `hand12-8-baseline.json` / `hand12-8-search.json` | 先行自己対局：各ハンド24,000局、SOUTH/NORTH交換も保存 |
| `hand12-8-crossplay.json` | 先行先後交代：各ハンド5,000局、対のseed別集計 |
| `hand12-8-proof-extended.json` | 先行限定必勝探索：深さ10はUNKNOWN、11で予算停止 |
| `hand12-8-example-games.json` / `hand12-8-verification.json` | 先行再生例と整合確認記録 |
| `hand6-baseline.json` / `hand6-search.json` | 今回の自己対局24,000局とSOUTH/NORTH交換800組 |
| `hand6-crossplay.json` | 今回の先後交代5,000局とseed別組集計 |
| `hand6-proof.json` | 終局勝敗のみの限定探索、深さ13で先手必勝 |
| `winning-certificate.json` | 先手の戦略と後手の全応手を含む証明データ |
| `certificate-generation.json` / `certificate-verification.json` | 別のAND/OR探索の生成記録、全辺再生・両座席の検証結果 |
| `certificate-negative-check.json` | 応手欠落、局面改変、不正な手を拒否した確認 |
| `winning-example.json` | 証明データの一本の経路。単独では証明ではない |
| `example-games.json` | 12個・8個・6個の自己対局例と表示遷移の一致 |
| `search-check.json` / `verification.json` | 全幅探索との432条件比較と今回の確認まとめ |
| `SHA256.json` | 記録ファイルと試験コードのSHA256（自己ファイルを除く） |

12個・8個の正式結果は先行試験のJSONをそのまま保存し、6個は今回の再実行です。準備試験は正式対局数へ足しません。自己対局や先後交代の勝率は試験した方針の値で、人間対局・最善プレイの勝率とは扱いません。必勝手順の判定と自己対局の勝率も区別してください。

将来、製品エンジンのルールが変わった場合、基準コミットのエンジンで再現してください。実行時間は環境・負荷で変わります。方針群、先後交代、必勝探索、証明生成を別プロセスで実行でき、出力を個別に保存します。証明データの再生成と検証は短時間で実行できます。


## 保存署名の適用範囲

`results/SHA256.json` と各結果のソース署名は研究記録作成時のバイト列を保存したものです。その後の文書更新やv0.8.0への対応で、現在のファイルと異なる場合があります。厳密な再現・チェックポイント再開・署名照合には、各結果の実行記録が指定するコミットを別の作業ツリーで使用してください。原記録のハッシュを現在のソースに合わせて置き換えません。
