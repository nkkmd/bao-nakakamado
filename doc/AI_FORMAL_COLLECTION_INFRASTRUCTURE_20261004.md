# 正式収集の生成・監査・暗号化保存の整備

着手日：2026年10月4日（日本時間）。規則v0.8.0、入力368bit。出発点：`5c57f1f3062f363e24282bb6352c647563cdba06`。

## 今回の対象

[教師試走](AI_TEACHER_FEASIBILITY_20261004.md)後の工程として、正式収集の除外一覧・候補生成・全体監査・途中保存・固定artifact復元・最終検証データの封印を実装した。公開の画面・簡易コンピューター、規則v0.8.0、棋譜version 7は維持する。

固定した [formal-collection-spec.json](../tools/ai-integration/formal-collection-spec.json) は条件固定当時の原記録として保持する。この文書が後続の実装状態を示す。本学習・モデル選定・最終評価・棋力判断・公開AI採用・main統合は未実施である。

## 既知局面と開幕の除外一覧

[formal-development-exclusions.json](../tools/ai-integration/formal-development-exclusions.json) は31,549種類の正規化局面hash、31,549種類の入力hash、200種類の開幕groupを持つ。出典ソースと全体digestを付け、候補生成と教師要求の前に固定する。hashだけを保存し、旧結果の数値やソースを改変しない。

[生成コード](../tools/ai-integration/formal-registry.cjs)は第1・第2段階の固定seedと実際の当時の開始側を使い、第3段階、教師試走の保存済み棋譜、既知の戦術・循環fixtureを取り込む。保守的に各対象の対局経路全体と1手先も除外する。通常終局・安全停止・総KETE違いなど入力領域外の局面は正式データに入らない。

今回の処理確認用seed index 850000〜850023の経路も、正式validation/finalの既知コーパスへ追加した。処理確認では全partitionが閲覧済みになるため、そのデータを独立評価と扱わない。正式収集では既知の局面・入力・開幕groupをvalidation/finalから除外する。単に別seedを使うだけでは独立性の根拠にしない。

除外範囲は列挙した開発コーパスと保守的な近傍である。内部の探索が訪れたすべての子孫や、人がこれまで見たすべての局面の完全な履歴ではない。新しい開発データを閲覧した場合は、正式教師要求の前に除外一覧を更新・再固定する。

## 候補生成と教師要求の固定

[formal-collection.cjs](../tools/ai-integration/formal-collection.cjs) は登録済みの正式仕様と明確に区別した開発仕様だけを受け付ける。正式は4096seed・4方針・開幕12手・最大400手。通常のply 12/25/40、最後の進行中局面、確保分のみ・2/3個投入・最後の通常ハンド・NAMUA終了付近の最初の該当局面を候補とする。

すべての候補を開幕groupで分割し、正規化局面と二値入力の両方で、splitをまたぐ同一局面の全コピーを隔離する。候補全体の照合は8192要求への切詰めより先に行う。同一splitの重複は固定順の最初を残し、既知局面と既知開幕を除外する。groupの文字列順、各group内のunit ID・ply順でround-robinを行い、候補の原盤面・入力・全棋譜・group・split・ソース・除外一覧を一つの計画digestへ固定する。

標準初期配置から通常処理で全棋譜を再生し、seed・開始側・合法手・開幕group・原盤面・入力を照合する。候補の件数と必要層が不足したら教師要求前に `HOLD-BEFORE-TEACHER` とする。教師計測後の不足は `HOLD` とし、split移動・自動再試行・未登録seed拡張を行わない。

正式教師は実時計の深度4・静止探索1・5000msを使う。16shard、各最大512要求、worker上限60分。未完了・時間切れ・安全停止・非合法手・不正入力を教師ラベルへ採用しない。終局線の教師は各splitで固定順の先頭から上限を適用し、残す行の20%を超えない。capによる除外数も監査する。

## 途中保存と固定artifactからの復元

計画とすべての途中計測を、Node標準ライブラリのAES-256-GCMで暗号化して保存する。ランダムな12byte IVと16byte認証tagを使い、計画digest・要求index・用途を追加認証データに結び付ける。鍵は配信物・git・artifact・ログへ入れない。開発試験では公開された専用テスト鍵だけを使い、正式workflowはこのような同一byteの鍵を拒否する。

各計測は一時ファイルからrenameして完了させる。再開は現在のソース・設定・除外一覧・計画と復号の認証を照合し、完了した計測だけを再利用する。採用されない時間切れの記録も完了計測として保持する。途中 `.tmp` を採用せず、ソースや計画を変更した記録を黙って再生成しない。

[formal-artifact.cjs](../tools/ai-integration/formal-artifact.cjs) はrepository・run・attempt・head SHA・artifact ID・名前・APIのSHA-256 digestを固定したreceiptだけを受け付ける。attempt専用APIを使い、ZIPの実byteのSHA-256、暗号化payload、計画との対応を確認してから復元する。ダウンロード先へのリダイレクトへGitHubの認証ヘッダーを転送しない。

ZIPは全entryを先に検査し、ディレクトリ越え・重複名・symlink・予期しないファイル・容量超過・CRC/JSON不正を拒否する。展開は一時ディレクトリで行い、検証後に未使用の復元先へ移す。測定自身の元run情報と復元receiptを保持し、新runの新規計測として数えない。

