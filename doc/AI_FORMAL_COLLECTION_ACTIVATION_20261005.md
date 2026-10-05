# 正式教師収集v2のworkflow登録・起動状況

> 後続更新：ブラウザー認証と収集鍵の新規登録が完了し、正式収集v2の8192件を完了し、監査・封印も通過した。[run 37245789837の記録](AI_FORMAL_COLLECTION_RUN_V2_20261005.md)を参照。以下は認証待ち時点の原記録である。

記録日：2026年10月5日（日本時間）。[起動前の準備記録](AI_FORMAL_COLLECTION_LAUNCH_20261005.md)の後続。main統合・ブラウザーへの切替・収集鍵の確認と必要な設定・正式収集v2の起動はユーザー承認済み。

## 完了した操作

[PR #17](https://github.com/nkkmd/bao-nakakamado/pull/17)を2026年10月5日08:47:44 JSTにmainへ統合した。受け入れたheadは `e0fd2d0b9f09d8b47d7770e95817bb01a62b7718`、merge SHAは `210b1001af6151ce67b53072d7463b623eff7395`。正式収集workflowを既定ブランチへ配置した。ゲーム規則v0.8.0・棋譜version 7・公開の簡易コンピューターを維持する。

統合前に、正式workflowの [run 37243077125](https://github.com/nkkmd/bao-nakakamado/actions/runs/37243077125) の無効な定義を確認した。`jobs.<job_id>.env` で利用できない `runner.temp` を参照していたため、runner割当後のstepで `$RUNNER_TEMP` を使い、`GITHUB_ENV` へ鍵・計画のファイルパスを設定する形へ修正した。修正コミットは `e0fd2d0`。この失敗は教師呼出し前のworkflow解析エラーであり、正式収集の計測失敗や時間切れではない。

修正後の [run 37244722999](https://github.com/nkkmd/bao-nakakamado/actions/runs/37244722999)、attempt 1は全8ジョブ成功。89テスト、ブラウザー回帰、全候補監査、開発用artifact復元が通過した。関連22テストもローカルで成功した。収集コード・設定・テストのソースhashと候補計画は変更していない。候補jobの実ログで、計画digest `891329b4e865c97591211072acb18db53022a9704fb0dc7fd0dd479c70600a03`、ソースdigest `4e4d3acfbcfb5de5c9bf7e77accd8b3dbd26649389c0ab06471a025275d0cdac`、除外一覧digest `eda140703e63bc813c2284427e2b471312f103c0ffb0cdfcbdfa36f0d4827a3c` の一致、候補条件通過、教師要求0件を確認した。[機械可読の実行記録](AI_FORMAL_COLLECTION_ACTIVATION_20261005.json)にCI・merge・失敗と修正・未実行の項目を保存する。

## 未完了の操作

ブラウザーはGitHubへ未サインイン。安全な認証フォームでユーザーがパスキーを選択した後、画面は「This browser or device is reporting partial passkey support.」「Waiting for input from browser interaction...」を表示している。認証情報の送信をログイン成功とは扱わず、対象アカウントの確認は未完了である。

repository secret `BAO_COLLECTION_KEY_BASE64` の存在は未確認。鍵の生成・登録・上書きは行っていない。正式収集v2の起動も未実行で、正式run IDはまだない。収集鍵は認証用パスキーとは別の、データ暗号化用の独立した32byte鍵である。

サインイン完了後は対象アカウントとsecretの存在を確認し、存在しない場合に独立した鍵を設定する。既存鍵は盲目的に置き換えない。起動する版は `v2`、新規receiptは `[]`、検証済みソースを持つ作業ブランチを使用する。run/attempt/headとprepare結果を記録し、上記の識別値と照合する。起動操作は承認済みであり、同じ範囲の承認を再要求しない。

起動後の途中保存・全shard復元・採用後監査・封印は[起動手順](AI_FORMAL_COLLECTION_LAUNCH_20261005.md)に従う。本記録時点の正式教師要求は0件。本学習、最終検証の開封、棋力評価、公開AI差し替えは未実施である。後続の実際のrun結果は本記録と区別して保存する。

説明文はCC BY-SA 4.0、機械可読記録の保護対象部分はMIT。[出典・ライセンス](../LICENSES.md)、考案者nkkmd、初公開日2026年9月30日を維持する。
