# ライセンスと出典

更新日：2026年10月5日。コードは **MIT**、説明文・図版は **CC BY-SA 4.0** で提供します。同じファイルを利用者が自由に選べる二重ライセンスではなく、以下の対象ごとに適用します。

## 適用範囲

| 対象 | ライセンス |
|---|---|
| JavaScript・Pythonなどのプログラム、テスト、CSS、HTMLの構造、操作ラベル、設定、GitHub Actions | [MIT](LICENSE) |
| 本リポジトリのMarkdown文書の文章・表・自作図版（README、ルールブック、調査報告、管理ルール、ツールのREADMEを含む） | [CC BY-SA 4.0](LICENSE-CC-BY-SA-4.0.txt) |
| `prototype/index.html` の `#about`・`#rules` 内の説明文、および `prototype/licenses.html` の説明文 | CC BY-SA 4.0。HTML・CSSのコードにはMITを適用 |
| 文書内の実行可能なコード例・コマンド例 | MIT。周囲の説明文・図表にはCC BY-SA 4.0を適用 |
| JSONなどの機械可読な試験結果・棋譜・検証データ | 著作権による保護がある部分はMIT。単なる事実・数値に新たな制限は設けない |
| ライセンス条文、第三者の引用、リンク先の資料、別途ライセンスを明記した素材 | それぞれの元の条件。上記の指定で上書きしない |

CC BY-SA対象の文書は © 2026 nkkmd and Bao Nakakamado contributors。元資料由来の部分については、下記の著作者・著作権表示も保持します。MITの標準条文にある「associated documentation files」は、上表でCC BY-SA対象とした説明文をMITへ変更するものではありません。

## 元資料と変更内容

### プログラム・画面

