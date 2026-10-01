# Bao Nakakamado：遊べる試作v0.7.0

各人の前列・後列16穴、ハンド22個のBao la Kiswahiliの実装を基準に、NYAKUA（ニャクア）を追加しています。**最後の1個保護と一穴全投入は現行仕様として固定**しました。[ルールブック](../doc/RULEBOOK.md)と[変更・検証記録](../doc/FOUR_ROW_NYAKUA_FIXED_20261002.md)を参照してください。

## 起動

`prototype/` を静的HTTPサーバーで配信します。

```sh
cd prototype
python3 -m http.server 8000
```

2人対戦、簡易コンピューター対戦、着手の再生、サウンド、高速表示、棋譜JSON保存に対応します。コンピューターは簡易評価による相手で、元ゲームの公開AI-GEN4ではありません。

## 試作ルール

- 各人の前列8穴・後列8穴、両者4列32穴。種まきは自分の前後列を循環します。
- 初期前列は `0,0,0,0,6,2,2,0`、後列は空。ハンド22個ずつ、合計64個。
- NAMUAの一着手で捕獲2回以上、相手ハンド2個以上なら、着手後に1個だけ奪います。最後の1個は奪いません。
- 相手ハンド0なら、残り2個以上のハンドを通常の合法な開始穴へ一度に全投入。捕獲義務、連続種まき、NYUMBAの2個蒔きを維持します。
- 両者のハンド0で共通MTAJIへ移ります。通常の初期局面からパスは生じませんが、人工局面用の互換処理は残します。
- 捕獲は相手前列から毎回全捕獲。相手前列全空、または相手の合法手なしで勝ち。後列に残数があっても前列全空なら負けです。

## 実装と棋譜

読み込み順は `bulk-engine.js` → `four-row-engine.js` → `steal.js` → `app.js`。`four-row-engine.js` は現行仕様の定数を固定する接続層で、保存済み4列エンジンを使います。`engine.js`、`bulk-engine.js`、`bounce-engine.js` と歴史的な試験を変更しないため、過去の結果を元の条件で再現できます。

棋譜JSONはversion 6、`rulesVersion: "0.7.0"`、`variantRule: "namua-steal-one-protect-last-fixed-pit-bulk-two-row-ring-hand22"`。前後列・循環・ハンド22個・総数64個、最後の1個保護・一穴全投入も明記します。各手の `placed`・`captures`・`stolen` を維持します。旧1列盤の棋譜と区別し、画面での棋譜読み込みは未実装です。

## 確認

リポジトリ直下で実行します。

```sh
node --test prototype/four-row.test.cjs prototype/app.test.cjs prototype/bounce.test.cjs prototype/steal.test.js tools/fixed-pit-bulk-study.test.cjs tools/fixed-pit-triggered-study.test.cjs
node tools/four-row-nyakua-check.cjs 100 /tmp/four-row-nyakua-reproduced.json
```

[保存済み進行確認](../tools/four-row-nyakua-results.json)には400局、40組の南北交換、40局の棋譜再構築、8,873候補遷移のイベント照合を記録しました。これは先後均衡や全局面の停止の証明ではありません。takasia未実装と連続種まき安全上限など、元エンジンの制約を引き継ぎます。
