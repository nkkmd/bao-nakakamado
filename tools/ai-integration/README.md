# AI導入の基盤検証

[導入計画](../../doc/AI_INTEGRATION_PLAN_20261004.md)と[検証記録](../../doc/AI_SEARCH_TRANSITION_VERIFICATION_20261004.md)の再現用ツール。現行v0.8.0の通常遷移と、ニャクア込みの盤面専用の探索遷移を照合する。棋力試験・学習は行わない。

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

入力は368bitで、元ゲームの399bitモデルとは互換ではない。パイロットのtrain/validation/finalは処理確認用で、閲覧済みのfinalを正式な最終確認へ使わない。正式データ収集・学習・matrix再開workflow・棋力試験は未実施。

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

PRまたは手動Actionsの4workerは、それぞれ16件を測定後、同じディレクトリで再開を確認する。pushだけのCIでは重複測定を省く。各 `shard-0`〜`shard-3` artifactと集約結果を30日保存し、失敗時も完了単位を保存する。別runから再開する場合は、対象run/attemptとAPIのartifact digestを固定・確認してZIPを展開し、上記rootの直下に `shard-0`〜`shard-3` を復元する。同じソースと設定で各shardを実行し、集約する。別runの自動復元workflowは未実装。

通常ハンド0・確保分1の標準初期配置からの到達4件は [reserved-only-reachable-fixtures.json](reserved-only-reachable-fixtures.json)。通常処理の全棋譜再生と全合法variantの1個投入を検査する。終局・不正手・総KETE違いを教師へ混ぜない。

正式収集の現在の固定条件は [formal-collection-spec.json](formal-collection-spec.json)。この試走CLIは正式データの生成器ではない。正式の除外一覧・generator・全体監査・artifact復元・最終検証封印は次工程で、収集・学習は未開始である。前工程の `learning-spec.json` と結果は原記録として保持する。

## 検証結果の適用範囲

一致検証は、対象局面での実装整合を確認するもの。棋力、先後均衡、全局面での停止、AI-GEN4と同じ強さ、性能改善の証明ではない。ソース変更後は保存済み結果を新しいコードの証拠として使わず、新しい結果と識別を保存する。
