# 凍結線形モデルの探索接続と開発用局面での一致検証

2026年10月5日（日本時間）。Bao Nakakamado v0.8.0・棋譜version 7。考案者nkkmd、初公開日2026年9月30日を維持する。出発点はmain `fd1ee21896bf0ac4ed8d0b01b00a5ea5f501e32c`。

[正式最終評価](AI_FORMAL_FINAL_RUN_20261005.md)の全18条件を通過した、凍結線形seed 2026100401を開発用探索へ接続した。除外済み89局面・1602構成の探索値と最善手集合が、通常ゲーム遷移による全探索と一致した。棋力・同時間対局・実機性能・公開AI採用の判定はこの工程に含めない。

## 固定契約と探索入口

[固定仕様](../tools/ai-integration/model-search-spec.json)と [接続口](../tools/ai-integration/frozen-model-search.cjs) を追加した。既存の `search-ai.js`、評価器、入力、学習仕様、凍結モデル、正式収集と最終評価の原記録は変更しない。接続時に旧preflight・モデルの全bytes・正式最終評価の公開報告と承認／受付のbindingを照合し、固定候補の合格が確認できる場合だけ初期化する。キー・暗号文・正式splitの行は読み込まない。

教師探索の原本は収集・学習ソースSHAに含まれるため、原本へ接続口を追加すると凍結契約が変わってしまう。[別の探索core](../prototype/model-search-ai.js)を原本から派生させ、評価器注入・別識別名・整数範囲の検査だけを追加した。通常の探索手順は原本と同じで、テストでは探索本体の一致を確認し、手作り評価器を注入した場合の結果・統計も元の教師探索と一致した。元のMIT表示と固定版の出典を維持する。

- 探索識別名：`NAKAKAMADO-MODEL-SEARCH-v1`。
- 評価器識別名：`NAKAKAMADO-FROZEN-LINEAR-2026100401-v1`。
- モデルSHA-256：`f74175fbaa6f2d6a82148cf5e106da7291f396b2b38cb79866dc641b2147254d`。
- 旧worker fingerprint：`8f22d999872964b2e4ed692202ca78f2b0aaa2b447f26f5b15831c38a15bf746`（不変）。
- 新しい接続fingerprint：`e1b0b96d6eee8a7c3ff0e6c577cc8cf949697b2adf544ab4491e575f2cfc1078`。

反復深化、alpha-beta、PVS、置換表、評価キャッシュ、捕獲義務に従う静止探索、aspiration再探索、手順序、時間制限を引き継ぐ。表とキャッシュは呼出しごとに初期化し、上限を維持する。各評価・遷移の前後で協調的に時計を確認し、時間切れでは最後に完了した深度の結果を返す。深度未完了の合法fallbackは `rootScore: null` のままで、完了結果と混ぜない。評価器やエンジンの例外は時間切れとして隠さない。

モデル初期化は探索呼出し前に一度行う。探索の計時には `analyzeMove` 内の準備と評価を含めるが、モデル読込みと契約照合の初期化時間は含めない。将来のWorker接続・実機試験では初期化も別途計測する。現段階で、強制停止できるWorkerや厳密な壁時計上限を導入したとは扱わない。

## 整数値・通常終局・安全停止

通常局面は368bitの既存入力と、学習時の整数インタープリターをそのまま使う。1024倍の出力を再スケールせず、切捨て・clipping・反対側評価の差を維持する。非終局の評価範囲は－1024〜1024で、PVSの整数幅1とも整合する。

通常終局では入力エンコーダーへ渡さず、探索内の勝敗値±1000000とplyによる距離を優先する。終局の `pending` が残っていても、通常局面専用の入力検査へ渡さない。`relay-limit` は勝敗として解釈せず0と未解決状態を維持する。反対称性と南北交換も確認した。

## 検証の対象と結果

[局面生成](../tools/ai-integration/model-search-corpus.cjs)は、収集前から全経路と1手隣接局面が除外されている `random/700000`・`greedy/700001` と、既存の確保分のみの到達棋譜4件を使う。rootごとに元の除外registryへの所属を確認し、通常の `steal.js` で再生して状態が一致することを確認した。候補の教師ラベル・正式train/validation/finalの行は読み込まない。探索の先の全局面が除外registryに載っているという主張ではなく、検証rootと経路の事前除外を確認したものである。