- 出発点：[bao-la-kiswahili-game](https://github.com/nkkmd/bao-la-kiswahili-game)。元のプログラム・画面のMIT表示は **Copyright (c) 2026 cultivationdata.net**。
- 取り込んだエンジンと画面の表示を [prototype/ENGINE_LICENSE.txt](prototype/ENGINE_LICENSE.txt) に原文のまま保存しています。`prototype/style.css` の既存クレジットも保持します。
- このプロジェクトではNYAKUA、投入方法、試作画面、棋譜、調査ツールなどを追加・変更しています。規則変更は[考案・公開・変更履歴](doc/ORIGIN_AND_HISTORY.md)、現行実装は[試作README](prototype/README.md)を参照してください。
- 2026年10月4日、開発用の `prototype/search-ai.js` と `prototype/search-evaluator.js` に、元ゲームの固定コミット `8c87ed44c9b08f75456766f0a9bd9f76d06209d4` の `public/ai.js`・`public/ai-weights.js` を適応しました。MIT、Copyright (c) 2026 cultivationdata.net。探索接続、局面識別、時間制限、安全停止、ニャクアの評価特徴・重みを変更しています。[移植記録](doc/AI_SEARCH_IMPLEMENTATION_20261004.md)を参照してください。学習済み論理ゲート型評価器は取り込んでいません。
- 2026年10月5日、上記の `prototype/search-ai.js` を原本のまま保存し、`prototype/model-search-ai.js` に評価器の接続口・整数値検査・別の識別名を追加しました。探索処理と既存のMIT表示を維持しています。[凍結モデルの探索接続](doc/AI_MODEL_SEARCH_CONNECTION_20261005.md)を参照してください。
- 同日、`tools/ai-integration/learning-input.cjs`・`learning_input.py` の二値・しきい値入力方式を、同じ固定版の `public/logic-evaluator.js`・`tools/engineering/train-pbai-p6.py` を参考に適応しました。MIT、Copyright (c) 2026 cultivationdata.net。通常ハンドと確保分の区別、投入数、範囲検査、南北正規化、入力幅を本ゲーム用に変更しました。[学習設計](doc/AI_LEARNING_DESIGN_20261004.md)に出典と変更を記録しています。元モデル・学習器のコピーは含みません。

### CIの依存

2026年10月5日、`tools/ai-integration/formal-learning-trainer.py` のridge・MLP・論理ゲートの連続緩和・Adam・離散化後の出力調整を、同じ固定版の `tools/engineering/train-pbai-p6.py`（git blob `5456c75f2fd4458e978f91d275f23a7e800c2670`）から適応しました。MIT、Copyright (c) 2026 cultivationdata.net。元の著作権表示をファイル内に保持しています。入力幅368、train専用のデータ契約、Adam/RNG/途中位置の再開、固定整数MLP推論、版・ソース・実行環境の照合を追加しました。元の学習済み重みは取り込んでいません。前日の入力パイロット時点では学習器のコピーを含まなかったという上記記録と区別します。[正式学習の仕様と検証](doc/AI_FORMAL_LEARNING_DESIGN_20261005.md)を参照してください。

本学習・開発検証の依存として [NumPy v2.3.5](https://github.com/numpy/numpy/tree/v2.3.5) を固定しました。BSD-3-Clause、Copyright (c) 2005-2025, NumPy Developers。[当該版のLICENSE.txt](https://github.com/numpy/numpy/blob/v2.3.5/LICENSE.txt)を確認しています。NumPy本体の改変・コピーは行わず、実行環境のBLAS情報を記録します。`.github/workflows/formal-learning*.yml` には公式の [actions/setup-python@v5](https://github.com/actions/setup-python/tree/v5) を設定し、Python 3.12.14を使用します。MIT、Copyright (c) 2018 GitHub, Inc. and contributors。[LICENSE](https://github.com/actions/setup-python/blob/v5/LICENSE)を確認しています。これらの依存・学習用ツールは配信用prototypeへ同梱しません。

2026年10月4日、`.github/workflows/prototype-check.yml` の教師試走集約へ公式の [actions/download-artifact@v4](https://github.com/actions/download-artifact/tree/v4) を追加しました。MIT、Copyright (c) 2018 GitHub, Inc. and contributors。README blob `aa71e839b25e781fee4222931e5751b65c9f0449` と LICENSE blob `a67dca8b4f65d6bd351f6b1e333ce2cd84d843a5` を確認しています。action本体の改変・コピーはなく、artifactを名前ごとの別ディレクトリへ配置する設定を追加しました。依存本体は配信用prototypeへ同梱しません。[測定記録](doc/AI_TEACHER_FEASIBILITY_20261004.md)を参照してください。

2026年10月5日までの[正式収集基盤](doc/AI_FORMAL_COLLECTION_INFRASTRUCTURE_20261004.md)では、同じ公式actionを `.github/workflows/formal-collection.yml` の計画・shard取得にも設定しました。標準ライブラリによるNodeのAES-256-GCMとPythonのZIP検査・Actions API復元を新規実装し、追加の外部パッケージは導入していません。著作権・ライセンス表示と配信用prototypeへの非同梱を維持します。

### ルールの説明文

基礎ルールの説明は、次のCC BY-SA 4.0の資料を参照・再構成しています。

1. [Bao la Kiswahili 日本語完全ガイド](https://github.com/nkkmd/bao-la-kiswahili-ja/tree/1179267b1f19b27a2138791253f2cb9cbfe98c14)、© 2026 bao-la-kiswahili-ja contributors。[元資料のライセンス](https://github.com/nkkmd/bao-la-kiswahili-ja/blob/1179267b1f19b27a2138791253f2cb9cbfe98c14/LICENSE)。
2. [元ゲームの図解ルール](https://github.com/nkkmd/bao-la-kiswahili-game/blob/096ee1fbc6f562f7a2959e62ea80b628ea78f7c8/public/rules.html)、© 2026 bao-la-kiswahili-game contributors。確認時点の版を固定して示しています。この説明ページ自体も日本語完全ガイドの説明を要約・英訳・再構成しています。

Bao Nakakamadoでは説明の構成・表現を変更し、NYAKUA、ハンド枯渇時の処理、盤の変更と復元、最後の1個保護、別確保・次手3個投入、操作方法、棋譜、実装上の制約を追加しました。現行v0.8.0の説明に過去仕様を引き継いでいません。[ルールブック](doc/RULEBOOK.md)と[変更履歴](doc/ORIGIN_AND_HISTORY.md)に具体的な内容を記録します。

以前のルールブックの「出典と再利用」にあったCC BY-SA表示を、2026年10月2日に現行版へ復元しました。今回の整備で、元資料の著作権・ライセンスを置き換えることはありません。

## 再利用するとき

- **コード**：MITの著作権表示と許諾文を、コピーまたは重要な部分に含めてください。
- **説明文・図版**：著作者・出典・著作権表示、[CC BY-SA 4.0へのリンク](https://creativecommons.org/licenses/by-sa/4.0/deed.ja)、変更した旨と以前の変更表示を保持してください。改変物を公開するときはCC BY-SA 4.0、または条文で認められた互換条件を適用してください。
- コードと説明文はどちらも商用利用できます。各ライセンスの無保証・責任制限の条項が適用されます。正式な条件は[MIT条文](LICENSE)と[CC BY-SA 4.0条文](LICENSE-CC-BY-SA-4.0.txt)を参照してください。

説明文のクレジット例：

> Bao Nakakamado ルールブック v0.8.0 — © 2026 nkkmd and Bao Nakakamado contributors。Bao la Kiswahili 日本語完全ガイド（© 2026 bao-la-kiswahili-ja contributors）と元ゲームの図解ルール（© 2026 bao-la-kiswahili-game contributors）を参照・再構成し、NYAKUAなどを追加。CC BY-SA 4.0。出典と各ライセンスへのリンクは本ページ参照。

ライセンスは著作権等による保護がある表現に適用します。ゲームのルールというアイデア自体に独占権や考案者表示の義務を新たに作るものではありません。Bao Nakakamado・NYAKUAの名称について、商標登録済みとの表示や、元資料・考案者が第三者の作品を公式に承認したとの表示は行いません。

## 配信・ZIP

`prototype/` だけを配信しても表示と条文が残るよう、次を同梱します。

- `index.html` の「ライセンス・考案と公開の記録」リンク
- `licenses.html`：適用範囲、元資料のクレジット、変更内容、考案者・初公開日
- `LICENSE`：ルートのMIT条文の同一コピー
- `LICENSE-CC-BY-SA-4.0.txt`：ルートのCC BY-SA条文の同一コピー
- `ENGINE_LICENSE.txt`：元プログラムのMIT表示の原文

公開・改訂時の維持手順は [AGENTS.md](AGENTS.md) に定めます。

2026年10月5日の[正式学習結果](doc/AI_FORMAL_LEARNING_RUN_20261005.md)に基づく `tools/ai-integration/frozen-models/formal-v1-linear-2026100401/` は、本ゲームの固定trainから新規に学習した開発候補です。元ゲームの学習済み重みは流用していません。モデル・学習記録・receipt・validation報告の保護対象部分はMIT、説明文はCC BY-SA 4.0。公開AI採用・最終評価の合格とは区別します。

2026年10月5日の[試験用画面接続](doc/AI_BROWSER_WORKER_20261005.md)では、本ゲームの凍結線形モデルと専用エンコーダーを `prototype/browser-model.js` に決定的に生成しました。元ゲームの学習済み重みは流用していません。エンコーダーのMIT表示（Copyright (c) 2026 cultivationdata.net）を保持し、モデル・推論・Worker・clientはMITです。実機確認と公開採用判断は後続工程です。
