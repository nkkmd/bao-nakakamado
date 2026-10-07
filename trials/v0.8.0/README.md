# Bao Nakakamado：遊べる試作v0.8.0

4列32穴・初期ハンド22個のBaoを基準に、NYAKUA（ニャクア）と次の自分の手番での3個投入を採用しました。[ルールブック](../doc/RULEBOOK.md)、[比較調査](../doc/NYAKUA_THREE_STUDY_20261002.md)、[実装・検証記録](../doc/NYAKUA_THREE_ADOPTION_20261002.md)を参照してください。

Bao Nakakamado・NYAKUAの考案者は **nkkmd**、初公開日は **2026年9月30日**です。[考案・公開・変更履歴](../doc/ORIGIN_AND_HISTORY.md)を参照してください。

## 起動

`prototype/` を静的HTTPサーバーで配信します。

```sh
cd prototype
python3 -m http.server 8000
```

2人対戦、簡易コンピューター、探索コンピューター、着手の再生、サウンド、高速表示、棋譜JSON保存に対応します。探索コンピューターは本ゲーム専用の凍結線形モデルをWorkerで使い、easy/normal/hardの25/75/150msを選べます。2026年10月6日に実機試験の報告を受け、[公開AIとして採用](../doc/AI_PUBLIC_ADOPTION_20261006.md)しました。端末ごとの実測速度や難易度間の勝率は未確定です。

## ライセンス・配信

コード・画面の構造・CSSは[MIT](LICENSE)、このREADMEや画面の指定した説明文は[CC BY-SA 4.0](LICENSE-CC-BY-SA-4.0.txt)です。元資料のクレジットと具体的な適用範囲は[ライセンスと出典](../LICENSES.md)、配信先で読める案内は[licenses.html](licenses.html)を参照してください。

`prototype/` だけを配信する場合も、`licenses.html`・`LICENSE`・`LICENSE-CC-BY-SA-4.0.txt`・`ENGINE_LICENSE.txt` を残します。探索コンピューターを含むフラットなZIPには次の14ファイルを直下へ入れ、HTTP localhostまたはHTTPSで開きます。サイトの実際の配信日・URLは未確認です。

```text
index.html
style.css
next-turn-engine.js
steal.js
app.js
search-transition.js
model-search-ai.js
browser-model.js
computer-client.js
computer-worker.js
licenses.html
LICENSE
LICENSE-CC-BY-SA-4.0.txt
ENGINE_LICENSE.txt
```

ルートと配信先の同名ライセンス条文は同一に保ちます。実際に版を配信した際は公開日・版・配信URLを変更履歴へ追記してください。考案者・日付・出典の維持手順は[管理ルール](../AGENTS.md)に定めます。

## 試作ルール

- 各人の前列8穴・後列8穴、両者4列32穴。初期前列は `0,0,0,0,6,2,2,0`、後列は空。通常ハンド22個ずつ、確保分0、合計64個。
- NAMUAの一着手で捕獲2回以上、相手の通常ハンド2個以上なら1個だけ奪い、通常ハンドと別に確保します。相手の最後の1個と確保分は奪えません。
- 次の自分の手番で通常ハンド2個＋確保分1個を同じ合法な開始穴へ一度に投入。通常ハンドが1個なら計2個、0個なら確保分1個のみ。確保分は必ず使い、その手でもNYAKUAが発動します。
- 確保分がなければ通常1個投入。捕獲義務・捕獲入口・連続種まき・NYUMBAの2個蒔きを維持します。
- 両者の通常ハンドと確保分がすべて0で共通MTAJIへ移行。通常の初期局面ではハンド枯渇によるパスは生じません。人工局面用の互換パス処理は残します。
- 相手前列から毎回全捕獲。相手前列全空、または相手の合法手なしで勝ち。後列に残数があっても前列全空なら負けです。

## 実装と棋譜

読み込み順は `next-turn-engine.js` → `steal.js` → `search-transition.js` → `computer-client.js` → `app.js`。`engine.js`・`bulk-engine.js`・`bounce-engine.js`・`four-row-engine.js` は過去条件の再現用です。`steal.js` はエンジンの定数で奪取先を切り替え、過去条件では従来のハンド移動を維持します。

画面では通常ハンドと「確保」を別表示。棋譜JSONはversion 7、`rulesVersion: "0.8.0"`、`nyakuaFixedPitBulk: false`、`nyakuaNextTurnThree: true`、`nyakuaReservedProtected: true`。盤の `reserve` は通常ハンド、`nyakuaReserve` は確保分、`pending` は終局時の捕獲保留です。各手に `placed`・`ordinaryPlaced`・`reservedPlaced`・`captures`・`stolen` を記録し、再構築時は両種の投入数も検査します。探索コンピューターの棋譜には `computer.id: "NAKAKAMADO-AI-v1"`、`releaseId: "NAKAKAMADO-AI-RELEASE-001"`、`publicAdopted: true`、モデルSHAと各手の診断を追加します。旧試験棋譜の識別情報は原記録として保持します。画面での棋譜読み込みは未実装です。

## 確認

[第3段階の設計とパイロット](../doc/AI_LEARNING_DESIGN_20261004.md)では、学習用の専用入力と教師データの分割・再開を `tools/ai-integration/` に整備しました。このパイロットでは本学習・新AIの画面組込みは行っていません。

