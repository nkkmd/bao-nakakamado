# AI導入の基盤検証

[導入計画](../../doc/AI_INTEGRATION_PLAN_20261004.md)と[検証記録](../../doc/AI_SEARCH_TRANSITION_VERIFICATION_20261004.md)の再現用ツール。現行v0.8.0の通常遷移と、ニャクア込みの盤面専用の探索遷移を照合する。以下の初期検証は棋力試験・本学習を行わない。後続の正式学習ツールは末尾を参照。

## 実行

リポジトリ直下で、追加依存なしに実行する。

```sh
node --test prototype/search-transition.test.cjs
node tools/ai-integration/verify-transitions.cjs 32 /tmp/transition-verification.json
```

第1引数は各方針の局数（1〜100）、第2引数は結果の保存先。正式な保存済み照合は32局×4方針＝128局。`seedAt(500000+i)` を方針間で共有するので、128個の独立seedという意味ではない。seed一覧、軌跡ハッシュ、対象ソースのSHA-256は[結果JSON](transition-verification.json)に保存する。再実行時は元の結果を上書きせず一時ファイルへ保存する。

全局面の全合法variantについて、通常の演出付き着手、探索用着手、既存の調査用の独立した会計照合 `T.advance(..., true)` の盤面と手の集計を比較する。NYUMBAのvariantは調査用 `children` とも比較する。調査用の照合も歴史エンジンを共有するため、ルール全体の独立実装による証明ではない。

入力と手は凍結して非変更を検査し、南北交換と全棋譜再構築を確認する。5つの故意の誤りを注入し、照合が検出することも確認する。人工境界局面・既知の循環・局面識別は専用テストが扱い、128局の軌跡には数えない。

## 探索への接続例

```js
const E = require('../../prototype/next-turn-engine.js');
const Q = require('../../prototype/search-transition.js').createForEngine(E);
const state = Q.initialState();
const move = Q.moveVariants(state)[0];
const result = Q.applyMove(state, move);
// result.state / result.events / result.summary
// cache key: Q.stateKey(state)
// safety status: Q.outcome(result.state)
```

ブラウザーでは `next-turn-engine.js` → `steal.js` → `search-transition.js` の順で読み込む。今回、配信画面のindex.htmlには探索アダプターを追加していない。`BaoEngine.applyMoveForSearch` を直接使うとNYAKUAの奪取が含まれないため、将来の探索は必ずこのアダプターを通す。

第2段階の[探索版の実装・検証記録](../../doc/AI_SEARCH_IMPLEMENTATION_20261004.md)と[全探索照合結果](search-verification.json)も保存した。第1段階の結果JSONと参照元一覧は当時の記録として保持する。

## 探索版の検証と利用

```sh
node --test prototype/search-ai.test.cjs
node tools/ai-integration/verify-search.cjs /tmp/search-verification.json
```

全探索照合は [search-verification-spec.json](search-verification-spec.json) の局面・深度・構成を使う。時計を固定した照合の軌跡ハッシュは再現可能だが、同じファイル内の24件の実時間試走のelapsedMsは実行ごとに変わる。

```js
const E = require('../../prototype/next-turn-engine.js');
const Q = require('../../prototype/search-transition.js').createForEngine(E);
const A = require('../../prototype/search-ai.js').createAI(Q);
const result = A.analyzeMove(Q.initialState(), {
  maxDepth: 4, timeLimitMs: 500, quiescenceDepth: 1,
});
// result.move / result.stats.completedDepth / result.stats.rootScore
```

ブラウザーでの追加順は `search-transition.js` → `search-evaluator.js` → `search-ai.js`。配信画面はまだこの探索版を読み込まない。未完了の評価値はnull、安全停止は未確定と識別する。探索版は学習済みAIでも正式公開AIでもない。

## 学習入力・教師データの処理パイロット

[第3段階の設計](../../doc/AI_LEARNING_DESIGN_20261004.md)と [learning-spec.json](learning-spec.json) に条件を記録する。Node 24とPython 3の標準ライブラリだけを使い、学習・NumPy・モデルの作成は行わない。

```sh
node --test tools/ai-integration/learning-pipeline.test.cjs
node tools/ai-integration/verify-learning-pilot.cjs /tmp/bao-learning-verification
```