| 層 | 開発root件数 |
|---|---:|
| NAMUA / MTAJI | 62 / 27 |
| NORTH / SOUTHの手番 | 45 / 44 |
| 自分 / 相手の確保分あり | 19 / 15 |
| 3個 / 2個投入 | 14 / 1 |
| 確保分のみ | 4 |
| 通常ハンド最後の1個 | 2 |
| MTAJIへの移行近傍 | 7 |

層は重複する。少数層の件数を棋力評価に用いない。

[独立全探索](../tools/ai-integration/model-search-oracle.cjs)は候補coreを呼ばず、通常遷移で枝刈り・PVS・表・手順序・反復深化を使わずにminimaxを計算する。同じ固定モデルで深度1/2/3×静止探索0/1×3設定を照合した。設定は既定、表・キャッシュ・PVSなし、小さい表とcache＋手順序＋history＋aspiration幅1。89局面×18構成＝1602件で値不一致0・最善手集合外0・違法手0・入力変更0。置換表hit 1642、評価cache hit 6749、PVS再探索1591、aspiration再探索472を確認した。

PythonとNodeの整数評価は89局面×両者視点＝178件で不一致0。反対側評価の反対称性は89件通過。通常状態は変更されていない。[12テスト](../tools/ai-integration/model-search.test.cjs)では、追加の深度4照合、通常終局の距離とpending、既知の連続種まき安全停止、南北交換、fake時計による中断、モデル例外とエンジン例外、cache上限・呼出し間の独立、ブラウザーscript形式のcore exportを確認した。89rootの1602構成には安全停止が含まれなかったため、安全停止の根拠は別の既知の再現テストである。

実時計の24試走（8局面×0/5/20ms）は合法手返却の診断で、厳密な所要時間合格や棋力試験ではない。ローカル環境はNode v24.19.0、Python 3.12.14、NumPy 2.3.5。coreのブラウザーexportはNodeのVMで確認したもので、スマートフォン実機試験や公開画面への組込みとは区別する。

[ローカル原報告](AI_MODEL_SEARCH_CONNECTION_LOCAL_20261005.json)を保存する。[新規の読取り専用CI](../.github/workflows/model-search-check.yml)で12テスト・同じ178件のPython照合・1602構成を検査し、公開JSONの報告をartifactへ保存する。収集鍵・正式ZIP・Gitへの開封受付や結果書込みは使用しない。既存のprototype回帰・ブラウザー検証と旧準備CIも併せて確認する。

```js
const F = require('./tools/ai-integration/frozen-model-search.cjs');
const E = require('./prototype/next-turn-engine.js');
const ai = F.createAI();
const result = ai.analyzeMove(E.initialState(), {maxDepth: 4, timeLimitMs: 500});
// result.moveはこのゲームの手。未完了fallbackならrootScoreはnull。
```

```sh
node --test tools/ai-integration/model-search.test.cjs
node tools/ai-integration/verify-model-search.cjs NEW_DEVELOPMENT_OUTPUT_DIRECTORY
```

## 次の工程

同時間対局の基準を固定するため、手作り評価探索と固定線形評価探索の実時計の短い比較を開発用経路で行い、時間予算・到達深度・停止理由・記録量を把握する。正式比較の対象集団、先後交換ペア、局数、主要指標、採用・保留条件、独立seedは、その実行可能性の確認後に結果を見る前に固定する。長時間対局はGitHub Actionsを第一候補にし、完了ペア・run/attempt/head・実装とモデルSHA・固定条件を保存して再開できるようにする。

その後、独立した正式対局、Workerの要求ID・局面識別・取消し・古い返答の破棄と合法手再検査、デスクトップ・スマホ幅、moto g52j 5Gの連続対局と操作応答を順に確認する。画面の簡易コンピューターは現在のままで、今回の接続を公開採用とは扱わない。正式finalを再開封したり、今回の結果で同じモデル・seed・閾値を調整したりしない。

説明文はCC BY-SA 4.0。コード・設定・保護対象の機械可読記録はMIT。[出典と利用条件](../LICENSES.md)を維持する。