[教師探索の実時計試走](../doc/AI_TEACHER_FEASIBILITY_20261004.md)で、確保分のみの到達棋譜と64局面の深度4完了を確認しました。[正式収集基盤](../doc/AI_FORMAL_COLLECTION_INFRASTRUCTURE_20261004.md)の生成・全体監査・暗号化保存・固定artifact復元・最終検証の封印を整備しました。81テストと全7 CIジョブが成功しました。v1の正式候補不足を受けた[選択計画v2](../doc/AI_FORMAL_SELECTION_V2_20261005.md)は、同じ候補・split割当・最低件数で事前条件を通過し、89テストと全8 CIジョブも成功しました。正式収集v2の8192件を完了し、採用後の監査と封印も通過しました。正式収集完了時点では公開AIの差し替えは未実施でした。

PR #17をmainへ統合し、正式収集workflowを登録しました。修正後のCIは89テスト・全8ジョブ成功。収集鍵を新規設定し、正式収集v2のrun 37245789837は全18ジョブ成功しました。8192件を受理し、train 5019行・validation 1517行の全条件を通過。最終検証データを暗号化したまま封印し、学習準備へ進みました。[正式収集の実行記録](../doc/AI_FORMAL_COLLECTION_RUN_V2_20261005.md)を参照してください。

[正式学習の仕様・実装検証](../doc/AI_FORMAL_LEARNING_DESIGN_20261005.md)を追加しました。学習用ツールと整数評価器は開発用で、この画面は読み込みません。仕様・実装検証時点では最終開封・公開AIの差し替えは未実施でした。後続の正式実行は以下を参照してください。

[正式学習の実行記録](../doc/AI_FORMAL_LEARNING_RUN_20261005.md)で、初回のゼロ符号検証の停止・修正と、修正後の全11ジョブ成功を保存しました。全9候補が固定validation基準を通過し、事前の中央値順位で線形seed 2026100401を凍結しました。本学習完了時点の最終評価は未開封でした。その後、明示承認を得て[正式最終評価](../doc/AI_FORMAL_FINAL_RUN_20261005.md)を一度だけ実行し、固定18条件をすべて通過しました。後続の棋力・実機確認と公開採用は[採用記録](../doc/AI_PUBLIC_ADOPTION_20261006.md)を参照してください。

AI導入の準備として、`steal.js` の通常処理とNYAKUA会計を共通化した、盤面専用の軽量遷移を `search-transition.js` から提供しています。探索コンピューターの画面接続ではこのアダプターを読み込み、応答を現在局面の合法手へ照合します。[導入計画](../doc/AI_INTEGRATION_PLAN_20261004.md)と[照合ツール](../tools/ai-integration/README.md)を参照してください。第2段階では `search-evaluator.js` と `search-ai.js` に手作り評価関数付きの探索版を追加しました。[実装と検証](../doc/AI_SEARCH_IMPLEMENTATION_20261004.md)を参照してください。後続の試験用画面接続は下記を参照してください。

[凍結モデルの探索接続](../doc/AI_MODEL_SEARCH_CONNECTION_20261005.md)では、元の教師探索・学習条件を保存したまま、開発用の別入口 `model-search-ai.js` と固定線形評価器を接続しました。除外済み89局面・1,602構成が通常遷移を使う全探索と一致しました。この探索接続時点ではゲーム画面はモデルを読み込んでいませんでした。後続の試験用画面接続は下記を参照してください。

[正式同時間比較v2](../doc/AI_EQUAL_TIME_FORMAL_RUN_20261005.md)は全512局を完了し、凍結線形モデルが311勝・201敗、固定棋力基準を通過しました。全局通常終局・技術的失敗0件。Actionsの部分集約HOLDと、複数runの原成果による全件監査の成功を区別して保存しています。その後、[試験用Web Worker接続](../doc/AI_BROWSER_WORKER_20261005.md)を追加しました。実ブラウザーのWorker・取消し・先後2対局と棋譜再生を確認し、全5ワークフロー・全16ジョブが成功しました。その後、実機試験の報告を受けて[公開採用](../doc/AI_PUBLIC_ADOPTION_20261006.md)を行いました。

リポジトリ直下で実行します。

```sh
node --test prototype/next-turn.test.cjs prototype/four-row.test.cjs prototype/app.test.cjs prototype/bounce.test.cjs prototype/steal.test.js tools/fixed-pit-bulk-study.test.cjs tools/fixed-pit-triggered-study.test.cjs
node tools/next-turn-live-check.cjs 100 /tmp/next-turn-live-results.json
node tools/ai-integration/build-browser-model.cjs --check
node --test prototype/computer-client.test.cjs prototype/search-ai.test.cjs prototype/search-transition.test.cjs
node tools/ai-integration/verify-transitions.cjs 32 /tmp/transition-verification.json
node tools/ai-integration/verify-search.cjs /tmp/search-verification.json
```

実画面は `tools/four-row-browser-check.cjs` でデスクトップ・スマホ幅320/390/432px、通常ハンド・確保分、全対局の盤面、棋譜保存、コンピューター、リセットを確認します。GitHub Actionsの `Playable prototype checks` がブラウザー依存を準備して実行します。

## 既知の制約

先後均衡と長い必勝ルートは未判定です。takasia未実装、MTAJIの一部局面での一着手内の種まき循環を含む元エンジンの制約を引き継ぎます。連続種まき512回の安全上限で対局を停止し、画面と棋譜の `adjudication: "safety-stop"` で正規終局と区別します。再現用の内部 `winner` は通常の勝者と解釈しないでください。正式な循環停止規定は別途検討が必要です。
