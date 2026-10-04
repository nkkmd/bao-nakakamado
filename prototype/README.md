# Bao Nakakamado：遊べる試作v0.8.0

4列32穴・初期ハンド22個のBaoを基準に、NYAKUA（ニャクア）と次の自分の手番での3個投入を採用しました。[ルールブック](../doc/RULEBOOK.md)、[比較調査](../doc/NYAKUA_THREE_STUDY_20261002.md)、[実装・検証記録](../doc/NYAKUA_THREE_ADOPTION_20261002.md)を参照してください。

Bao Nakakamado・NYAKUAの考案者は **nkkmd**、初公開日は **2026年9月30日**です。[考案・公開・変更履歴](../doc/ORIGIN_AND_HISTORY.md)を参照してください。

## 起動

`prototype/` を静的HTTPサーバーで配信します。

```sh
cd prototype
python3 -m http.server 8000
```

2人対戦、簡易コンピューター対戦、着手の再生、サウンド、高速表示、棋譜JSON保存に対応します。コンピューターは簡易評価による相手で、元ゲームの公開AI-GEN4ではありません。

## ライセンス・配信

コード・画面の構造・CSSは[MIT](LICENSE)、このREADMEや画面の指定した説明文は[CC BY-SA 4.0](LICENSE-CC-BY-SA-4.0.txt)です。元資料のクレジットと具体的な適用範囲は[ライセンスと出典](../LICENSES.md)、配信先で読める案内は[licenses.html](licenses.html)を参照してください。

`prototype/` だけを配信する場合も、`licenses.html`・`LICENSE`・`LICENSE-CC-BY-SA-4.0.txt`・`ENGINE_LICENSE.txt` を残します。フラットな配信用ZIPには次の9ファイルを直下へ入れます。

```text
index.html
style.css
next-turn-engine.js
steal.js
app.js
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

読み込み順は `next-turn-engine.js` → `steal.js` → `app.js`。`engine.js`・`bulk-engine.js`・`bounce-engine.js`・`four-row-engine.js` は過去条件の再現用です。`steal.js` はエンジンの定数で奪取先を切り替え、過去条件では従来のハンド移動を維持します。

画面では通常ハンドと「確保」を別表示。棋譜JSONはversion 7、`rulesVersion: "0.8.0"`、`nyakuaFixedPitBulk: false`、`nyakuaNextTurnThree: true`、`nyakuaReservedProtected: true`。盤の `reserve` は通常ハンド、`nyakuaReserve` は確保分、`pending` は終局時の捕獲保留です。各手に `placed`・`ordinaryPlaced`・`reservedPlaced`・`captures`・`stolen` を記録し、再構築時は両種の投入数も検査します。画面での棋譜読み込みは未実装です。

## 確認

AI導入の準備として、`steal.js` の通常処理とNYAKUA会計を共通化した、盤面専用の軽量遷移を `search-transition.js` から提供しています。配信画面はまだこの探索アダプターを読み込みません。[導入計画](../doc/AI_INTEGRATION_PLAN_20261004.md)と[照合ツール](../tools/ai-integration/README.md)を参照してください。

リポジトリ直下で実行します。

```sh
node --test prototype/next-turn.test.cjs prototype/four-row.test.cjs prototype/app.test.cjs prototype/bounce.test.cjs prototype/steal.test.js tools/fixed-pit-bulk-study.test.cjs tools/fixed-pit-triggered-study.test.cjs
node tools/next-turn-live-check.cjs 100 /tmp/next-turn-live-results.json
node --test prototype/search-transition.test.cjs
node tools/ai-integration/verify-transitions.cjs 32 /tmp/transition-verification.json
```

実画面は `tools/four-row-browser-check.cjs` でデスクトップ・スマホ幅320/390/432px、通常ハンド・確保分、全対局の盤面、棋譜保存、コンピューター、リセットを確認します。GitHub Actionsの `Playable prototype checks` がブラウザー依存を準備して実行します。

## 既知の制約

先後均衡と長い必勝ルートは未判定です。takasia未実装、MTAJIの一部局面での一着手内の種まき循環を含む元エンジンの制約を引き継ぎます。連続種まき512回の安全上限で対局を停止し、画面と棋譜の `adjudication: "safety-stop"` で正規終局と区別します。再現用の内部 `winner` は通常の勝者と解釈しないでください。正式な循環停止規定は別途検討が必要です。
