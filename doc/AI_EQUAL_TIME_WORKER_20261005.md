# 正式同時間比較v2：受付・分割実行・再開worker

2026年10月5日（日本時間）の実装記録。コード・JSON・設定・テストはMIT、この説明文はCC BY-SA 4.0。ルールv0.8.0、棋譜版7、考案者nkkmd・初公開日2026-09-30 JST、元コードの表示を維持する。

[事前固定記録](AI_EQUAL_TIME_PILOT_20261005.md)の256ペア・512局・32shard、150ms、最大400手、凍結線形モデルと比較評価器、対象開幕、判定閾値を維持する。元教師・収集・学習・最終評価のソース、モデルbytes、履歴contractを変更しない。正式finalは開封済みで再取得・再開封しない。本記録の開発試験は除外済みの開幕と偽APIのみで行い、正式対局の棋力結果ではない。

## 実行入口と固定識別

[worker](../tools/ai-integration/equal-time-worker.cjs)、[artifact・保存](../tools/ai-integration/equal-time-worker-artifact.cjs)、[固定worker仕様](../tools/ai-integration/equal-time-worker-spec.json)、[手動workflow](../.github/workflows/equal-time-formal.yml)を追加した。main・workflow_dispatch・attempt 1・明示したhead SHAとrunner fingerprint・`RUN-FROZEN-EQUAL-TIME-v2`だけを受け付ける。GitHubの「Re-run jobs」は拒否する。Node v24.21.0、Linux x64、登録した2種類のCPU、ImageVersion 20260927.320.1以外では探索前にHOLDとなる。環境が変わっていた場合に固定条件を自動で緩めない。

| 固定対象 | SHA-256 |
| --- | --- |
| contract JSON値 | b34680435b7f0a27da165d638de0b957afcd0b202e0cd2ce1835e28efd083119 |
| contract原bytes | 6e11a2eac2348fb185dc7cf0fca70b928c8582debc030fd260ef94b184705600 |
| 開幕manifest JSON値 | 5edf510a6f75f9029905d4b8bb775fdc30d5a98ae908f3b1739fe223caf83f8f |
| 開幕manifest原bytes | 772bca8ffc5715f60f7a348468305ffc380286460f48096c15fad61b2425b086 |
| 既存v2生成fingerprint | f3e25220de4c40025e5943d618638a01be98d042c7c90f1aac1cab83fe8f7c0f |

runner fingerprintは新規worker・artifact処理・thread・安全展開・仕様・手動workflowと、元の生成fingerprintから計算する。PRのコード更新後には再計算し、成功したCIの値を起動に使う。

## 永続受付と同一ホストの保持

最初のprepareは原pilot ZIPのdigest・全24棋譜・全contract field・旧16384開幕単位と新256開幕の生成を再監査する。その後、`refs/tags/nyakua-strength-v2-<contract JSON値hash>` に一度だけsession受付を作成する。既存ref、競合、応答消失で新規受付を繰り返さない。resumeは同じsessionを検証し、別の比較を作らない。

各shardはpair index modulo 32で8組を担当し、最大4shardを並行実行する。世代ごとの新規leaseタグにsession、origin、環境、host ID、前世代sealを結び付ける。2局は一つのworker threadで先後担当を交互に交換して実行し、探索の設定・各手の時間計測は元の対局実装を利用する。5分の組単位watchdogは異常時にHOLDとしてthreadを終了する。20分のsoft limitには次の組のwatchdog分を確保してから着手し、Actionsの25分上限より前に休止する。

各局の完了をactive記録へ保存し、2局が監査を通過してからpair記録とchecksumを保存する。shardの終了時にledger全体のhashを新規sealタグへ固定する。受付タグ・lease・seal・main・既存結果refを上書き／削除しない。

| 保存状態 | 次の処理 |
| --- | --- |
| COMPLETE | 同じ全記録をbytes単位で再利用。探索・新しいleaseを作らない |
| PAUSED | 監査済みの完成組を保持し、同じ登録環境で未着手組だけを新しい世代へ進める |
| HOLD／active組あり | 完成した片方の局も保存。自動で再測定・別ホストで残りの局を実行しない |
| leaseはあるがseal／artifactなし | 着手の有無が確定できないためHOLD。新規shardとして起動しない |
| 古いPAUSED記録による重複resume | 次世代leaseの競合でHOLD。既に実行した組を再測定しない |

