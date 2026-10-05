# 凍結線形モデルの正式最終評価・一回限定の実行記録

2026年10月5日（日本時間）。Bao Nakakamado v0.8.0・棋譜version 7。考案者nkkmd、初公開日2026年9月30日を維持する。

凍結済みの線形seed 2026100401を正式finalで一度だけ評価し、固定18条件をすべて通過した。判定は `FINAL-TEACHER-REPRODUCTION-PASS-NOT-PUBLIC-ADOPTION`。教師評価の再現性に関する合格であり、同時間探索の棋力・公開AI採用は後続工程である。

## 承認と実行条件

[worker工程](AI_FORMAL_FINAL_WORKER_20261005.md)の初回起動は、具体的な正式開封の承認を確認できないとして自動承認審査がクリック前に拒否した。未起動・受付タグ未作成・未開封を確認し、別経路で回避しなかった。この原記録は [CI記録](AI_FORMAL_FINAL_WORKER_CI_20261005.json) に保持する。

その後、ユーザーの「承認します。進めてください」を、凍結済み線形モデルの固定条件による正式finalの一回限定開封とActions最終評価起動への具体的な承認として確認した。main SHA・runner fingerprint・手動run 0件・受付タグ未作成を再照合し、ブラウザーの `Run workflow` を一度だけクリックした。

- [正式run 37266659230](https://github.com/nkkmd/bao-nakakamado/actions/runs/37266659230)、attempt 1、`workflow_dispatch`、main。
- head `d61c13e92fc751bf60282949c1290dcb469edcec`。起動14:11:20 JST、評価完了14:11:40 JST、workflow成功・所要28秒。
- runner fingerprint `8f22d999872964b2e4ed692202ca78f2b0aaa2b447f26f5b15831c38a15bf746`。
- モデル1612 bytes、SHA-256 `f74175fbaa6f2d6a82148cf5e106da7291f396b2b38cb79866dc641b2147254d`。
- 最終行digest `1750a34d21bcc824133b23647033317fbcb7894cdac70625c0c45b6622ec2a03`。

旧準備仕様・receiptの `authorizedToOpenOnce: false` は当時の原記録として変更していない。今回の承認は [実行authorization](formal-final/authorization.json) に固定head・実run・attempt・fingerprintを結び付けて別途保存した。元の収集・学習・準備fingerprint、凍結モデルbytes、数値閾値を変更していない。

## 正式結果

正式finalは1656行・782開幕グループ。全行の通常再生・入力・教師ラベル・元digestを照合したworkerの結果を保存した。主指標・phase MSE・12層MAE・モデル量・推論時間・整数一致の全18条件が通過した。原数値・全12層・全18条件は [原報告](formal-final/report.json) を参照する。

| 指標 | 手作り基準 | 凍結線形モデル |
|---|---:|---:|
| 開幕グループ平均MSE（主指標） | 0.18843427206447563 | 0.06260110726238617 |
| 全体MSE | 0.19663598456820428 | 0.06752990697317077 |
| 全体MAE | 0.37170587069746375 | 0.18423476656853865 |
| NAMUA MSE（1496行） | 0.1853484546436983 | 0.0574689185555606 |
| MTAJI MSE（160行） | 0.3021743893623352 | 0.16160014867782593 |

主指標の教師再現誤差は約66.8%小さかった。Python／JavaScriptの整数出力1656件は不一致0件、反対側評価の反対称性も1656件通過。モデル推論中央値は2.285283000000163 µs（200回warmup後、1000回×5の固定測定）。実行環境はNode v24.21.0、Python 3.12.14、NumPy 2.3.5、Linux x64、Intel Xeon 6973P-C。この速度はActions runner上の値であり、スマートフォンでの実測ではない。

各層は重なりがあり、件数を足して全体件数としない。確保分のみは5行、2個配置は10行など少数の層も含む。既定の層条件を通過した事実を記録し、少数層から棋力や先後均衡を推定しない。

## 一回限定受付と永続保存の照合

受付refは `refs/tags/nyakua-final-open-1750a34d21bcc824133b23647033317fbcb7894cdac70625c0c45b6622ec2a03`。tag object SHAは `c43d967db5797a13dab403c6992196fbd46b791d`、対象commitは今回のheadと一致する。タグmessage・[claim](formal-final/claim.json)・authorizationのdigest・run/attempt/head・モデルと最終行digestを照合した。受付は保存したまま維持し、run再実行・受付削除・再開封を行わない。

永続結果ブランチは `nyakua-final-result-1750a34d21bcc824133b23647033317fbcb7894cdac70625c0c45b6622ec2a03`、結果commitは `3e20726037eefbbe150cd2fef13d03b06032c433`。固定headだけを親に公開JSON3ファイルだけを追加したことを確認した。mainへも原JSONを同じbytesで保存する。

公開artifactは `formal-final-public-records`、ID 11326153296、3642 bytes、ZIP digest `sha256:aeb3a5354df3c05227fd567f54851430cd5e73a4546445fe14a87e32eccacfd8`、期限2026年11月4日14:11:43 JST。取得後にdigest・全CRC・4ファイル限定を確認した。authorization・claim・reportはGit原本とbytes単位で一致し、[publication](formal-final/publication.json) の結果commit・report SHAも一致した。報告SHA-256は `d575e1d31d1fa4b6a947b2358f71a2a79333c16b116e7d5f76a426a1047f21b6`。

公開schemaの検証と元18条件の再計算、旧preflight、runner fingerprintの一致を確認した。この照合は公開集計とGit記録だけを使用し、正式finalの再復号・行再読込み・候補再評価を行っていない。APIのrun・job・artifact・受付・結果commitと照合項目は [実行記録JSON](AI_FORMAL_FINAL_RUN_20261005.json) に保存する。

![正式final評価runの成功](verification-images/formal-final-run-37266659230-complete-20261005.jpg)

## 次の工程

凍結モデルをBao Nakakamado専用探索へ接続し、開発用局面で整数評価・終局・安全停止・合法手・予算管理を確認する。既存の手作り評価と比較できる経路を維持する。その後、同時間対局の対象・時間・局数・指標・採用条件・独立seedを固定して先後交換の比較を実行し、moto g52j 5Gを含む実機検証へ進む。

本結果だけで棋力向上、AI-GEN4と同じ強さ、公開コンピューターへの採用、ニャクアの先後均衡を主張しない。今回のfinalでモデル・seed・閾値を再調整しない。公開画面はまだ凍結モデルを読み込まない。

説明文はCC BY-SA 4.0。コード・設定・保護対象の機械可読記録はMIT。[出典と利用条件](../LICENSES.md)を維持する。
