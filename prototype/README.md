# Bao Nakakamado — 遊べる試作 v0.5.1（一穴全投入の試用）

Bao la Kiswahili の [元エンジン](https://github.com/nkkmd/bao-la-kiswahili-game/blob/main/public/engine.js) の 2026-09-29 時点の blob `1527bb3665228b7a5bd9f03153567aedbaaa22d7` を `engine.js` に変更せず保存した。実際の試作画面は、NAMUAの投入だけ変更した `bulk-engine.js` と、NYAKUA（ニャクア、ハンド奪取）を扱う `steal.js` を使う。画面は元ゲームの盤面・配色を参考に作成し、元の分析タグ、棋譜送信、AI-GEN4、PWAは取り込んでいない。

## 試作ルール

- NAMUA中、相手のハンドが0で自分のハンドが2個以上なら、合法な穴・方向を一度選び、**自分のハンドの全KETEを選んだ一穴へ一度に置く**。通常の1個投入が残数の一括投入に置き換わるだけで、その後の捕獲またはtakata、連続種まき、nyumba、終局は元の処理を使う。穴から次の穴へ分配したり、途中で新しい穴・方向を選んだりはしない。
- 自分のハンドが1個なら通常の1個投入。相手のハンドにKETEが残っている間も通常の1個投入。
- ハンドが0の側は、両者が0になるまでは元エンジンどおりNAMUAでパスする。両者が0になればMTAJIへ移る。MTAJIの着手と勝敗判定は従来どおり。片側だけ先にMTAJIへ入る案は未実装。
- **[NYAKUA（ニャクア）](../doc/TERMINOLOGY.md)**：NAMUAの**一着手内で2回以上捕獲**し、相手のハンドにKETEが残っていれば、着手後に相手から自分のハンドへ1個だけ移す。最初の捕獲と連続種まき中の捕獲を数える。3回以上でも1個。捕獲が1回以下、相手ハンド0、MTAJIの着手には適用しない。
- KETE総数は元エンジンと同じ。勝負宣言・抽選・追加手番は削除済みで、運要素の検討は凍結中。

一穴全投入は**人間での納得感を試す候補**であり、正式採用ではない。[探索的試験](../doc/FIXED_PIT_BULK_STUDY_20260930.md)ではハンドが先に空になった側の勝つ余地と `no-move` 終局、平均手数がともに増えた。均衡や楽しさの結論は出ていない。[試用版の仕様と確認点](../doc/FIXED_PIT_BULK_TRIAL_20260930.md)、[3案の暫定比較](../doc/HAND_EXHAUSTION_OPTIONS_REVIEW_20260930.md)を参照。元ルールとの差異の基準は [RULES_BASELINE.md](https://github.com/nkkmd/bao-la-kiswahili-game/blob/main/doc/RULES_BASELINE.md)。

## 遊び方

```sh
python3 -m http.server 8000 --directory prototype
```

`http://localhost:8000/` で2人対戦か簡易コンピューター対戦を選び、光る穴と着手方向を選ぶ。全投入の手番ではハンドの個数と全投入を画面・着手候補に表示する。選択後は**全数の投入を一画面で表示**し、続く捕獲・種まき・NYAKUAを盤面とハンドの数で順に自動再生する。再生中は着手できない。

棋譜のJSONダウンロードは `version: 3`、`variantRule: "namua-steal-one-and-fixed-pit-bulk"`。各着手に `placed`（ハンドから置いた数）、`captures`、`stolen` を記録する。従来の `version: 2` と同じルールで再現できるとは限らない。画面からの棋譜読み込みは未実装。コンピューターは試作用の簡易一手評価であり、元のAI-GEN4ではない。

## 検証

```sh
node --test prototype/steal.test.js prototype/app.test.cjs tools/fixed-pit-bulk-study.test.cjs tools/fixed-pit-triggered-study.test.cjs
```

到達可能な全投入局面の捕獲・takata・nyumba・即時 `no-move`、1個投入への切替、総数保存、一度の全数投入表示と以降の元エンジンとの一致、棋譜再構築、既存研究実装との一致を確認する。保存した元の `engine.js` を使用する研究ツールはこの試作で変更しない。一般的な先後均衡と人間の理解しやすさは未検証。

## Cloudflare Pages の配置

GitHub連携時は production branch `main`、build command 空欄、build output directory `prototype`。手動配信では `prototype/` の**中身**を配信ルートへ置く。ビルドは不要。

## 出典・ライセンス

`engine.js` とそこから改変した `bulk-engine.js` は [bao-la-kiswahili-game のMIT License](ENGINE_LICENSE.txt) に従う。著作権表示と許諾条件を保持した。試作独自のコード・説明文のライセンスは現時点で未設定。元ゲームの図解ルール画像・文章は複製していない。