途中の局をやり直す回復方針は導入しない。中断で未計測が残る場合には全固定比較をHOLDとし、条件変更や別比較が必要なら後続の判断記録を先に作る。

## artifact復元と集約

resumeはrepository・run ID・attempt・head SHA・artifact ID・正確なname・digest・shardを含むreceipt配列を明示する。latest検索やnameだけの復元は行わない。Actionsのoriginとworkflow、expired、digest、ZIP実bytes数を照合し、署名付きHTTPSの保存先へGitHubトークンを送らない。ZIPは32MiB、展開64MiB、単一JSON8MiB、最大13ファイルを上限とし、全名・重複・symlink・暗号化・圧縮方式・CRC・JSONを検査してから新しいディレクトリへ書き込む。

保存session・lease・sealをGitHubの原タグと照合し、全完成組を通常遷移と探索用遷移で再生する。開幕・担当順序・合法手・64 KETE・各手の入力／結果hash・停止理由・勝者・ソース条件・環境・origin・ledger checksumを検査する。artifactが欠損・未封印・不正なら原digestを確認できたZIPとHOLD記録を保存し、再計測しない。

集約は正確なcurrent run・attempt・headの32個のartifactだけを対象とする。512局が揃うまでは途中の勝率・棋力指標を算出しない。全256組を監査後だけ、元の固定ペア集計と保守的効用区間・条件付きHoeffding下限・通常終局率・技術的失敗を算出する。pilotの「8局」運用gateは正式集約へ流用せず、遅延・深度・fallbackなどの統計だけを併記する。

公開JSONと原ZIPを新しい結果専用branchへ永続保存する。完全結果は`nyakua-strength-result-<contract hash>`、途中記録は`nyakua-strength-progress-<contract hash>-run-<run ID>`。同じbytesだけ冪等で再利用し、異なる内容を上書きしない。artifactの保持期間は90日。Gitの原ZIPはその後も監査根拠として残るが、現在の自動resume入口は期限内の正確なActions receiptを必要とする。期限切れや保存障害後の別の回復経路は別途記録・検証してから用いる。

## 開発検証と次工程

[読取り専用CI](../.github/workflows/equal-time-worker-check.yml)は15プロトコルテスト、13 ZIP境界テスト、除外済みpilot開幕4組8局の実thread smokeを行う。偽Git/Actionsで受付競合・応答消失・休止／再開・改ざん・中断・watchdog・完成bytes再利用・認証非転送・不完全集約・冪等保存を確認する。実threadの出力をZIPにし、固定receiptで復元して原タグと棋譜を再監査する。開発用の完全集約を正式棋力結果へ変換する入口も拒否する。

```sh
node tools/ai-integration/equal-time-worker.cjs preflight
node --test tools/ai-integration/equal-time-worker.test.cjs
python3 tools/ai-integration/equal-time-worker-unzip.test.py
node tools/ai-integration/verify-equal-time-worker.cjs NEW_DEVELOPMENT_DIRECTORY
```

ローカルNode v24.19.0の初回実thread8局はすべて通常終局（25/35/35/22/34/32/41/47手）、完成shard再利用時の探索0件だった。これは正式登録環境の実測に読み替えない。Actionsの固定Nodeと実行環境・fingerprint・原report digest、既存回帰とmergeの根拠はCI完了後に追記する。

[初回原report](AI_EQUAL_TIME_WORKER_LOCAL_FIRST_20261005.json)と、[ZIP復元を含む2回目の原report](AI_EQUAL_TIME_WORKER_LOCAL_20261005.json)を保存した。2回目も8局が通常終局し（31/30/36/22/34/32/41/47手）、新規thread実行4組・完成組再利用時の探索0件・ZIP復元監査を通過した。runner fingerprintは`ce0cb9f7e7defc9c4b776a95188ca2e55d53eed8d69c755b5eb3e582117894d7`。実時計による開発試走は棋譜が同一になることを要求せず、完成した組の再開時だけ原bytesの一致を要求する。

正式512局は未起動。次工程は成功したCIとmainの一致を確認し、登録環境の受付・手動起動を行い、全結果を保存する。その後に棋力条件を判断し、画面用Worker接続・moto g52j 5G実機・公開AI採用を進める。現在の画面は簡易AIのまま。条件通過も自動で公開採用へ変換しない。
