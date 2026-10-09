# ライセンスと出典

更新日：2026年10月9日。コードは **MIT**、説明文・図版は **CC BY-SA 4.0** で提供します。同じファイルを利用者が自由に選べる二重ライセンスではなく、以下の対象ごとに適用します。

## 適用範囲

| 対象 | ライセンス |
|---|---|
| JavaScript・Pythonなどのプログラム、テスト、CSS、HTMLの構造、操作ラベル、設定、GitHub Actions | [MIT](LICENSE) |
| 本リポジトリのMarkdown文書の文章・表・自作図版（README、ルールブック、調査報告、管理ルール、ツールのREADMEを含む） | [CC BY-SA 4.0](LICENSE-CC-BY-SA-4.0.txt) |
| `prototype/index.html` の `#about`・`#rules` 内の説明文、`prototype/rules.html`、および `prototype/licenses.html` の説明文 | CC BY-SA 4.0。HTML・CSSのコードにはMITを適用 |
| 文書内の実行可能なコード例・コマンド例 | MIT。周囲の説明文・図表にはCC BY-SA 4.0を適用 |
| JSONなどの機械可読な試験結果・棋譜・検証データ | 著作権による保護がある部分はMIT。単なる事実・数値に新たな制限は設けない |
| ライセンス条文、第三者の引用、リンク先の資料、別途ライセンスを明記した素材 | それぞれの元の条件。上記の指定で上書きしない |

CC BY-SA対象の文書は © 2026 nkkmd and Bao Nakakamado contributors。元資料由来の部分については、下記の著作者・著作権表示も保持します。MITの標準条文にある「associated documentation files」は、上表でCC BY-SA対象とした説明文をMITへ変更するものではありません。

## 元資料と変更内容

### プログラム・画面

