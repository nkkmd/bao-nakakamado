# Bao Nakakamado — 試作 v0.6.1（1列・折り返し）

各人8穴、端で折り返す種まき、初期ハンド12個を採用した遊べる試作です。NYAKUA（ニャクア）と一穴全投入を維持しています。[現行ルールブック](../doc/RULEBOOK.md)と[最後の1個保護の実装・確認](../doc/NYAKUA_PROTECT_LAST_20261001.md)を参照してください。

## 試作ルール

- 盤は両者合計2列16穴。初期盤上は各人 `0,0,0,0,6,2,2,0` の10個、ハンド12個。総数44個です。
- 自分の8穴だけへ種まきし、8番の次は7番、1番の次は2番へ折り返します。同じ着手では反転後の方向を連続種まきへ引き継ぎます。端の開始方向は内向きの1つだけです。
- NAMUAで一着手2回以上捕獲すると、相手のハンドが2個以上なら1個奪うNYAKUAが発動します。3回以上でも1個。相手ハンド0〜1個、MTAJIでは発動しません。
- 相手ハンド0で自分に2個以上あれば、合法な開始穴へ残り全部を一度に置き、通常の捕獲またはtakataを続けます。NYUMBAの2個蒔きも維持します。
- ハンド0側へのパス処理は保持しますが、最後の1個を保護する現行初期局面からはパスが生じません。両者ハンド0で共通MTAJIへ移行します。相手の8穴全空または相手手番で合法手なしが勝利条件です。
- MTAJIの捕獲開始個数は2〜15個。折り返しによる再訪を含め、最後の1個を置く直前の占有状態で捕獲を判定します。

試作画面は `bounce-engine.js` と `steal.js` を使います。元の `engine.js` と旧試作の `bulk-engine.js` は、過去の4列盤の試験を再現するため残しています。現行画面では読み込みません。

## 起動と配信

```sh
python3 -m http.server 8000 --directory prototype
```

`http://localhost:8000/` で2人対戦か簡易コンピューター対戦を選びます。光る穴を選び、表示された方向・入口を選択してください。

Cloudflare Pagesでは production branch `main`、build command空欄、build output directory `prototype`。手動配信では、`index.html`、`style.css`、`app.js`、`bounce-engine.js`、`steal.js`、`ENGINE_LICENSE.txt` を配信ルートへ置きます。ビルドは不要です。

## 画面と棋譜

元ゲームの公開版に寄せた配色と操作を保持し、盤だけを2列16穴へ変更しました。2026年10月1日の配置調整では、盤面を少し下げ、枠下のKICHWA／NYUMBA表示は盤面に近づけて、上下の余白を整えました。盤面領域の高さと穴の寸法・間隔は維持しています。各穴の座標は `SF1〜SF8 / NF1〜NF8`、初期ハンド表示は12個です。

全投入は一度の投入として表示し、その後の捕獲・種まき・NYAKUAを自動再生します。端で折り返した際は状態文にも反転を表示します。「高速」は表示間隔を短くし、「新しい対局」は再生を中断して対局設定へ戻ります。サウンドと高速は初期OFFです。

棋譜JSONは `version: 5`、`rulesVersion: "0.6.1"`、`variantRule: "namua-steal-one-protect-last-fixed-pit-bulk-one-row-bounce-hand12"`。`nyakuaProtectLast: true`、1列、折り返し、初期ハンド12個、合計44個も明記します。各手の `placed`、`captures`、`stolen` を維持しています。旧v0.6.0・4列盤の棋譜と同じルールでは再現できません。画面からの棋譜読み込みは未実装です。

簡易コンピューターは一手評価の試作用の相手です。元のAI-GEN4、分析タグ、棋譜送信、PWAは取り込んでいません。

## 検証

```sh
node --test prototype/bounce.test.cjs prototype/app.test.cjs prototype/steal.test.js tools/fixed-pit-bulk-study.test.cjs tools/fixed-pit-triggered-study.test.cjs
node tools/nyakua-protect-last-study.cjs 1000
```

折り返し、MTAJIの帰着判定、NYAKUA、パス、一穴全投入、スナップショット、棋譜再構築、総数保存、盤面側の対称性を確認します。過去の4列盤の試験も保持しています。

[最後の1個保護の進行確認](../doc/NYAKUA_PROTECT_LAST_20261001.md)では、新旧各4,000対局、候補手10,451件、座席交換200局、棋譜再構築200局を確認しました。全局面での停止、先後均衡、人間の操作感を保証するものではありません。

[折り返し方式の調査](../doc/ONE_ROW_BOUNCE_STUDY_20261001.md)、[ハンド12個・8個の比較](../doc/HAND12_VS_HAND8_BALANCE_20261001.md)、[6個の追加試験](../doc/HAND6_BALANCE_20261001.md)は、最後の1個を奪えるv0.6.0の履歴です。6個の必勝手順や勝率をv0.6.1へ引き継ぎません。初期ハンドは12個のままです。

[現行v0.6.1の先後比較](../doc/CURRENT_FIRST_PLAYER_BALANCE_20261001.md)を29,000局で確認しました。単純方針では先手勝率47.82〜53.68%、探索方針では56.3〜100%で、先後の偏りは残っています。6手探索の1,000局全勝は、先手必勝の証明とは区別します。

## 出典・ライセンス

`engine.js`、そこから改変した `bulk-engine.js` と `bounce-engine.js`、元の公開版を参考にしたスタイルは [bao-la-kiswahili-gameのMIT License](ENGINE_LICENSE.txt)に従います。著作権表示と許諾条件を保持しています。試作独自のコード・説明文のライセンスは現時点で未設定です。

同数ハンド・先後のハンド差・NYUMBA4個基準・配置分散を順に調べた[先後バランス改善候補の比較報告](../doc/BALANCE_OPTIONS_STUDY_20261001.md)も保存しました。19条件と5条件の別seed確認で改善傾向はありましたが、方針を通じた均衡は確認できず、その初期条件案は製品ルールへ採用していません。最後の1個保護は別途v0.6.1へ採用しました。