検証は新しいcheckpointディレクトリを作り、96生成単位・両観点のPython/Node入力照合・1単位欠落と途中書込みからの再開・全完了からの再開を確認する。結果は指定先の `learning-pilot-verification.json`、原データと完了単位はその下の `checkpoints-*` へ保存する。[保存済み結果](learning-pilot-verification.json)は同じソースhashに限定する。

途中処理を再開する場合は、表示された同じcheckpointディレクトリを指定する。

```sh
node tools/ai-integration/learning-pipeline.cjs /tmp/bao-learning-verification/checkpoints-XXXXXX
```

設定・ソースhash・checksumが違う完了単位は拒否する。ソース変更後は別の出力先を使い、保存済み原記録を上書きしない。集約したpilotデータとsummaryは再計算する。CIは失敗時もcheckpointをartifactへ保存する。artifact期限後も保存結果と固定ソースから再現できる。

入力は368bitで、元ゲームの399bitモデルとは互換ではない。パイロットのtrain/validation/finalは処理確認用で、閲覧済みのfinalを正式な最終確認へ使わない。この旧パイロットは本収集・学習・棋力試験を行わない。後続の正式収集基盤のworkflowと復元は以下を参照。

## 実時計の教師試走と到達棋譜

[試走記録](../../doc/AI_TEACHER_FEASIBILITY_20261004.md)と [teacher-feasibility-spec.json](teacher-feasibility-spec.json) が条件と適用範囲を示す。保存済み [corpus](teacher-feasibility-corpus.json) は標準初期配置からの64棋譜、[results](teacher-feasibility-results.json) はActions run 37207204644の原計測。時計固定の処理パイロットとは別の開発用データで、正式holdoutには使わない。

```sh
node --test tools/ai-integration/teacher-feasibility.test.cjs
node tools/ai-integration/teacher-feasibility.cjs collect /tmp/bao-teacher-corpus.json
node tools/ai-integration/teacher-feasibility.cjs shard /tmp/bao-teacher-trial 0
node tools/ai-integration/teacher-feasibility.cjs shard /tmp/bao-teacher-trial 1
node tools/ai-integration/teacher-feasibility.cjs shard /tmp/bao-teacher-trial 2
node tools/ai-integration/teacher-feasibility.cjs shard /tmp/bao-teacher-trial 3
node tools/ai-integration/teacher-feasibility.cjs aggregate /tmp/bao-teacher-trial /tmp/bao-teacher-results.json
```

同じshardコマンドを再実行すると完了計測をchecksum・設定・ソース・コーパスで照合して再利用する。時間切れの計測も完了扱いで保持し、ラベルは除外する。実時間は新規実行ごとに変わるので、元の結果を上書きしない。集約は4shardをすべて要求し、混在・欠落・破損を拒否する。

PRまたは手動Actionsの4workerは、それぞれ16件を測定後、同じディレクトリで再開を確認する。pushだけのCIでは重複測定を省く。各 `shard-0`〜`shard-3` artifactと集約結果を30日保存し、失敗時も完了単位を保存する。別runから再開する場合は、対象run/attemptとAPIのartifact digestを固定・確認してZIPを展開し、上記rootの直下に `shard-0`〜`shard-3` を復元する。同じソースと設定で各shardを実行し、集約する。この旧教師試走CLIの別run自動復元workflowは実装していない。後続の正式収集用には、固定receiptを検証する復元処理を別に整備した。

通常ハンド0・確保分1の標準初期配置からの到達4件は [reserved-only-reachable-fixtures.json](reserved-only-reachable-fixtures.json)。通常処理の全棋譜再生と全合法variantの1個投入を検査する。終局・不正手・総KETE違いを教師へ混ぜない。

正式収集の現在の固定条件は [formal-collection-spec.json](formal-collection-spec.json)。この試走CLIは正式データの生成器ではない。正式の除外一覧・generator・全体監査・artifact復元・最終検証封印は以下の基盤として実装した。v1は候補の必要層不足で教師要求前に保留した。後続のv2の正式収集は後続のrun 37245789837で完了した。この基盤の整備時点では本学習は未開始だった。後続の本学習と最終評価の記録は以下を参照。前工程の `learning-spec.json` と結果は原記録として保持する。

