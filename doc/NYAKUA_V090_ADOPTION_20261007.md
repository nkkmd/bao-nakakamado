# 案Aの正式採用：v0.9.0

記録日：2026年10月7日（日本時間）。対象：Bao Nakakamadoのルールv0.9.0、棋譜version 8。

## 採用判断

nkkmd（管理者）が案Aの正式採用を指示しました。先に作成した[案Aの実機試験版](NYAKUA_A_PLAYABLE_TRIAL_20261007.md)と同じ終点2個追加を公開実装へ採用します。コンピューターは簡易方式のみとし、探索コンピューターの対応は後続工程です。v0.8.0は旧規則として保存し、研究用エンジン・モデル・試験結果・原棋譜は変更しません。

v0.8.0からNYAKUAの効果が変わるため、ルール版をv0.9.0へ進めます。AIの強化だけではなく規則そのものの改訂です。棋譜もversion 7から8へ進め、案A試験版のversion 1とも区別します。

## 規則と画面

NAMUAの一手で捕獲2回以上、通常処理完了時に自分のハンド1個以上・相手2個以上なら、双方のハンドから1個ずつ蒔き終わりの自分の穴へ計2個追加します。一手につき一度、追加後の終点再判定・捕獲・種まきはありません。後列と所有中NYUMBAの停止穴も対象。相手の最後の1個を保護し、即時終局・安全停止では追加しません。別確保・次手3個投入を廃止します。

画面の版表示は「試作 v0.9.0」。対戦は2人対戦・簡易コンピューターです。「Bao Nakakamadoについて」に次の説明を追加しました。

> Bao Nakakamado は、伝統的なマンカラゲーム Bao la Kiswahili をベースに、独自ルールの NYAKUA（ニャクア）を加えたオリジナルの Bao です。Bao la Kiswahili の盤や種まき・捕獲の仕組みを受け継ぎ、ハンドのKETEを使った駆け引きを追加しています。

原型を明示した派生ゲームとして説明し、Bao la Kiswahiliそのものの考案は主張しません。考案者nkkmd、初公開日2026年9月30日、元プログラム・元説明文の表示とライセンスを保持します。

## 実装・保存

公開画面はprototype/end-pit-engine.js・end-pit-rules.js・app.jsを読み込みます。棋譜formatはbao-nakakamado-prototype、version 8、rulesVersion 0.9.0、variantRule namua-end-pit-two-protect-last-two-row-ring-hand22、publicAdopted true。旧v0.8.0と試験版の棋譜を現行棋譜として受理しません。

旧公開版29ファイルはtrials/v0.8.0/に固定コミット6aba3b2d149aa7b7700148d672969b48481cfe31の原bytesで保存し、Git blob SHAで照合します。保存ブランチpreserve/v0.8.0-public-20261007と前回の保存ZIPも保持します。旧UI・探索AIの回帰テストは保存画面を対象に継続します。現行配布ZIPには旧探索AIのモデル・Workerを同梱しません。

ルールブック・用語・README・変更履歴・ライセンス案内を同期し、旧調査の結論を新規則へ書き換えません。共通MTAJIの512回安全停止を維持し、通常勝敗と区別します。循環への新しい裁定、先後均衡や初期局面の必勝の証明を採用したものではありません。

## 確認と公開状態

[採用実装PR #32](https://github.com/nkkmd/bao-nakakamado/pull/32)の採用実装d27534ca8a18dfaf9976b555191d378bef86bbbcを検証しました。[PR側CI](https://github.com/nkkmd/bao-nakakamado/actions/runs/37609754811)と[push側CI](https://github.com/nkkmd/bao-nakakamado/actions/runs/37609749029)がすべて成功しました。

- [遷移レポート](v090-public-ci/live-results.json)：研究用案Aとの100局・18,940候補遷移が一致。NYAKUA追加3,466件、後列960件、所有中NYUMBA427件、残数境界・総数保存・棋譜再構築・既知循環11局を確認しました。
- [ブラウザーレポート](v090-public-ci/browser-results.json)：PCのHTTP起動と320/390/432pxのfile起動で、通常終局49手・安全停止40手の計8対局が研究棋譜と一致。簡易AI両側の8構成、棋譜保存、新しい版・説明・ルール・ライセンスを確認し、画面エラー・横はみ出しは0件です。PCと320pxのabout、390pxの追加表示の画像も目視確認しました。
- [梱包レポート](v090-public-ci/package-results.json)：旧v0.8.0の29ファイルが固定コミットのGit blob SHAと一致。条文コピー、HTML・Markdownの同梱リンク、ZIP内13ファイルとCRCを確認しました。CI生成ZIPと配布ZIPはbytes一致、SHA256はe14a5fee0317afdcb20c01b7363ceb2ea3fd7bc5fd41113841258ac8e70d1b1bです。
- 既存の旧画面・探索Worker・探索遷移・学習/凍結モデル・正式評価準備の回帰確認も成功しました。これは旧モデルをv0.9.0へ採用した結果ではありません。

[確認情報JSON](NYAKUA_V090_ADOPTION_CI_20261007.json)にCI・成果物の識別情報を保存します。初回CIではブラウザー用棋譜の参照先不足で失敗し、リポジトリ内の保存棋譜へ修正しました。その後、配布READMEのリポジトリ外リンクを単独ZIPでも読めるリンクへ変更し、上記の最終CIで再確認しました。ゲームの規則と実行ファイルはそのリンク修正で変更していません。mainの統合コミットと日時はPR #32のマージ記録を基準とします。

配布ZIPはindex.htmlを直下に置き、コードMIT・説明文CC BY-SA 4.0の案内と条文を同梱します。正式採用・main統合・ZIP作成と、実際のサイト配信は別です。v0.9.0のサイト配信日・URLは未記録です。
