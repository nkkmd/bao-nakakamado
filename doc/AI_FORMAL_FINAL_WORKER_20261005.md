# 凍結候補の最終評価workerと公開報告の永続保存

2026年10月5日（日本時間）。Bao Nakakamado v0.8.0・棋譜version 7。考案者nkkmd、初公開日2026年9月30日を維持する。出発点はmain `20647b4730878e4e36850060d32e1e024ccc149f`。

[開封前の固定条件](AI_FORMAL_FINAL_PREPARATION_20261005.md)を変更せず、正式評価を一度だけ実行する手動workerと、公開報告をGitへ保存する経路を実装した。この文書の実装・開発検証時点では正式finalは未開封。実際の実行と判定は後続の実行記録を参照する。

## 固定条件の維持と手動起動

[formal-final.yml](../.github/workflows/formal-final.yml) は `workflow_dispatch` だけで起動する。main・元リポジトリ・attempt 1だけを受け付ける。収集・学習・旧準備の仕様ファイル、凍結モデル・学習記録・validation報告のbytes、主指標0.90倍・phase 1.10倍・12層MAE＋0.05・整数一致・モデル量・推論時間の18条件を変更していない。モデル種・seedを選ぶ入力は用意しない。

起動時に、CI通過・main統合後のcommit SHA、[runner](../tools/ai-integration/formal-final-runner.cjs)のfingerprint、`OPEN-FROZEN-FINAL-ONCE` を具体的に指定する。commitはActionsの実際の `GITHUB_SHA` と一致する必要がある。入力文字列はshellのrun本文へ展開せず、envを通してNodeで照合する。

新しいfingerprintは、旧準備fingerprintとworker・ZIP復元コード・手動workflowのSHA-256を結び付ける。旧準備仕様の `authorizedToOpenOnce: false` と `liveWorkflowInstalled: false` は当時の原記録として維持する。現在の正式起動意思は、固定commit・実run/attempt/head・fingerprintを結び付けた別のauthorization記録で表す。旧receiptをtrueへ書き換えない。

## 復元・受付・評価の順序

1. 元の選定・bytes・数値条件・originをpreflightで照合し、手動起動のcommit・fingerprint・attempt、Python 3.12.14・NumPy 2.3.5・Node 24を確認する。
2. 固定した収集run 37245789837、attempt 1、dataset artifact 11319211802のhead・完了状態・期限・ZIP digestを照合する。
3. ZIP内の全5ファイル・CRC・展開量・パス・暗号文SHAを確認する。[専用ZIP処理](../tools/ai-integration/formal-final-unzip.py)で書き出すのは公開summaryと暗号化finalだけ。train・validation・詳細監査は書き出さない。
4. GitHubに固定名の開封受付refを新規作成し、作成成功とSHAの再読込みを確認する。受付refはfinal行digestから決まり、別runや別候補で名前を変えない。
5. 受付確認後だけ、既存secret `BAO_COLLECTION_KEY_BASE64` を使ってメモリ上で1回復号する。plan/audit bindingとfinal行digestを照合し、全行の通常再生・入力・教師ラベル・最低件数・層を確認する。
6. 凍結した線形seed 2026100401だけでPython／JavaScriptの整数出力・実局面の反対称性・集計誤差・推論時間・18条件を確認する。教師要求・再学習・再選定は行わない。
7. 公開authorization・claim・集計reportをローカルへ保存し、専用結果ブランチへ永続保存する。Actionsには公開JSONだけを保存する。

正式finalの平文ファイルや行ごとの予測は書き出さない。独立Python照合に必要な二値入力だけをprivateな一時ファイルへ渡し、評価後に削除する。privateなZIP・暗号文・一時入力は成功・失敗のどちらでも削除し、artifactの対象に含めない。鍵はコード・ファイル・ログ・artifactへ含めず、使用後の鍵Bufferを消去する。

## 判定と保存

全条件通過時の判定は `FINAL-TEACHER-REPRODUCTION-PASS-NOT-PUBLIC-ADOPTION`。数値不合格は `HOLD-NO-RETUNING-ON-THIS-FINAL`。受付後の復号・原データ検証・整数評価の例外は、秘匿payloadを含まないstage名だけを記録した `HOLD-FINAL-EXECUTION-ERROR` とする。数値HOLDでも報告保存を完了させる。実行例外では保存後もworkflowを失敗にし、数値判定と実行の成否を区別する。

永続保存先は `nyakua-final-result-1750a34d21bcc824133b23647033317fbcb7894cdac70625c0c45b6622ec2a03` ブランチの `doc/formal-final/{authorization,claim,report}.json`。固定した実行commitを親に、公開JSON3ファイルだけを追加する。workerはmainと受付タグを更新・削除しない。