## 正式収集基盤の処理確認と保留

[実装・監査記録](../../doc/AI_FORMAL_COLLECTION_INFRASTRUCTURE_20261004.md)、[CI記録](../../doc/AI_FORMAL_COLLECTION_INFRASTRUCTURE_CI_20261005.json)、[固定artifact復元記録](formal-pinned-artifact-resume-verification.json)を参照。追加依存なしで専用14テストと開発専用96件の処理確認を再現する。

```sh
node --test tools/ai-integration/formal-collection.test.cjs
node tools/ai-integration/verify-formal-infrastructure.cjs /tmp/bao-formal-development-new
```

出力先は未使用のディレクトリを指定する。公開テスト鍵・時計固定の深度2・全partition閲覧は [開発専用仕様](formal-development-spec.json) に限定し、正式holdoutへ転用しない。除外一覧は [formal-registry.cjs](formal-registry.cjs) から固定ソースで再生成してdigestを照合する。保存済みの除外一覧や旧結果は上書きしない。

正式条件の [事前候補監査](formal-candidate-preflight-results.json) は `HOLD-BEFORE-TEACHER`。trainのMTAJI 10/512・確保分のみ0/16、validationのMTAJI 3/128・確保分のみ2/4で不足し、教師要求0件で停止した。同じseed範囲・候補・split割当・8192要求・最低件数を維持する[選択計画v2](../../doc/AI_FORMAL_SELECTION_V2_20261005.md)を別IDに固定し、全候補条件を通過した。v1を上書きせず、収集時に版を明示する。

手動 [formal-collection.yml](../../.github/workflows/formal-collection.yml) はprepare→16shard→全体監査・封印を行う。正式起動には独立した32byte鍵のbase64をrepository secret `BAO_COLLECTION_KEY_BASE64` に設定する。鍵をコード・artifactへ含めない。手動入力 `collection_version` は `v2`（既定）または `v1`。v2は事前候補ゲートを通過し、v1は保留になる。正式手動workflow v2のrun 37245789837は全18ジョブ成功した。PR #17でmainへworkflowを統合した。runnerのパス定義を修正した後のCIも全8ジョブ成功。アカウント確認と独立した鍵の新規設定を完了した。8192件を新規計測・受理し、train 5019行・validation 1517行の必要条件と漏洩0件を確認。収集完了時点ではfinalの条件通過・digest・暗号文hashだけを公開し、開封していなかった。後続の学習・最終評価は以下の実行記録を参照。[正式収集の実行記録](../../doc/AI_FORMAL_COLLECTION_RUN_V2_20261005.md)を参照。

再開時の `resume_receipts` はrepository・runId・attempt・headSha・artifactId・name・API digestを固定したJSON配列。未再開は `[]`。同じソース・計画・除外一覧・鍵だけで復元し、元の計測originを保持する。APIメタデータ、ZIP実byteのdigest、entryの安全性、計測の認証を検査する。不採用の完了計測も再利用し、時間切れを自動再計測しない。artifactは30日で期限を迎えるため、記録したdigestだけで期限後の原ZIPを取得できるわけではない。

集約後はtrain・validationと暗号化final・暗号化詳細監査を分ける。formalの開封は必要件数通過後、モデルファイルとvalidation基準・観測値を固定し、承認意思を含むgateで一度だけ行う。学習前のformal開封gateは作成していない。

## 選択計画v2の全候補監査

[固定仕様](formal-collection-v2-spec.json)、[選択コード](formal-selection-v2.cjs)、[初回ローカル監査](formal-selection-v2-preflight-results.json)、[修正後のCI監査](formal-selection-v2-ci-preflight-results.json)、[CI実行記録](../../doc/AI_FORMAL_SELECTION_V2_CI_20261005.json)を参照。v1と同じ候補母集団・既知除外・開幕のsplit割当を使い、必要層を先に確保する。各最低値の5/4を切り上げた選択目標を持つが、採用基準は変更しない。ラベルやfinalの成績を見て選択しない。

```sh
node --test tools/ai-integration/formal-selection-v2.test.cjs tools/ai-integration/formal-collection.test.cjs
node tools/ai-integration/verify-formal-selection-v2.cjs /tmp/bao-selection-v2-preflight-new.json
```

