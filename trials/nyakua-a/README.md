# 案Aの実機試験 trial-001（未採用）

作成日：2026年10月7日（日本時間）。管理者nkkmdの実装指示による試験です。現行公開規則はv0.8.0のままです。

`index.html`を開くと2人対戦または簡易コンピューター対戦で遊べます。スマートフォンでは、このフォルダーの内容を別の試験URLへ配置してください。ZIPはindex.htmlを直下に置く形式です。現行版のURLへ上書きせず、別フォルダー・別URLで比較してください。

案Aは、NAMUAの一手で2回以上捕獲し、通常処理完了時に自分のハンド1個以上・相手2個以上があれば、双方から1個ずつ蒔き終わりの穴へ追加します。一手に一度だけで、追加後の再判定・種まきはありません。後列とNYUMBA停止穴も対象。即時終局と安全停止では追加しません。詳細は同梱の[ルールブック](RULEBOOK.md)・[ブラウザー用ルールブック](rules.html)を参照してください。

## 現行版の保存

保存基点：[6aba3b2d149aa7b7700148d672969b48481cfe31](https://github.com/nkkmd/bao-nakakamado/commit/6aba3b2d149aa7b7700148d672969b48481cfe31)。保存ブランチ：`preserve/v0.8.0-public-20261007`。試験ブランチ：`trial/nyakua-a-20261007`。

`prototype/`の29ファイルを[v0.8.0-preserved.json](v0.8.0-preserved.json)のGit blob SHAで照合します。元の研究エンジン・数値・棋譜も変更しません。これは保存ブランチであり、リリースタグではありません。

## 棋譜と確認

案A専用format `bao-nakakamado-nyakua-a-trial`、version 1、rulesVersion `nyakua-a-trial-001`、variantRule `nyakua-end-pit-a-trial-001`です。現行v0.8.0のversion 7とは区別し、専用replayは異なる形式を拒否します。画面の棋譜読み込みは未実装です。

簡易AIは案Aの遷移で一手後の局面を評価します。学習済みモデルは使用せず、棋力・均衡の検証AIとして扱いません。共通MTAJIの連続種まき512回の安全上限を引き継ぎ、通常勝敗と区別します。循環時の新裁定は未採用です。

リポジトリから検証するコマンド（ZIPにテスト・研究データは同梱しません）：

```sh
node trials/nyakua-a/check.cjs
node --test prototype/next-turn.test.cjs prototype/app.test.cjs prototype/search-transition.test.cjs
python3 tools/package-nyakua-a.py /tmp/nyakua-a-zips
# 開発用PlaywrightとChromiumがある環境
node trials/nyakua-a/browser-check.cjs
```

実機では、NYAKUA時に両ハンドが1個ずつ減って終点が2個増えること、追加で種まきが再開しないこと、先手・後手の簡易AI、棋譜保存を確認してください。問題報告には試験版名・端末・ブラウザー・棋譜を添えると再現できます。実機確認後の正式採用・main統合・サイト配信は別の判断です。

プログラム・画面構造はMIT、説明文はCC BY-SA 4.0。Bao Nakakamado・NYAKUAの考案者nkkmd、初公開日2026年9月30日を保持します。元コード・元説明文の表示と変更内容は[ライセンス案内](licenses.html)に記載しています。
