# 探索コンピューターの公開採用

記録日：2026年10月6日（日本時間）。対象：Bao Nakakamado、ルールv0.8.0、棋譜version 7。

## 採用と画面表示

管理者から「実機試験、特に問題なさそうです」との報告と、公開採用時に「試作 v0.8.0・ニャクア次手3個投入」を「試作 v0.8.0」のみにする指示を受けた。試験接続で確認した凍結線形モデルを公開用の探索コンピューターとして採用する。採用判断者は管理者、実装はAI支援によるもの。考案者nkkmd、初公開日2026年9月30日は維持する。

画面のバージョン表示は **試作 v0.8.0**、対戦相手名は「探索コンピューター」。2人対戦と簡易コンピューターも引き続き選べる。実機確認前という案内を更新する。

| 対象 | 採用内容 |
|---|---|
| 公開AI ID | `NAKAKAMADO-AI-v1` |
| リリースID | `NAKAKAMADO-AI-RELEASE-001` |
| 評価器 | `NAKAKAMADO-FROZEN-LINEAR-2026100401-v1` |
| モデルSHA-256 | `f74175fbaa6f2d6a82148cf5e106da7291f396b2b38cb79866dc641b2147254d` |
| easy / normal / hard | 各手25 / 75 / 150ms、最大深度32 |
| Workerプロトコル | `NAKAKAMADO-BROWSER-WORKER-v1` |
| 新しい探索棋譜 | modeは既存の`computer`。追加のcomputerに公開ID・releaseId・publicAdopted:true・モデルSHA・診断を記録 |

原モデルbytes・入力エンコーダー・探索アルゴリズム・時間予算・取消し・代替手処理は維持する。既存の試験棋譜の `NAKAKAMADO-BROWSER-TRIAL-v1 / publicAdopted:false` は当時の原記録として保持する。元ゲームのAI-GEN4名・release IDは流用しない。

## 判断の根拠と確認範囲

| 根拠 | 結果・範囲 |
|---|---|
| [正式最終評価](AI_FORMAL_FINAL_RUN_20261005.md) | 一度限りの開封、固定18条件すべて通過 |
| [正式同時間比較](AI_EQUAL_TIME_FORMAL_RUN_20261005.md) | 256組512局、モデル311勝・201敗、全局通常終局、固定5条件すべて通過 |
| [試験接続のCI原記録](AI_BROWSER_WORKER_CI_20261006.json) | 全5ワークフロー・全16ジョブ成功。実ChromiumのWorker・取消し・先後2対局・棋譜再生・モバイル幅を確認 |
| 実機試験 | 前工程でmoto g52j 5Gでの確認を依頼し、今回管理者から特に問題はなさそうとの報告を受領 |

実機報告には対局数・端末OS／ブラウザーの実際の版・実測時間・診断JSONの提示はない。それらを推定して記録しない。ブラウザー幅検査を実機検査とは扱わず、端末ごとの性能保証や難易度間の勝率、AI-GEN4相当の棋力は未確認のままとする。正式finalの再開封、モデルの再選定、正式512局の条件変更・再計測は行わない。

[採用変更PR #27](https://github.com/nkkmd/bao-nakakamado/pull/27)の実装head `47987773611973e287f6c3b5c54f2deb39750dae` は、[CI原記録](AI_PUBLIC_ADOPTION_CI_20261006.json)の全5ワークフロー・全16ジョブが成功した。テストcheckout `9279a7098bd840b190645b700ff182038f3e614c` のtreeは実装headと完全一致。既存ルール・DOM 90テストとclient 4テスト、生成モデル一致、通常画面回帰を通過した。

実Chromium 151.0.7922.34でバージョン表示「試作 v0.8.0」と相手名を確認。89開発局面の整数評価、3予算12件のWorker応答、取消し、先後2対局（8手・27手、計18回のモデル着手、代替0、通常終局）、棋譜保存・再生、Worker不可時の代替、幅320/390/432の表示を確認した。ページエラー0。これはブラウザー回帰で、正式棋力評価の再計測ではない。[原結果](public-ai-browser-ci/result.json)、[先手棋譜](public-ai-browser-ci/worker-game-human-0.json)、[後手棋譜](public-ai-browser-ci/worker-game-human-1.json)、[画面](public-ai-browser-ci/public-ai-setup.png)を原bytesで保存した。後続の証拠保存commitでは実行コードを変更しない。

## 配信用ファイル

配信用ZIPは[試作README](../prototype/README.md)に列挙した14ファイルを直下に収め、MIT・CC BY-SA 4.0・元コードの表示を同梱する。HTTP localhostまたはHTTPSで使用する。main統合とZIP作成は公開準備であり、実際のサイト配信日・配信URLは未確認。[考案・公開・変更履歴](ORIGIN_AND_HISTORY.md)に配信情報を確認後に記録する。