verifierは未使用の出力ファイルを要求する。16,384経路を再生成し、v1のtrain/validation選択の再現、全候補の除外・重複件数の一致、逆順入力でのv2選択不変性、8192件の通常再生を検査する。教師要求は0件で、finalの必要条件通過だけを表示する。

PR/手動CIの専用job `formal-selection-v2-preflight` でも再現し、全候補条件の通過を要求する。run 37241135284では89テスト・全8ジョブ成功。初回のローカル記録は実装 `61a81f3`、CIの最新候補結果はテストfixture修正後の `1e4d008` に結び付く。過去の結果を現在のソースの証拠として混在させない。候補条件通過後も、正式計測の受理率・最低件数・必要層・終局線20%上限・漏洩を再監査する。旧ソースのv1計画やcheckpointは、現在のv2ソースへ再利用できない。旧結果の再現には記録した過去コミットを使う。

## 正式学習仕様・実装検証

[本学習の実行記録](../../doc/AI_FORMAL_LEARNING_RUN_20261005.md)では修正後run 37257277028の全11ジョブ成功・全9候補合格を確認した。選定した線形seed 2026100401の[モデルとreceipt](frozen-models/formal-v1-linear-2026100401/receipt.json)を凍結した。本学習完了時点のfinalは未開封だった。後続の正式評価は末尾の実行記録を参照し、公開AIはこの評価器を読み込まない。以下の手順は固定仕様の説明であり、同じvalidationの結果に合わせて条件を調整するものではない。

[仕様・検証記録](../../doc/AI_FORMAL_LEARNING_DESIGN_20261005.md)と [formal-learning-spec.json](formal-learning-spec.json) に、収集資産の固定receipt、3学習器×3seed、150epoch、比較基準とHOLD条件を固定する。Python 3.12.14・NumPy 2.3.5・Node 24を使用する。学習用の第三者コードと依存は [出典](../../LICENSES.md)を参照。既存の学習パイロット・収集仕様・原結果は変更しない。

新規17テストと開発用32局面の実装照合は、未使用の子ディレクトリを指定して実行する。

```sh
python3 -m pip install -r tools/ai-integration/formal-learning-requirements.txt
node --test tools/ai-integration/formal-learning.test.cjs
python3 tools/ai-integration/formal-learning-trainer.test.py
python3 tools/ai-integration/formal-learning-unzip.test.py
BAO_LEARNING_VERIFY_ROOT=$(mktemp -d)
node tools/ai-integration/verify-formal-learning.cjs "$BAO_LEARNING_VERIFY_ROOT/smoke"
```

smokeは既知の開発経路だけを使用し、正式artifact・収集鍵を取得しない。2epoch・batch 8、幅は本番同等。9候補の整数出力288件、反対称性・南北交換576件と、6学習候補の完全再開を照合する。正式な学習成績や150epoch完了と扱わない。

本学習は、CI通過とmain統合後のcommitを固定してから手動 [formal-learning.yml](../../.github/workflows/formal-learning.yml) で起動する。新規実行は `resume_receipts: []`。固定ZIPを取得・検査し、trainだけの9workerとvalidation jobを分ける。収集鍵・finalの復号は不要。個別のCLIは以下の順序である。

```sh
node tools/ai-integration/formal-learning-artifact.cjs /absolute/fresh-learning-root
python3 tools/ai-integration/formal-learning-trainer.py /absolute/fresh-learning-root/prepared/train/train.json logic 2026100401 /absolute/model-directory
```

Actions APIの認証は環境変数 `GITHUB_TOKEN` を使用する。値を引数・文書・git・artifactへ保存しない。個別学習器の引数は正規化済みtrainファイル1つだけで、validationのglob・早期停止を行わない。`--maximum-batches 64` は学習更新を途中で保存するための制限で、epochや採用条件は変更しない。同じ出力先へ再実行すると、Adam/RNG/並び順/位置/入力・ソース・環境を照合して再開する。完了前のモデルはexportしない。

別runの再開は新しい手動runで `resume_receipts` に以下の形の配列を渡す。実際に観測した値を記入し、`latest`・同名artifactの自動探索・古いrunの上書きは使わない。

