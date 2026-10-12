# Bao Nakakamado

Bao la Kiswahiliをベースに、独自ルール **NYAKUA（ニャクア）** を加えたオリジナルのBaoです。盤・種まき・捕獲の仕組みを受け継ぎ、ハンドのKETEを使った駆け引きを加えています。

**現行ルールはv0.10.0**です。NYAKUAは「着手終了後に終点へ2個追加する」方式で、基礎規則に **takasia** を採用しています。考案者は **nkkmd**、Bao Nakakamado・NYAKUAの初公開日は **2026年9月30日**です。

## 目的から探す

| 目的 | 読む場所 |
|---|---|
| 現行ルールで遊ぶ | [起動・配布・操作](prototype/README.md)／[試作のファイル](prototype/) |
| 遊び方を知る | [現行ルールブック](doc/RULEBOOK.md)／[用語・棋譜](doc/TERMINOLOGY.md) |
| ルールの版や変更点を比較する | [下の版一覧](#ルールの版と試験)／[版ごとの詳細](doc/RULE_VERSIONS_AND_TESTS.md) |
| 各ルールの先後差・必勝・進行の試験を読む | [ルール版と試験の索引](doc/RULE_VERSIONS_AND_TESTS.md) |
| 最新の研究状況を確認・引き継ぐ | [v0.10.0の完了分と再開手順](doc/V010_RESEARCH_HANDOFF_20261012.md) |
| コンピューターの開発・棋力試験を読む | [AI開発の索引](doc/AI_DEVELOPMENT_INDEX.md) |
| 考案・採用・公開の経緯を確認する | [考案・公開・変更履歴](doc/ORIGIN_AND_HISTORY.md) |

## 現行版の概要

- 4列32穴。各人の前列は6・2・2、後列は空、ハンド22個ずつで、合計64個のKETEを使います。
- NAMUAの一手で2回以上捕獲し、通常処理完了時に自分のハンド1個以上・相手2個以上なら、双方から1個ずつ終点へ追加します。追加後の種まき・捕獲はなく、相手の最後の1個は保護します。即時終局・安全停止では追加しません。
- 両ハンド0で共通MTAJIへ移行します。takasiaは相手の次の1手に作用する、takata開始と連続種まきを制限する規則です。成立条件と処理は[ルールブック](doc/RULEBOOK.md)を参照してください。
- 2人対戦・簡易コンピューター・探索コンピューターに対応します。既定は探索・強い（150ms）。画面表示は「試作 v0.10.0」です。

## ルールの版と試験

**版番号はルールの違いを表します。** AIの開発段階や棋譜formatのversionとは別です。旧版のルールブックは当時のコミットへリンクしています。日付・採用根拠・保存版は[詳細索引](doc/RULE_VERSIONS_AND_TESTS.md)で確認できます。

| ルール版 | 主な特徴・変更 | ルールを読む | その条件の試験 |
|---|---|---|---|
| **v0.10.0（現行）** | 終点2個追加＋takasia | [ルールブック](doc/RULEBOOK.md) | [先後差・必勝探索・実装検証](doc/RULE_VERSIONS_AND_TESTS.md#v0100) |
| v0.9.0 | NYAKUA案A：着手終了後に終点2個追加 | [当時のルールブック](https://github.com/nkkmd/bao-nakakamado/blob/7cfced6a604a8b09f2c8a5a56234495aa9a535d7/doc/RULEBOOK.md) | [案Aの比較・循環・試験実装](doc/RULE_VERSIONS_AND_TESTS.md#v090) |
| v0.8.0 | 奪取分を別確保し、次の自分の手で原則3個投入 | [当時のルールブック](https://github.com/nkkmd/bao-nakakamado/blob/6aba3b2d149aa7b7700148d672969b48481cfe31/doc/RULEBOOK.md) | [3個投入の比較・公開実装照合](doc/RULE_VERSIONS_AND_TESTS.md#v080) |
| v0.7.0 | 前後列・ハンド22個へ復元。最後の1個保護・一穴全投入 | [当時のルールブック](https://github.com/nkkmd/bao-nakakamado/blob/db84f8b431b80efb6fa072761a0968b293c50c04/doc/RULEBOOK.md) | [復元の検証・3個投入との比較](doc/RULE_VERSIONS_AND_TESTS.md#v070) |
| v0.6.1 | 各人1列・ハンド12個。最後の1個保護を追加 | [当時のルールブック](https://github.com/nkkmd/bao-nakakamado/blob/7f9160a2ac9a8e066efa3aeffd09b0bf99a47a8f/doc/RULEBOOK.md) | [先後比較・配置調整](doc/RULE_VERSIONS_AND_TESTS.md#v061) |
| v0.6.0 | 各人1列8穴・折り返し・ハンド12個 | [当時のルールブック](https://github.com/nkkmd/bao-nakakamado/blob/b2da48929907f0944074fb153ea282c80c9a458d/doc/RULEBOOK.md) | [進行・ハンド12／8／6個・調整候補](doc/RULE_VERSIONS_AND_TESTS.md#v060) |
| v0.5.1 | 4列盤・一穴全投入。最後の1個も奪える | [当時のルールブック](https://github.com/nkkmd/bao-nakakamado/blob/a7ea305d0ee56e731090fe9ac95b60bfd88d0421/doc/RULEBOOK.md) | [一穴全投入の調査・試用](doc/RULE_VERSIONS_AND_TESTS.md#v051) |
| 初期試作v0.4 | 4列盤・ハンド奪取。ハンド枯渇時はパス | [当時の条件](doc/FIRST_PLAYER_BALANCE_20260929.md) | [先後差・段階移行候補](doc/RULE_VERSIONS_AND_TESTS.md#v04) |

ハンド8・6個や6・2配置などは比較用の試験条件です。採用版と区別し、[未採用案](doc/RULE_VERSIONS_AND_TESTS.md#未採用案)も別に案内しています。各報告書の「現行」「未採用」は記録当時の意味です。過去の勝率・必勝証明を現行ルールへ引き継ぎません。

## 現行版で分かっていること

**初期配置の必勝側と、ルール全体の公平性は未確定です。** 正式10,240局と追加調査001〜004を完了しましたが、先後の成績はAIの評価方針・探索量に強く依存します。主試験の共通経路で21手目を指す直前の局面からは、後攻18着手以内の通常勝利を証明済みです。004では19手目の9分岐中6分岐で分岐後の後攻必勝を確認しましたが、3分岐が未証明で19手目全体も未確定です。初期配置からその局面へ強制できる証明ではありません。

[調査別の結果・計画一覧](doc/RULE_VERSIONS_AND_TESTS.md#v0100)から各報告書へ進めます。[完了分と再開手順](doc/V010_RESEARCH_HANDOFF_20261012.md)には原記録・再監査・未解決事項をまとめています。[004結果](doc/V010_BRANCH_PROOF_RESULTS_20261012.md)には全件監査・保存と残る3分岐を記録しています。

全局面での停止も未確定です。連続種まきは512回の安全上限で停止し、通常勝敗と区別します。コンピューターの強さを比べた試験は[AI開発の索引](doc/AI_DEVELOPMENT_INDEX.md)を参照してください。

## ライセンス・出典・管理

コード・UI構造・CSS・テスト・設定は[MIT](LICENSE)、説明文・図表は[CC BY-SA 4.0](LICENSE-CC-BY-SA-4.0.txt)です。文書中の実行可能なコード例はMITです。[対象ごとの適用範囲・出典](LICENSES.md)を参照してください。

基礎ルールの説明は「Bao la Kiswahili 日本語完全ガイド」（© 2026 bao-la-kiswahili-ja contributors）と[元ゲーム](https://github.com/nkkmd/bao-la-kiswahili-game)の図解ルール（© 2026 bao-la-kiswahili-game contributors）を参照・再構成し、NYAKUAなどを追加しました。元プログラムのMIT表示（© 2026 cultivationdata.net）は[ENGINE_LICENSE.txt](prototype/ENGINE_LICENSE.txt)に保持しています。[原型側の採用ルール基準](https://github.com/nkkmd/bao-la-kiswahili-game/blob/main/doc/RULES_BASELINE.md)も参照できます。

考案者・公開日・変更履歴は[履歴文書](doc/ORIGIN_AND_HISTORY.md)、更新時の手順は[リポジトリ管理ルール](AGENTS.md)に定めます。ゲームの仕組み自体に独占権を主張するものではありません。
