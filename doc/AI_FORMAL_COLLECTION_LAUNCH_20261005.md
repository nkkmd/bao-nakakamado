# 正式教師収集v2の起動・再開・封印手順

> 後続更新（2026年10月5日）：PR #17をmainへ統合した。正式workflowの一時パス定義を修正し、全8 CIジョブ成功を確認した。[workflow登録・起動状況](AI_FORMAL_COLLECTION_ACTIVATION_20261005.md)を参照。本書の数値・条件・当時の未実行状態は原記録として保持する。正式収集v2のrun 37245789837は8192件の収集・全体監査・封印を通過した。[実行記録](AI_FORMAL_COLLECTION_RUN_V2_20261005.md)に全18ジョブ成功と未学習・未開封の範囲を記録する。

作成日：2026年10月5日（日本時間）。対象：Bao Nakakamado v0.8.0、棋譜version 7、入力368bit。[選択計画v2](AI_FORMAL_SELECTION_V2_20261005.md)の次の運用工程。正式収集はまだ起動していない。

## 検証済みの起動条件

記録追加後のhead `e22e94a806c93dedccc60623aef1da2bb7fa6663` の [Actions run 37241607076](https://github.com/nkkmd/bao-nakakamado/actions/runs/37241607076)、attempt 1が全8ジョブ成功した。89テスト・ブラウザー回帰・全候補条件・開発用artifact復元が通過した。候補計画は前回の修正後CIと同じdigestである。[機械可読の起動記録](AI_FORMAL_COLLECTION_LAUNCH_20261005.json)に、確認したSHA・CI・入力・未実行の操作を区別して保存する。

| 固定対象 | 値 |
|---|---|
| config ID | `NAKAKAMADO-FORMAL-COLLECTION-20261005-v2` |
| 候補計画digest | `891329b4e865c97591211072acb18db53022a9704fb0dc7fd0dd479c70600a03` |
| ソースdigest | `4e4d3acfbcfb5de5c9bf7e77accd8b3dbd26649389c0ab06471a025275d0cdac` |
| 除外一覧digest | `eda140703e63bc813c2284427e2b471312f103c0ffb0cdfcbdfa36f0d4827a3c` |
| 要求・分割 | 最大8192件、16shard、各最大512件 |
| 教師 | 実時計、深度4、静止探索1、5000ms |
| 手動入力 | `collection_version: v2`、新規収集は `resume_receipts: []` |

文書だけの追加ではこれらのソース・候補計画digestは変わらない。ゲーム、収集コード、固定条件、hash対象テストなどを変更した場合は同じ計画として実行せず、検証をやり直す。実際の起動では、その時点のPR head・merge SHA・run headを記録し、準備結果のソース・計画digestを上表と照合する。

## 起動前に必要な操作

2026年10月5日の確認時点の既定ブランチは `main`、SHAは `c99f13537c3dbb0275a1c3e9888e882b0a3e134d`。[PR #17](https://github.com/nkkmd/bao-nakakamado/pull/17)は未統合で、mainには `.github/workflows/formal-collection.yml` が存在しない。GitHubの [workflow_dispatchの説明](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)では、手動起動のイベントを受け取るにはworkflowを既定ブランチに置く必要がある。

1. PRの最終head・検証結果・文書整合を確認し、mainへ統合して手動workflowを登録する。受け入れたheadとmerge SHAを記録する。この統合を公開AIの採用や正式収集の成功と扱わない。
2. 対象リポジトリのActions secret `BAO_COLLECTION_KEY_BASE64` の存在をGitHub画面で確認する。既存の値を盲目的に上書きしない。存在しない場合は暗号学的な乱数による独立した32byte鍵をbase64形式で登録する。鍵の値は会話・git・ログ・artifactへ保存しない。開発の公開テスト鍵は使わない。設定方法はGitHubの [Secretsの説明](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)に従う。
3. Actionsの `NYAKUA formal teacher collection` を、検証済みソースを持つ作業ブランチで一度だけ起動する。版は `v2`、新規収集のreceiptは `[]`。起動直前のbranch headと、作成されたrun ID・attempt・head SHAを記録する。
4. prepareの候補条件通過、config ID、plan digest・source digest・registry digest、8192要求を確認する。鍵・原盤面・finalの詳細をログに出さない。prepareが停止したら、教師収集が開始したとは報告しない。

現在のGitHub接続はsecret設定・存在確認とworkflowの新規手動起動を提供しない。ブラウザーへの切替には操作ルール上の事前承認が必要なため、その承認を得るまで画面操作・鍵設定・手動起動は行わない。鍵の設定有無は未確認。承認前に鍵を生成したり、存在すると推定したりしない。

## 途中保存と再開

各shardのworker上限は60分。完了計測は採否に関係なく認証付き暗号化checkpointとして保存する。失敗時も `formal-shard-0`〜`formal-shard-15` のartifactを保存する。時間切れの測定を新たな成功ラベルで置き換えず、未完了要求だけを実行する。

再開には元artifactのrepository・run ID・attempt・head SHA・artifact ID・name・API digestを固定したreceipt配列を作る。run全体の最新attemptと元のattemptを混同しない。APIメタデータとZIP実byteのSHA-256、展開entry、暗号化計測と計画・現在ソースとの一致を検査する。元計測のoriginを保持する。

再開例は実際のreceiptを取得してから作る。未取得のID・digestを推定しない。shardごとに利用するartifactは一つに固定し、すでに全件完了したshardも復元する。完了artifactを全shard分引き継がないと、新runで完了要求を再計測してしまう。途中の `.tmp` を完了計測に数えない。

同じ版・ソース・除外一覧・候補計画・鍵でのみ再開する。artifactの保存期限は30日。ソースや鍵を変更した復元失敗を、自動再生成で隠さない。全shardの完了が揃わない間はデータ採用の判定に進まない。

## 全体監査と完了判定

全16shardを照合して集約する。受理率95%以上、終局線の固定順20%上限適用後のtrain/validation/final最低行数2048/512/512、開幕group数、仕様の各最低層、局面・入力の重複0件を要求する。候補選択時の余裕を、計測後の充足保証と扱わない。

条件を満たす場合は `READY-FOR-TRAINING-DESIGN` とし、trainとvalidationを出力してfinalと詳細監査は暗号化したまま保存する。finalのdigest・必要条件通過・暗号文hashだけを通常のsummaryに載せる。条件不足ならHOLD。split移動・自動再ラベル・未登録seed追加で埋め合わせない。

この工程では `open` を実行しない。本学習、モデルファイルとvalidation判定基準の固定、最終開封、棋力と端末評価は後続工程。正式runが完了した後に、実測の受理率・採用数・所要時間・除外理由・run/attempt/artifact・計画とソース・sealのdigestを別の収集結果として保存する。元の候補監査や旧パイロット結果を上書きしない。

説明文はCC BY-SA 4.0、機械可読記録の保護対象部分はMIT。[出典・ライセンス](../LICENSES.md)、考案者nkkmd、Bao Nakakamado・NYAKUAの初公開日2026年9月30日を維持する。規則・公開AI・mainへの変更や収集実行は、この手順の作成をもって実施済みと扱わない。