公開reportは全体・開幕group・12層の集計と全18判定、モデルSHA、入力元digest、run/attempt/head、環境、受付SHA、未採用状態を持つ。保存処理は許可したschemaだけを受け付け、未知の項目・局面・入力・target・鍵の混入を拒否する。受付タグの内容と対象commitを読んで、authorizationとの一致を確認してから保存する。

保存refの作成応答を失っても、既存ブランチの3ファイルのGit blob SHAを照合する。同一bytesなら保存済みと扱う。既存結果が違えば上書きせず停止する。結果の再保存は読込み・Git保存だけで、復号・推論を含まない。

```sh
node tools/ai-integration/formal-final-runner.cjs preflight
# PUBLIC_RECORD_DIRECTORYには、digestとoriginを確認した元の公開JSON3ファイルだけを置く。
node tools/ai-integration/formal-final-runner.cjs publish PUBLIC_RECORD_DIRECTORY
```

受付後にrunnerが強制停止して結果が残らない場合はHOLDとし、runの再実行・受付削除・新しいrunによる再開封を行わない。artifactが残る保存障害では、その固定run/attempt/head・artifact ID/ZIP digestを照合した公開報告の再保存だけを行う。Actionsから取得したというだけで、別runの報告と混ぜない。

## 開発検証

新しいworkerの10テストと既存の受付12・学習9テスト、合計Node 31件が通過した。ZIP境界4テストは、出力2ファイル限定・既存出力・差替えdigest・重複・symlink・パス逸脱・CRC破損を人工ZIPで確認した。APIテストは偽のGitデータベースだけを使う。

[開発worker検証](../tools/ai-integration/verify-formal-final-worker.cjs)は、除外済みの `random/700000`・`greedy/700001` の32局面を、開発専用の使い捨て鍵・bindingで暗号化し、受付→復号→固定モデル評価→公開集計を確認した。復号1回・保存1回・2回目の開封拒否、Python／JavaScript32件不一致0・反対称性32件一致、18条件の適用、一時入力削除を確認した。正式行読込み0件で、正式finalは開いていない。ここでのtargetは開発用の手作り根評価であり、正式教師の深度4ラベルや最終成績へ混ぜない。

[ローカル検証JSON](AI_FORMAL_FINAL_WORKER_LOCAL_20261005.json)を保存する。[読取り専用CI](../.github/workflows/formal-final-check.yml)も同じテスト・smokeを実行し、鍵・正式ZIP・Gitへの受付や結果書込みを使用しない。新しい第三者依存は追加していない。

CIと関連文書の整合を確認してmainへ統合し、そのcommit・fingerprintから手動workflowを一度起動する。完了後は公開結果と受付を照合し、永続ブランチの原JSONと実行記録をmainへ保存する。最終評価の結果を根拠に同じfinalで条件を調整しない。棋力・同時間探索・実機・公開画面への採用は後続工程である。

## この工程の完了状態

PR [#21](https://github.com/nkkmd/bao-nakakamado/pull/21) のhead `7fd24da50647e9f4e6eaad1d950b85c8da9469ff` で、[準備用CI 37265060257](https://github.com/nkkmd/bao-nakakamado/actions/runs/37265060257)（attempt 1）と [既存CI 37265060279](https://github.com/nkkmd/bao-nakakamado/actions/runs/37265060279)（attempt 1）が成功した。準備用CIはNode 22テスト・人工ZIP 4テスト・開発workerの32件整数一致と反対称性、復号1回・2回目拒否を通過した。既存CIも全8ジョブが成功した。ローカルとCIのrunner fingerprintは `8f22d999872964b2e4ed692202ca78f2b0aaa2b447f26f5b15831c38a15bf746` で一致した。詳細は [CI記録](AI_FORMAL_FINAL_WORKER_CI_20261005.json) を参照する。

2026年10月5日13:50:41 JSTにmainへ統合した。merge commitは `24759ec1874a4c92412e68ac372d5ccb6ce2761a`。元の収集artifactは未失効でID・ZIP digestが一致した。mainへ統合後のpreflightも通過した。

ブラウザーでmain・固定commit・fingerprint・`OPEN-FROZEN-FINAL-ONCE` を入力したが、起動のクリックは自動承認審査に拒否された。理由は、暗号化された正式データを一度だけ開封する不可逆な外部操作について、具体的な明示承認を確認できないこと。別経路から起動しない。拒否後、固定headの手動runが0件、受付タグが未作成であることをGitHub APIで照合した。**正式workflowは未起動、正式finalは未開封**。

実装・検証・main統合・証拠保存は完了し、残るのは具体的な一度限りの開封・起動への承認である。承認後は当時のmain commitと同じrunner fingerprintを入力し、正式評価を一度だけ起動する。保存済みの拒否時headを、結果保存用の文書commit追加後のmain headへ誤って流用しない。

説明文はCC BY-SA 4.0。コード・設定・保護対象の機械可読記録はMIT。[出典と利用条件](../LICENSES.md)を維持する。