## 最終検証の封印と開封条件

全shardの集約後、trainとvalidationを別ファイルへ出力し、finalは暗号化した `final.sealed.json` とdigestのみを公開する。finalの行・局面・label・層別件数をログや通常のsummaryへ出さない。詳細監査も暗号化する。集約を再実行しても既存のsealを置き換えない。

`open` は収集の必要件数・必要層の通過、計画・監査・finalのdigest、固定モデルのファイルhash、固定validation基準と観測値の合格を要求する。開封意思・固定日時を持つgateと、排他的な開封記録を作り、同じ収集ディレクトリでの2回目を拒否する。本学習前にformalの開封gateを作らない。

これは運用上の開封条件と改ざん検出であり、鍵の保持者から復号権限を取り上げる仕組みではない。復元したディレクトリのコピー間で開封を繰り返さないよう、実際の開封gate・開封記録を採用記録に残す。モデル選択や評価の条件は本学習の前に別途固定する。

## 処理確認の結果

専用テストで、登録条件の変更拒否、既知局面・開幕の除外、件数制限前のsplit間重複隔離、入力順の不変性、通常再生、誤った鍵・認証tag・payload・用途の拒否、部分再開、失敗計測の保持、終局線20%上限、shard欠落、sealの保持、開封gateと2回目拒否、artifact receiptとZIPの異常を確認した。

小規模パイロットは [formal-development-spec.json](../tools/ai-integration/formal-development-spec.json) の別namespaceで行う。時計固定の深度2、96経路から96教師要求を使い、全partitionを処理確認用として閲覧する。正式教師の実時間・棋力・独立検証の成績へ読み替えない。正式教師データは未収集で、本学習も行っていない。

ローカルの専用14テストが成功した。開発パイロットは443候補から重複117件を除き、上限96教師要求をすべて完了した。採用後はtrain 48・validation 30・開発final 18行、groupは28/18/11、split間の漏洩0件。部分再開は2件再利用・22件生成、全完了からは4shardすべて24件再利用・新規0件だった。終局線capによる除外はこの標本では0件で、上限そのものは故意の偏ったテストで確認した。

[パイロット記録](../tools/ai-integration/formal-infrastructure-verification.json)にソースhash・計画・除外一覧・再開・sealのdigestを保存する。Actionsと別runからの実artifact復元は追加CIで確認する。

## 正式条件の候補監査で判明した不足

教師要求前の [候補監査結果](../tools/ai-integration/formal-candidate-preflight-results.json) は `HOLD-BEFORE-TEACHER`。4096seed×4方針の16,384経路から79,974候補を生成し、split間の同一局面73コピー、既知局面133件、既知開幕26,536件、同一split重複13,539件を除いて39,693候補を得た。固定のround-robinと8192要求の上限を適用した段階で必要層が不足した。経路はすべて通常終局し、教師評価は0件である。

| train / validationの層 | 選択数 | 必要数 |
|---|---:|---:|
| trainのMTAJI | 10 | 512 |
| trainの確保分のみ | 0 | 16 |
| validationのMTAJI | 3 | 128 |
| validationの確保分のみ | 2 | 4 |

finalの候補・層別件数・盤面・入力は表示せず、必要条件の未充足という判定だけを記録した。正式の教師targetや最終検証の成績を見て条件を変更したものではない。固定順はgroup内の早いplyを優先するため、上限に達するまでにNAMUAへ偏り、後半のMTAJI・境界候補を残せなかった。

今回の実装は不足を検出して本収集を停止できる状態であり、正式収集開始の判定は保留である。v1の条件や結果を上書きしない。次は教師評価前に、全体重複監査後の候補から各splitの確保分のみ・MTAJIなどの最低枠を先に確保し、残枠をgroupのround-robinで埋める収集計画v2を別IDで具体化する。まず既存seed範囲・8192要求・同じ最低件数で候補が充足するか検証する。単に最低件数を緩和したり、最終検証を開封して調整したりしない。

## 実行と出典

[再現用README](../tools/ai-integration/README.md)を参照。正式の手動 [workflow](../.github/workflows/formal-collection.yml) は鍵が未設定なら候補生成前に停止する。PR/pushのCIは開発パイロットだけを実行し、正式収集を自動開始しない。

追加の処理は本リポジトリで実装した。Node/Pythonの標準ライブラリを使い、新しい外部パッケージは追加しない。Nodeの [Crypto API](https://nodejs.org/docs/latest-v24.x/api/crypto.html)、GitHubの [workflow run attempt API](https://docs.github.com/en/rest/actions/workflow-runs#get-a-workflow-run-attempt)、[artifact API](https://docs.github.com/en/rest/actions/artifacts) を確認した。CIの公式 `actions/download-artifact@v4` の出典・MIT表示は [LICENSES.md](../LICENSES.md) に保持する。

説明文はCC BY-SA 4.0、コード・設定・機械可読記録の保護される部分はMIT。Bao Nakakamado・NYAKUAの考案者nkkmd、初公開日2026年9月30日、元プログラムの著作権・ライセンスは維持する。