- 出発点：[bao-la-kiswahili-game](https://github.com/nkkmd/bao-la-kiswahili-game)。元のプログラム・画面のMIT表示は **Copyright (c) 2026 cultivationdata.net**。
- 取り込んだエンジンと画面の表示を [prototype/ENGINE_LICENSE.txt](prototype/ENGINE_LICENSE.txt) に原文のまま保存しています。`prototype/style.css` の既存クレジットも保持します。
- このプロジェクトではNYAKUA、投入方法、試作画面、棋譜、調査ツールなどを追加・変更しています。規則変更は[考案・公開・変更履歴](doc/ORIGIN_AND_HISTORY.md)、現行実装は[試作README](prototype/README.md)を参照してください。
- 2026年10月9日、v0.10.0で原型側に正式採用されたtakasiaを現行エンジンへ追加しました。実装はBao la Kiswahiliの採用ルール改訂 `BAO-RULES-V0.2.0-TAKASIA-001` と日本語完全ガイドv0.2.0を参照し、Bao NakakamadoのNYAKUA案Aと共存するよう状態・合法手・relay sowing停止・棋譜を変更しています。[実装記録](doc/TAKASIA_V010_IMPLEMENTATION_20261009.md)を参照してください。元コードのMIT表示を維持します。
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

1. [Bao la Kiswahili 日本語完全ガイドの固定版](https://github.com/nkkmd/bao-la-kiswahili-ja/tree/1179267b1f19b27a2138791253f2cb9cbfe98c14)、© 2026 bao-la-kiswahili-ja contributors。[元資料のライセンス](https://github.com/nkkmd/bao-la-kiswahili-ja/blob/1179267b1f19b27a2138791253f2cb9cbfe98c14/LICENSE)。v0.9.0までの基礎説明を整えた際の固定参照です。
2. [元ゲームの図解ルール固定版](https://github.com/nkkmd/bao-la-kiswahili-game/blob/096ee1fbc6f562f7a2959e62ea80b628ea78f7c8/public/rules.html)、© 2026 bao-la-kiswahili-game contributors。確認時点の版を固定して示しています。この説明ページ自体も日本語完全ガイドの説明を要約・英訳・再構成しています。
3. v0.10.0のtakasia説明は [Bao la Kiswahili 日本語完全ガイド v0.2.0](https://github.com/nkkmd/bao-la-kiswahili-ja/releases/tag/v0.2.0) を追加参照しています。© 2026 bao-la-kiswahili-ja contributors、CC BY-SA 4.0。同リリースはtakasiaの成立条件・例外・停止処理とE30を収録しています。

Bao Nakakamadoでは説明の構成・表現を変更し、NYAKUA、ハンド枯渇時の処理、盤の変更と復元、最後の1個保護、別確保・次手3個投入、操作方法、棋譜、実装上の制約を追加しました。v0.9.0でNYAKUAを着手終了後の終点2個追加へ変更し、v0.10.0で基礎規則としてtakasiaを追加しました。[ルールブック](doc/RULEBOOK.md)と[変更履歴](doc/ORIGIN_AND_HISTORY.md)に具体的な内容を記録します。

以前のルールブックの「出典と再利用」にあったCC BY-SA表示を、2026年10月2日に現行版へ復元しました。今回の整備で、元資料の著作権・ライセンスを置き換えることはありません。

## 再利用するとき

- **コード**：MITの著作権表示と許諾文を、コピーまたは重要な部分に含めてください。
- **説明文・図版**：著作者・出典・著作権表示、[CC BY-SA 4.0へのリンク](https://creativecommons.org/licenses/by-sa/4.0/deed.ja)、変更した旨と以前の変更表示を保持してください。改変物を公開するときはCC BY-SA 4.0、または条文で認められた互換条件を適用してください。
- コードと説明文はどちらも商用利用できます。各ライセンスの無保証・責任制限の条項が適用されます。正式な条件は[MIT条文](LICENSE)と[CC BY-SA 4.0条文](LICENSE-CC-BY-SA-4.0.txt)を参照してください。

説明文のクレジット例：

> Bao Nakakamado ルールブック v0.10.0 — © 2026 nkkmd and Bao Nakakamado contributors。Bao la Kiswahili 日本語完全ガイド（© 2026 bao-la-kiswahili-ja contributors）と元ゲームの図解ルール（© 2026 bao-la-kiswahili-game contributors）を参照・再構成し、NYAKUAとtakasia対応などを追加・変更。CC BY-SA 4.0。出典と各ライセンスへのリンクは本ページ参照。

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

2026年10月5日の[試験用画面接続](doc/AI_BROWSER_WORKER_20261005.md)では、本ゲームの凍結線形モデルと専用エンコーダーを `prototype/browser-model.js` に決定的に生成しました。元ゲームの学習済み重みは流用していません。エンコーダーのMIT表示（Copyright (c) 2026 cultivationdata.net）を保持し、モデル・推論・Worker・clientはMITです。この試験接続時点では実機確認と公開採用判断は後続工程でした。2026年10月6日、実機試験の報告を受けて[公開AIとして採用](doc/AI_PUBLIC_ADOPTION_20261006.md)しました。ライセンスと元の著作権表示は維持します。

## 案A実機試験版の適用範囲

2026年10月7日、`trials/nyakua-a/`へ未採用の案Aを隔離実装しました。engine.js・rules.js・app.js・CSS・HTML構造・操作ラベル・テスト・検証結果の保護対象部分・梱包スクリプト・設定はMIT、README・RULEBOOK・HTMLの説明文はCC BY-SA 4.0です。元エンジン・CSSの表示と同梱条文を保持し、v0.8.0の別確保・次手3個投入を終点2個追加へ変更しました。開発ブラウザー検証は既存CIと同じPlaywright 1.62.1を使用します。学習済みモデル・探索Workerは案A配布物に同梱しません。配布物内の`licenses.html`にも出典・変更内容を記載しています。現行`prototype/`の表示・条文は変更しません。

## v0.9.0の正式採用と保存版

2026年10月7日、管理者の正式採用指示に基づき、prototype/end-pit-engine.js・end-pit-rules.js・app.jsに案Aの終点2個追加を採用しました。コード・テスト・梱包・設定はMIT、画面about・rules・rules.html・ライセンスページ・README・ルールブックの説明文はCC BY-SA 4.0。元コード・CSS・元説明文の表示と同梱条文を保持します。「Bao la Kiswahiliをベースに独自ルールNYAKUAを採用したオリジナルのBao」と説明を追加しました。

旧v0.8.0の画面・探索AIを含む29ファイルはtrials/v0.8.0/に原bytesで保存します。旧AIのソース・モデル・採用記録のライセンスは維持し、現行v0.9.0の配布ZIPに旧モデルやWorkerは含めません。案A試験版と研究結果も当時の記録として保存します。上記の試験実装時点の「未採用」「prototypeを変更しない」は、その作業時点の適用範囲で、正式採用後の現在状態は本節を基準とします。

## v0.10.0のtakasia対応

2026年10月9日、原型Bao la Kiswahiliで正式採用されたtakasiaをBao Nakakamadoの基礎規則として取り込みました。NYAKUA案Aは維持します。現行の`prototype/end-pit-engine.js`・`end-pit-rules.js`・`app.js`、takasia回帰試験、梱包・CIのコード部分はMIT、ルールブック・README・画面説明・`rules.html`・`licenses.html`の説明文はCC BY-SA 4.0です。

takasia初回対応のv0.10.0配布ZIPには簡易コンピューターだけを含め、旧v0.8.0の探索Worker・学習済みモデルは同梱しません。過去版の原記録・保存版・ライセンス表示は変更せず、現行説明だけをtakasia対応へ更新します。実際のv0.10.0サイト配信日・URLは未記録です。

## v0.10.0専用探索の試験実装

2026年10月9日、現行NYAKUA案Aとtakasiaを処理する専用探索・手作り評価器・Worker/client・簡易AI共通入口を追加しました。保存済みv0.8.0探索を介し、元ゲームの固定commit `8c87ed44c9b08f75456766f0a9bd9f76d06209d4` のMITコードを適応し、Copyright (c) 2026 cultivationdata.netを保持します。新規コード・テスト・JSON・梱包・CIはMIT、実装記録・README・画面説明の本文はCC BY-SA 4.0。学習済みモデルを流用せず、試験ZIPには現行Workerと手作り評価器を同梱します。試験AIの公開採用状態はfalseです。

## v0.10.0専用探索の正式採用

2026年10月9日、管理者の実機確認報告を受け、現行専用探索・手作り評価器・Worker/clientを正式採用し、既定AIへ切り替えました。上記の試験AI未採用状態は試験当時の記録です。ライセンス範囲・元著作権表示・同梱条文は維持し、新規第三者素材・モデルは追加しません。現行ZIPは専用Workerと手作り評価器を含みます。旧v0.8.0の探索と学習済みモデルは保存版として保持します。
