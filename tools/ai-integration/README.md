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

## 結果の境界

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

## 検証結果の適用範囲

一致検証は、対象局面での実装整合を確認するもの。棋力、先後均衡、全局面での停止、AI-GEN4と同じ強さ、性能改善の証明ではない。ソース変更後は保存済み結果を新しいコードの証拠として使わず、新しい結果と識別を保存する。
