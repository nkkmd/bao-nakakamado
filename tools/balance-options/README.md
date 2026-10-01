# 先後バランス候補の調査コード

[調査計画](../../doc/BALANCE_OPTIONS_PLAN_20261001.md)に従い、同数ハンド、非対称ハンド、NYUMBA機能と配置の順に比較する。[完了した報告](../../doc/BALANCE_OPTIONS_STUDY_20261001.md)は19条件・別seed確認5条件、計255,200局をまとめる。基準エンジンはv0.6.0、`4e38478828319d664575dbbbfbb90e1df17eaf7f`。試作本体のルールは変更しない。

## 条件と実行

`configs.cjs` が条件を定義する。`hands` は **先手、後手の順**。両者の自分視点の初期配置は `pits`、NYUMBAの停止と通常takataの開始制限の個数は `threshold`。位置のindex 4、入口のindex 6、NYUMBAの2個蒔きは変更しない。

リポジトリ直下から実行する。Node.js v24.19.0、外部ライブラリ不要。

```sh
node tools/balance-options/check.cjs tools/balance-options/results/checks.json
node tools/balance-options/search-check.cjs tools/balance-options/results/search-checks.json
node tools/balance-options/run.cjs equal-9 tools/balance-options/results/reproduced/screen/equal-9 screen
node tools/balance-options/certify.cjs tools/balance-options/results/reproduced/screen/equal-9
node tools/balance-options/run.cjs asym-9-11 tools/balance-options/results/reproduced/formal/asym-9-11 formal
node tools/balance-options/certify.cjs tools/balance-options/results/reproduced/formal/asym-9-11
```

`screen` は各条件5,800局（単純4方針各1,000局、探索4方針各200局、5組合せの先後交代各100組）。`formal` は29,000局（単純各5,000局、探索各1,000局、先後交代各500組）。座席交換はそれぞれ8方針各10組／100組で、勝率の分母から除く。

## 保存と再開

各方針・先後交代組合せ・座席交換・必勝探索を別JSONに保存し、最後に `summary.json` へまとめる。JSONは一時ファイルからのrenameで更新する。途中で停止した場合、同じコードと条件で同じ出力先を指定すれば完了済みのJSONを再利用する。

署名は、条件、局数・seed・探索予算と、core・adapter・runner・規則エンジンのSHA256を含む。署名が違う出力は再利用しない。追加の条件定義や説明文の変更では、既存条件の実行内容が同じなら再利用できる。今回の記録を保つため、再実行では `reproduced/` の別出力先を使うことを推奨する。

Actionsは条件ごとに実行し、失敗時も保存できた途中結果をartifactへ残す。artifactの保持期間は30日。正式な結果と再現コードはリポジトリへ記録済み。

正式な保存では、全方針・先後交代のseed別集計・座席交換・必勝探索・実行設定と署名を含む `summary.json` を保存する。重複する個別チェックポイントは、保存されたsummaryから復元できる。

```sh
node tools/balance-options/restore-checkpoints.cjs tools/balance-options/results/screen/equal-9
```

復元後に同じ出力先でrunnerを実行すると、完了した計算を再利用する。summaryだけからの復元・再開も確認済み。`report.py` は完了した19条件と追加確認5条件のJSONから報告書・索引を生成する。

## エンジンと検証

`variant-engine.cjs` は現行エンジンを隔離したVMで読み、値によるNYUMBA判定の3箇所だけを変更する。置換対象が各1箇所であることをassertする。`core.cjs` の着手方針・評価・探索は先行 `tools/hand-balance/balance.cjs` を基にしている。初期局面と総KETE数の検証を条件に対応させ、先後に結びつくハンド数を座席交換でも保つ。

`check.cjs` は現行条件の379候補遷移と40通りの手選びを元コードと比較する。閾値4の開始制限と停止動作、2個蒔きの維持、非対称ハンドの座席交換も確認する。`search-check.cjs` は条件ごとにαβ探索の選択を全幅ミニマックスと比較する。

`certify.cjs` は必勝判定が得られた条件について、終局勝敗のみの別のAND/OR探索で戦略証明を作り、探索・評価を使わず全防御応手を表示イベント付き遷移で再生確認する。既知のハンド6個の証明を両座席で再検証し、応手欠落・不正な手・局面改変の3例を拒否することも確認した。探索予算不足やUNKNOWNは均衡や引き分けの証拠ではない。

製品エンジンが将来変更された場合は、基準コミットのエンジンを使って再現する。

## Actionsでの再実行と報告書

GitHub Actionsの `Balance options investigation` または `Balance options formal validation` を手動実行し、`conditions` に `configs.cjs` のIDをJSON配列で指定する。例：`["asym-9-11"]`。pushによる自動試験は調査終了後に解除した。出力先は `results/reproduced/` で、今回の保存結果と分ける。製品エンジンが基準コミットと一致していることを先に確認する。

今回の19＋5条件の保存結果から報告書と索引を生成する：

```sh
python3 tools/balance-options/report.py
```

[実行記録](results/provenance.json)、[全体索引](results/study-index.json)、[検証結果](results/verification.json)、[保存ファイルのSHA256](results/SHA256.json)を参照。
