# Bao Nakakamado — 遊べる試作 v0.5.1（一穴全投入の試用）

Bao la Kiswahili の [元エンジン](https://github.com/nkkmd/bao-la-kiswahili-game/blob/main/public/engine.js) の 2026-09-29 時点の blob `1527bb3665228b7a5bd9f03153567aedbaaa22d7` を `engine.js` に変更せず保存した。実際の試作画面は、NAMUAの投入だけ変更した `bulk-engine.js` と、NYAKUA（ニャクア、ハンド奪取）を扱う `steal.js` を使う。画面は元ゲームの `public` の盤面・配色・画面構成を参考に作成し、元の分析タグ、棋譜送信、AI-GEN4、PWAは取り込んでいない。

## 試作ルール

基本の遊び方と例外を含む一通りの説明は、[現行試作のルールブック](../doc/RULEBOOK.md)を参照。

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

### 画面と操作

2026-09-30に、元ゲームの `public`（コミット `09ac50d4116761b400d742cffa3b2478de11ec48`）に合わせて画面を整理した。

- 一列の盤面中心の構成とし、対局設定を盤面内に表示する。スマホでは設定中の盤面を隠し、設定欄がはみ出さないようにする。
- 盤・穴の配色、円形の穴、NYUMBAの四角い枠、合法手・選択・再生中の強調、手番・段階・ハンドの配置を元ゲームに近づける。
- 上部に「サウンド」「高速」「新しい対局」を置く。サウンドと高速は初期OFF。高速ONでも全投入・捕獲・NYAKUAを含む全イベントを順に表示し、表示間隔を短くする。
- 「新しい対局」で再生を中断して設定へ戻る。設定で選んだ条件は「対局開始」で反映する。
- NYAKUAの回数と直近の結果は盤面下に表示し、説明・ルール・棋譜保存は折りたたみ内にまとめる。
- 穴はキーボードでも操作できるボタンとして保持する。選択後は着手候補へ、着手再生後は次の合法な穴へフォーカスを移す。穴の座標はルールブックと同じ `SF/SB/NF/NB` を維持する。

「棋譜の保存」を開いて「棋譜を保存」を押す。棋譜のJSONダウンロードは `version: 3`、`variantRule: "namua-steal-one-and-fixed-pit-bulk"`。各着手に `placed`（ハンドから置いた数）、`captures`、`stolen` を記録する。従来の `version: 2` と同じルールで再現できるとは限らない。画面からの棋譜読み込みは未実装。コンピューターは試作用の簡易一手評価であり、元のAI-GEN4ではない。

## 検証

```sh
node --test prototype/steal.test.js prototype/app.test.cjs tools/fixed-pit-bulk-study.test.cjs tools/fixed-pit-triggered-study.test.cjs
```

到達可能な全投入局面の捕獲・takata・nyumba・即時 `no-move`、1個投入への切替、総数保存、一度の全数投入表示と以降の元エンジンとの一致、棋譜再構築、既存研究実装との一致を確認する。保存した元の `engine.js` を使用する研究ツールはこの試作で変更しない。一般的な先後均衡と人間の理解しやすさは未検証。

## Cloudflare Pages の配置

GitHub連携時は production branch `main`、build command 空欄、build output directory `prototype`。手動配信では `prototype/` の**中身**を配信ルートへ置く。ビルドは不要。

## 出典・ライセンス

`engine.js` とそこから改変した `bulk-engine.js`、元の `public/style.css` を参考にしたスタイルは [bao-la-kiswahili-game のMIT License](ENGINE_LICENSE.txt) に従う。著作権表示と許諾条件を保持した。スタイルの著作権表示と許諾条件も同ファイルで保持する。試作独自のコード・説明文のライセンスは現時点で未設定。元ゲームの図解ルール画像・文章は複製していない。