```json
[{"repository":"nkkmd/bao-nakakamado","runId":123,"attempt":1,"headSha":"40桁の観測済みSHA","artifactId":456,"name":"learning-logic-2026100401","digest":"sha256:64桁の観測済みZIP-hash"}]
```

例の123/456と文字列は説明用で、利用できるreceiptではない。固定seedのMLP/logicだけを復元する。異なる入力・ソース・CPU/BLAS/依存版での再開は拒否する。各model artifactにcheckpoint・完成モデル・実行記録を保存し、別runでZIP digestとcheckpoint bindingを確認する。線形は決定的に再計算する。

9候補を揃えたvalidation CLIは `node tools/ai-integration/formal-learning-validation.cjs VALIDATION_JSON MODEL_ARTIFACT_ROOT NEW_REPORT_JSON`。root直下へ `learning-linear-2026100401` など9個のartifactディレクトリを置く。全seedの基準通過、group MSE中央値、固定deployment seedで選ぶ。HOLDでも報告を保存し、finalは開封しない。収集データの期限は2026年11月4日09:05:21 JST。本学習後も探索接続・同時間対局・実機確認は別工程である。

## 検証結果の適用範囲

一致検証は、対象局面での実装整合を確認するもの。棋力、先後均衡、全局面での停止、AI-GEN4と同じ強さ、性能改善の証明ではない。ソース変更後は保存済み結果を新しいコードの証拠として使わず、新しい結果と識別を保存する。

## 最終評価の開封前準備

[条件と一度だけの運用](../../doc/AI_FORMAL_FINAL_PREPARATION_20261005.md)、[固定契約](formal-final-spec.json)、[実装](formal-final.cjs)を参照。凍結した線形seed 2026100401だけを対象に、既存の18判定と最終splitの最低件数を引き継ぐ。この開封前準備時点では正式finalは未開封で、開封worker・正式復号callback・承認記録は未導入だった。後続の手動workerと正式実行記録を以下に区別する。

```sh
node tools/ai-integration/formal-final.cjs preflight
node --test tools/ai-integration/formal-final.test.cjs
node tools/ai-integration/verify-formal-final.cjs NEW_DEVELOPMENT_OUTPUT_DIRECTORY
```

CLIはpreflightのみ。テストは偽API、推論smokeは既知の除外経路32局面だけを使う。GitHubに受付タグを作らず、収集鍵や正式ZIPを使用しない。受付ライブラリは固定refの新規作成後だけ復号へ進む順序を検証した。応答消失や受付後の中断はHOLDとし、新しいrunで再開封しない。旧の `formal-collection.cjs open` を正式な新工程へ直接使わない。

## 正式finalの手動workerと結果保存

[実装・開発検証](../../doc/AI_FORMAL_FINAL_WORKER_20261005.md)を参照。手動 [formal-final.yml](../../.github/workflows/formal-final.yml) はmain・attempt 1・固定commitとrunner fingerprintだけを受け付ける。元の凍結条件と1候補を維持し、永続受付の確認後だけ復号する。公開JSON3ファイルを専用結果ブランチへ保存し、平文final・一時入力・鍵はartifactへ出さない。

```sh
node tools/ai-integration/formal-final-runner.cjs preflight
node --test tools/ai-integration/formal-final.test.cjs tools/ai-integration/formal-final-runner.test.cjs
python3 tools/ai-integration/formal-final-unzip.test.py
node tools/ai-integration/verify-formal-final-worker.cjs NEW_DEVELOPMENT_OUTPUT_DIRECTORY
```

開発検証は除外済みの32局面・使い捨て鍵・偽APIだけを使う。正式評価はCI通過・main統合後に固定commitから手動で一度起動する。数値HOLDでも結果を保存し、受付後の中断では再開封しない。保存障害からは、originとdigestを確認した公開JSONの `publish` だけで回復する。

