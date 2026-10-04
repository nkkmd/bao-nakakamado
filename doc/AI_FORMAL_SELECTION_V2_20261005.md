# 正式教師収集の選択計画v2と候補監査

作成日：2026年10月5日（日本時間）。規則v0.8.0、棋譜version 7、入力368bit。出発点：`2f968da2a05a1d1cf47eb28ef093810102354726`。

## 結果と対象

[v1の基盤整備・保留記録](AI_FORMAL_COLLECTION_INFRASTRUCTURE_20261004.md)で判明したNAMUAへの選択の偏りを修正した。必要な層を先に確保するv2は、同じseed範囲・候補母集団・split割当・除外一覧・8192要求上限で、すべての候補最低条件を満たした。判定は `CANDIDATES-SUFFICIENT-FOR-TEACHER`。正式教師要求は0件、正式教師データ・学習モデルはまだ作成していない。

候補の充足は、本収集後の採用件数や層の充足、棋力の合格を意味しない。計測後の不採用と終局線20%上限を適用して再監査し、不足ならHOLDとする。公開の簡易コンピューターとゲーム規則を維持する。準備基盤はPR #17でmainへ統合した。

## 教師評価前に固定した条件

[formal-collection-v2-spec.json](../tools/ai-integration/formal-collection-v2-spec.json)を、候補監査前のコミット `8a66cdf41a26ab91cb60c294ac8afb3cc76c7c96` に固定した。v1の仕様・結果・除外一覧は原記録のまま保持する。

| 項目 | v2の扱い |
|---|---|
| seed・経路 | index 900000〜904095、4096seed×4方針、標準初期配置から通常処理 |
| 候補の定義 | v1と同じply 12/25/40・最後の進行中局面・境界層の最初の該当局面 |
| split | v1と同じsaltとpartition namespaceを使用。groupを別splitへ移さない |
| 実データのnamespace | `formal-collection-v2-unopened-holdout`。v1計画やチェックポイントと混在させない |
| 上限・教師 | 8192要求、16shard×最大512、実時計深度4・静止探索1・5000ms |
| 採用の最低件数・層・開幕group | v1と完全に同じ。train/validation/finalの最低行数は2048/512/512 |
| 選択の余裕 | 各最低値の5/4を切り上げた件数を目標にする。候補と上限の範囲で確保し、採用基準を緩めない |
| 不足・終局線・再試行 | 不足ならHOLD。終局線は各splitで20%以内。完了した時間切れを自動再試行しない |

選択目標の25%の余裕は、時間切れや終局線除外に対する保証ではない。層の重なりにより一つの局面を複数の必要条件へ数えるが、同じ局面を複数の教師要求へ複製しない。

## 選択と正式扱いの実装

[formal-selection-v2.cjs](../tools/ai-integration/formal-selection-v2.cjs)を、候補全体のsplit間重複隔離、既知局面・入力・開幕の除外、同一splitの重複除去の後に適用する。ラベル・教師評価・最終検証の成績を選択へ使わない。

train→validation→finalの固定順で、確保分のみ、2個投入、最後の通常ハンド、NAMUA終了付近、MTAJI、3個投入、自分の確保分、相手の確保分、NAMUA、北、南の順に必要層の目標枠を埋める。各層では開幕groupの文字列順・group内のunit IDとply順のround-robinを使う。既に選んだ局面が満たすすべての層へ加算し、二重選択を防ぐ。次に開幕group数と行数の目標を満たし、残枠を全体のround-robinで埋める。

最終の行順・配置・入力・棋譜・設定・ソース・除外一覧は一つの計画digestへ固定する。実棋譜の通常再生で8192件を照合した。全候補からの選択を逆順入力でも繰り返し、選ばれた局面と順序が同じことを確認した。

正式扱いの判定をv1だけに限定せず、v2にもActions provenanceと実時計、formal artifact名、開発データではない集約表示を適用した。shard入口でも候補条件を再確認し、不足した計画はファイル作成・教師呼出しの前に拒否する。手動workflowは `collection_version: v2` を選べ、復元時は選択した版と暗号化計画のIDを一致させる。

## 全経路の候補監査

[初回ローカル記録](../tools/ai-integration/formal-selection-v2-preflight-results.json)、[修正後のCI記録](../tools/ai-integration/formal-selection-v2-ci-preflight-results.json)と [検証コード](../tools/ai-integration/verify-formal-selection-v2.cjs)にソースhash・設定・除外一覧・計画digest・確認項目を残す。

16,384経路はすべて通常終局。79,974候補からsplit間同一局面73コピー、既知局面133件、既知開幕26,536件、同一split重複13,539件を除き、39,693候補を得た。これらの数値はv1と一致する。変更は8192件への選択であり、経路追加・最低件数変更・split変更を行っていない。

| 層 | v1の選択数 | v2の選択数 | 採用後の必要数 |
|---|---:|---:|---:|
| trainのMTAJI | 10 | 640 | 512 |
| trainの確保分のみ | 0 | 20 | 16 |
| validationのMTAJI | 3 | 160 | 128 |
| validationの確保分のみ | 2 | 5 | 4 |

