# 探索コンピューターの試験用ブラウザー接続

2026年10月5日（日本時間）。ルールv0.8.0・棋譜7を維持する。Bao Nakakamado・NYAKUAの考案者nkkmd、初公開日2026年9月30日。説明文はCC BY-SA 4.0、コード・モデル・JSONはMIT。

## 接続の範囲

[正式同時間比較512局](AI_EQUAL_TIME_FORMAL_RUN_20261005.md)で固定基準を通過した線形seed 2026100401を、「探索コンピューター（試験）」から選べるようにする。簡易コンピューターと2人対戦も残す。識別名は `NAKAKAMADO-BROWSER-TRIAL-v1`、公開採用状態はfalse。AI-GEN4のrelease IDを流用しない。

| 試験用の設定 | 各手の探索予算 | 最大深度 |
| --- | ---: | ---: |
| やさしい | 25ms | 32 |
| ふつう | 75ms | 32 |
| 強い | 150ms | 32 |

同時間試走の3予算を用いる暫定設定で、端末ごとの速度や難易度間の勝率を確定したものではない。150msは正式比較と同じ探索設定。expert相当の別設定は実機の測定後に判断する。時計はWorkerのperformance.nowを使い、起動・モデル検査・応答転送・演出時間を探索予算へ含めない。

## モデルと通常遷移

`build-browser-model.cjs` は凍結モデルの原bytesと `learning-input.cjs` を検証して、ブラウザー用 `browser-model.js` を決定的に生成する。学習器やNode依存、正式finalの平文は配信物へ含めない。入力検証・368bit配置は元エンコーダーの関数本体を使い、固定線形モデルの整数式・クリップ・両視点差を保持する。Worker起動時に埋め込んだ原JSON bytesをWeb CryptoのSHA-256で照合する。モデルSHA-256は `f74175fbaa6f2d6a82148cf5e106da7291f396b2b38cb79866dc641b2147254d`。

元の `search-ai.js`、`learning-input.cjs`、凍結モデル、教師・学習・finalの条件と原成果は変更しない。`model-search-ai.js` の探索処理も変更しない。盤面確定・演出・棋譜は従来の `applyWithEvents` を使い、Workerの遷移を画面の確定結果として流用しない。

## 要求、取消し、失敗時

`computer-client.js` は要求ごとに専用Workerを作る。要求ID・規則と版を含む全局面key・protocol・予算を送る。応答のID/key/protocol、モデルSHA、評価器ID・完了深度・計測値を検査し、返却手を要求時の合法variantへ照合する。画面でも対局世代・現在の局面key・現在手番・通常遷移の合法手を再確認してから一手だけ適用する。

新しい対局／開始操作では予約タイマーを解除し、Workerをterminateして未解決要求を取消す。取消し後の応答は無視する。Worker失敗・Web Crypto未対応・不正応答・5秒watchdogでは、本ゲームの合法variantの先頭を代替手にする。代替手であることをバッジと棋譜のdiagnosticに明記する。探索の時間切れで深度0だった場合も `searchFallback` を区別する。Worker初期化中・思考中・演出中は盤面の `aria-busy` をtrueにする。

HTTP localhostまたはHTTPSで試験する。file URL、非secure context、Worker/CSP制限は代替手になる可能性がある。モバイル背景タブではブラウザーのタイマー制限があるため、watchdogを厳密な実時間上限とは扱わない。

## 棋譜互換

version 7・rulesVersion 0.8.0・history/finalの形式を保持する。探索試験のmodeは既存の `computer` として保存し、追加の `computer` オブジェクトに識別名・モデルSHA・難易度・各手の診断を付ける。診断には要求ID/key、探索予算・完了深度・応答時間、代替理由を残す。簡易版・2人対戦の棋譜に新フィールドを追加しない。既存の通常replayはhistoryから盤面を再構築できる。

## 検証と残る工程

ローカルで取消し／旧応答／不正手／モデル不一致／Worker失敗／watchdog／Worker未対応／終局の4テストと、全89開発用root・両視点178件の入力・整数評価・深度1探索の完全一致を確認した。画面上での思考中取消し・旧応答破棄・次対局の診断付き棋譜もDOMテストで確認し、既存画面・規則・探索・遷移と合わせて35テストが成功した。正式finalの平文参照0件、新規棋力測定0件。

実ブラウザーは [browser-worker-check.cjs](../tools/ai-integration/browser-worker-check.cjs) で、89局面の整数評価、NAMUA/MTAJI/確保分のみ/3個投入の実Worker計12要求、主スレッドの応答、思考中取消し、先後2対局の棋譜再構築、Worker未対応時の継続、320/390/432pxの設定画面を確認する。既存 [画面回帰](../tools/four-row-browser-check.cjs) も継続する。この環境ではブラウザー本体の取得に失敗したため、実ブラウザー結果はGitHub Actionsで確認する。現時点では未確認。

次にCI原成果・画面を確認してPRを統合する。その後、moto g52j 5G / Android 12 / Chromeで連続対局・思考中リセット・スクロール／サウンド操作・体感待ち時間と棋譜diagnosticを確認する。ブラウザーの幅検査を実機検査と読み替えない。実機確認・公開採用・配信用ZIP・サイト公開は未実施。