PR #21は新規CIと既存全8ジョブを通過しmainへ統合した。[CI記録](../../doc/AI_FORMAL_FINAL_WORKER_CI_20261005.json)には初回の自動承認審査による停止も原記録として保存する。具体的な明示承認後、main `d61c13e92fc751bf60282949c1290dcb469edcec` と固定runner fingerprintからrun 37266659230（attempt 1）を一度だけ起動した。[正式実行記録](../../doc/AI_FORMAL_FINAL_RUN_20261005.md)のとおり、1,656行・782グループで固定18条件をすべて通過し、整数不一致0件・反対称性も全件通過した。受付タグと元公開JSON・artifactの一致を確認し、結果を永続保存した。正式finalは開封済みで、再起動・再選定・このfinalでの条件調整は行わない。探索接続・同時間対局・実機検証・公開AI採用は後続工程。

## 凍結線形モデルの探索接続

[接続・検証記録](../../doc/AI_MODEL_SEARCH_CONNECTION_20261005.md)、[固定仕様](model-search-spec.json)、[接続口](frozen-model-search.cjs)を参照。正式最終評価を通過した線形seed 2026100401だけを接続し、元の教師探索・モデルbytes・収集／学習のfingerprintを変更しない。新しい `prototype/model-search-ai.js` は原探索と同じ本体に評価器接続口と整数検査を持つ別入口である。終局±1000000と距離、安全停止の中立値をモデルの通常局面出力±1024より優先する。

除外済み89root・深度1/2/3・静止探索0/1・3設定の1602構成で通常遷移全探索と値・最善手集合が一致し、両視点のPython／Node整数評価178件も不一致0。12テストは深度4、pendingを持つ通常終局、既知安全停止、南北交換、時計中断・例外伝播・cache上限も検査する。[読取り専用CI](../../.github/workflows/model-search-check.yml)が同じ確認を実行する。

```sh
node --test tools/ai-integration/model-search.test.cjs
node tools/ai-integration/verify-model-search.cjs NEW_DEVELOPMENT_OUTPUT_DIRECTORY
```

正式データの行・暗号文・鍵を取得しない。公開画面はこの評価器を読み込まない。次は開発経路で同時間対局の実行可能性を確認し、独立した正式比較の条件を固定する。棋力とmoto g52j 5G実機の検証、Workerと画面の採用は後続工程。

## 同時間対局の運用試走と条件固定

[設計・実測記録](../../doc/AI_EQUAL_TIME_PILOT_20261005.md)、[試走仕様](equal-time-spec.json)、[対局・監査](equal-time-match.cjs)、[独立開幕生成](equal-time-openings.cjs)を参照。同じ探索coreで両評価器の担当を交換したペアを使い、25/75/150msで運用だけを確認する。通常終局・反復・手数上限・安全停止・技術的失敗を区別し、各手を通常遷移で再生する。勝敗を予算選択に使用しない。

```sh
node --test tools/ai-integration/equal-time-match.test.cjs
node tools/ai-integration/equal-time-match.cjs pilot 150 /absolute/pilot-150
```

同じ試走ディレクトリの完成局は条件・ソース・実行環境・checksum照合後に再利用する。`freeze` は3予算の完成局をsearchなしで再監査し、運用条件を満たす最大の予算と256ペア・512局の独立開幕manifestを固定する。不完全な試走や既存出力先は拒否する。過去の開幕はgenerator-onlyで照合し、教師ラベル・収集鍵・正式finalの行を読み込まない。正式比較の受付・shard実行・artifact復元worker、実機、公開AI採用は後続工程。

初回のActions試走24局は通常終局し、事前の運用条件で150msを採用した。4policyの正式開幕v1は独立開幕不足でHOLDとなり、元の `freeze` はそのHOLDを維持する。別の [v2仕様](equal-time-formal-v2-spec.json)・[生成](equal-time-formal-v2.cjs)で、同じseed範囲・旧開幕の除外・判定閾値を保ったrandom/noisyの256ペア・512局を固定した。[正式contractと開幕](../../doc/equal-time-formal-v2/contract.json)と [原ZIP](../../doc/equal-time-pilot/)を保存する。v2の正式実行workerは次工程である。

```sh
node --test tools/ai-integration/equal-time-match.test.cjs tools/ai-integration/equal-time-formal-v2.test.cjs
node tools/ai-integration/verify-equal-time-formal-v2.cjs doc/equal-time-formal-v2
```

検証器は原ZIPのdigest・全24棋譜・contractの全fieldを照合し、旧16384単位の開幕と新しい256開幕を再生成する。正式対局とモデル選択を行わない。