trainは5019行・2296group、validationは1517行・707group。両splitですべての最低層を満たす。finalは必要条件の通過だけを出力し、盤面・入力・ラベル・層別件数を表示しない。全体の正規化局面・入力の重複0件、split割当の維持、v1のtrain/validation選択の再現、選択順の不変性、8192件の通常再生を確認した。

除外一覧digestは `eda140703e63bc813c2284427e2b471312f103c0ffb0cdfcbdfa36f0d4827a3c`。初回実装 `61a81f3` のローカル・CI候補計画digestは `4b44b5173175e8ba9902cd4566036b04e3d34bc821a2d66164892606e077faf9`。テストfixture修正後の `1e4d008` のCIでは `891329b4e865c97591211072acb18db53022a9704fb0dc7fd0dd479c70600a03`。テストのソースhashも計画へ結び付けるためdigestは変わるが、選択条件・母集団・選択数は同じである。保存済み結果はそのソースhashに限定する。旧v1計画や途中計測は新しいソースへ復元できず、旧記録を再現するときは指定した過去コミットを使う。

## テスト・CI・再現

新規8テストでは、v1から維持する条件、1000groupのsplit一致、後半の希少層の優先、入力順の不変性、ラベルへの非依存、層の重なり、優先枠にも適用される全候補重複隔離と既知入力・開幕除外、候補不足・小さな上限、v2の時計・provenance・候補ゲート、artifact名・正式表示、手動workflowの版登録を確認した。既存14件と合わせた22件はローカルで成功した。

全経路の候補監査は専用Actions job `formal-selection-v2-preflight` に追加した。PR/手動CIで教師要求を行わずに再現し、候補条件の通過を要求する。通常CIの開発パイロット・実artifact復元・既存探索・入力・ゲーム・ブラウザー回帰も継続する。修正後の [Actions run 37241135284](https://github.com/nkkmd/bao-nakakamado/actions/runs/37241135284)、attempt 1、head `1e4d0081d7cdbca9108cd0c8065cb1225bb68d81` で全8ジョブ成功。89テスト、全候補の必要条件、8192件の通常再生・選択の不変性・重複0件、482入力観点・1926全探索比較・24887遷移・400局・実ブラウザー回帰が通過した。開発用96件の実artifact別worker復元も新規教師要求0件で成功した。[CI実行記録](AI_FORMAL_SELECTION_V2_CI_20261005.json)にrun/attempt、対象SHA、job、artifact IDとdigest、候補結果、開発復元、適用範囲を保存する。

最初のrun 37240970166は候補監査を通過したが、新規テスト1件が失敗した。拒否対象のoriginを省略したテストがローカル環境を仮定し、Actionsの正常なrun情報によって別の候補ゲートで拒否されたためである。`1e4d008` でローカルoriginをテスト内に明示し、同じ候補条件のまま全テストを再検証した。旧ローカル記録を上書きせず、修正後のソースに対応したCI候補結果を別ファイルに保存する。

```sh
node --test tools/ai-integration/formal-selection-v2.test.cjs tools/ai-integration/formal-collection.test.cjs
node tools/ai-integration/verify-formal-selection-v2.cjs /tmp/bao-selection-v2-preflight-new.json
```

未使用の出力ファイルを指定する。verifierは教師を呼ばず、候補の計画本体・finalの詳細を出力しない。再現の原記録や正式finalを上書き・開封しない。

## 次の工程

[正式収集の起動・再開手順](AI_FORMAL_COLLECTION_LAUNCH_20261005.md)に、記録追加後のrun 37241607076の全8ジョブ成功、既定ブランチへのworkflow配置、鍵設定、固定入力、途中復元、採用後の監査を具体化した。起動前の操作は承認済みで、PR #17をmainへ統合した。[workflow登録・起動状況](AI_FORMAL_COLLECTION_ACTIVATION_20261005.md)のとおり、現在はブラウザー認証待ちで正式教師要求は0件。

候補ゲートは通過した。次はv2の設定・実装SHA・除外一覧を固定した正式手動収集を行う。収集用の独立した32byte鍵をsecret `BAO_COLLECTION_KEY_BASE64` に設定し、workflowの起動可能性を確認する。workflowはmainへ統合済みで、正式手動収集は未起動。起動時は `collection_version: v2`、新規収集は `resume_receipts: []` とする。

今回利用するGitHub接続にはsecret設定とworkflowの新規手動起動の機能がない。鍵の設定済み／未設定も確認できていない。PR更新で自動起動するCIによって全候補監査を再現し、本収集の起動経路と鍵管理は、承認済みのブラウザー操作で整える。main統合と正式収集の開始を区別し、未起動の収集を始めたとは扱わない。

計測後に受理率・件数・必要層・開幕group・終局線上限・漏洩を全shardで再監査し、通過したデータのfinalを封印する。その後、学習器とモデル比較・validationの数値基準を正式評価前に固定する。本学習・最終開封・棋力評価・Worker接続・公開AI差し替えは未実施である。

追加処理はNodeの標準ライブラリと既存の本リポジトリのコードを使い、新しい外部依存や元ゲームの学習済みモデルを取り込まない。説明文はCC BY-SA 4.0、コード・設定・機械可読記録の保護対象部分はMIT。[出典・適用範囲](../LICENSES.md)と元プログラムの表示、Bao Nakakamado・NYAKUAの考案者nkkmd、初公開日2026年9月30日を維持する。
