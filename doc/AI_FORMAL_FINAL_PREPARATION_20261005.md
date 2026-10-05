# 凍結候補の最終評価条件と一度だけの開封準備

2026年10月5日（日本時間）。対象はBao Nakakamado v0.8.0・棋譜version 7・368bit入力。考案者nkkmd、初公開日2026年9月30日を維持する。出発点はmain `bf5b633dbd347f0c13516c16843ca0002150bebb`。

[正式学習・validation](AI_FORMAL_LEARNING_RUN_20261005.md)で選定した線形seed 2026100401について、最終評価の条件と中断時の運用を固定した。**この工程は準備であり、正式finalは未開封、開封受付タグも未作成**。`authorizedToOpenOnce: false` を維持する。正式データの取得・復号や、実際に開封するworkflowの導入・起動は行っていない。

## 対象と変更しない条件

機械可読の契約は [formal-final-spec.json](../tools/ai-integration/formal-final-spec.json)、ID `NAKAKAMADO-FORMAL-FINAL-20261005-v1`。最終評価の成績を見ずに固定した。モデル比較をやり直さず、線形・seed 2026100401だけを評価する。MLP・論理ゲートの追加評価、最良seedへの交換、同じfinalを使う再学習・閾値調整は行わない。

| 固定する対象 | 識別 |
|---|---|
| モデルSHA-256 | `f74175fbaa6f2d6a82148cf5e106da7291f396b2b38cb79866dc641b2147254d` |
| 元学習run / attempt | 37257277028 / 1 |
| 学習head | `4c7f3e3132dc191a2eaabe3f41ee43bc22c9ddb8` |
| 学習fingerprint | `872a4690be9cd686ace800052e01b4afda5488c2cae60fb41cbc458a2958045c` |
| 元収集run / attempt / artifact | 37245789837 / 1 / 11319211802 |
| final行digest | `1750a34d21bcc824133b23647033317fbcb7894cdac70625c0c45b6622ec2a03` |
| final暗号文SHA-256 | `ad4fd4dfda9699841159953607047c40d9c59831e8b26ed619f02ff76fa210a8` |

元の学習・収集仕様、元run、モデル・学習記録・validation報告のbytesとdigestは変更しない。新しい準備コードのfingerprintを別に持つ。preflightは公開summaryと凍結ファイル、9候補の保存済みvalidation判定・選定を照合する。正式局面の原データは読み込まない。

## 最終評価の合否条件

数値条件は、**正式validation前に固定した既存基準をそのまま引き継ぐ**。validationの約65%の誤差低減を理由に、最終評価の閾値を新設・変更しない。

| 判定 | 必須条件 |
|---|---|
| 主指標 | 開幕groupごとの行MSEを均等平均し、同じfinal上の手作り基準の0.90倍以下 |
| NAMUA・MTAJI | 各phaseのMSEが同じfinal上の手作り基準の1.10倍以下 |
| 12層 | 各層のMAEが基準のMAE＋0.05以下。必須層が空ならHOLD |
| 整数推論 | 全行のPython／JavaScript出力不一致0。各実局面の反対側評価が符号反転し、0は0 |
| モデル量 | 凍結JSONが1 MiB以下。非有限値なし、整数重みは±1,048,576以内 |
| 推論時間 | 当該Actions workerでwarmup 200回、1000評価×5回の中央値が2000 µs以下 |
| 元収集の必要件数 | 512行以上・16開幕group以上、元のfinal最低層件数を満たす |
| 原データの一致 | 元行digest、通常棋譜再生、368bit入力、教師手・深度4・quiescence深度1・targetが一致 |

12層はNAMUA、MTAJI、NORTH、SOUTH、自分の確保分、相手の確保分、3個投入、2個投入、確保分のみ、最後の通常1個、移行付近、有限深度終局線。層の件数・MAE・MSE、全体MAE・MSE・group MSEを保存する。希少層の件数が少ないことを、統計的な精度保証へ読み替えない。

実装は既存の整数評価器・指標・18判定を再利用する。最終評価ではその1モデルのPython照合・実局面の反対称性・時間測定を行うworkerへ接続する必要がある。今回、そのworkerは導入していない。今回の開発smokeの32件は正式finalの評価件数ではない。

全条件通過時は `FINAL-TEACHER-REPRODUCTION-PASS-NOT-PUBLIC-ADOPTION`。数値条件の不合格は `HOLD-NO-RETUNING-ON-THIS-FINAL`。データ整合性や反対称性を検証できない場合もHOLDとして理由を残す。これは教師評価の再現性の判断であり、勝率・棋力・実機速度・公開AI採用の判断ではない。

## 一度だけの受付と中断時の扱い

旧 `formal-collection.cjs open` は、復号後に作業ディレクトリへ `final-opened.json` を作る。別のrunnerや新しいディレクトリにはその記録がなく、リポジトリ全体の重複を防げない。収集ソースdigestを維持するため旧ファイルは改変せず、正式な新工程では直接呼ばない。

新しい [formal-final.cjs](../tools/ai-integration/formal-final.cjs) は、GitHubの注釈付きタグとrefを受付記録に使うライブラリを追加した。タグオブジェクトを作っただけでは受付成立とせず、固定名refの新規作成が201で成功し、そのSHAを再読込で確認した場合だけ復号へ進む。更新・削除・失敗時の自動再試行は実装しない。APIの仕様はGitHub公式の [refs](https://docs.github.com/en/rest/git/refs?apiVersion=2022-11-28) と [tags](https://docs.github.com/en/rest/git/tags?apiVersion=2022-11-28) に従う。

受付refはfinal行digestから決める。run番号・モデル・新しい仕様IDで名前を変え、同じfinalを再び開ける設計にはしない。承認記録は対象commit、準備fingerprint、モデルSHA、final行digest、run/attempt/head、JSTの固定日時を結び付ける。attempt 2以降は拒否する。`authorizedToOpenOnce: true` という値だけを渡して別モデル・別commitを開くことはできない。

| 状況 | 許可する操作 |
|---|---|
| 受付前のpreflightが失敗 | 原因を記録。finalには触れず、整合性を修正して確認 |
| 受付refの不存在を確認できない | 復号前に停止 |
| 同時に二つのrunnerが受付を試みる | ref作成に成功した一方だけ進む。他方は停止 |
| 受付refがすでに存在する | 新しいworkspaceやrunでも停止。既存記録の確認だけ行う |
| ref作成後に応答を失う・復号失敗・強制停止 | 受付を保持し、開封の有無が不明でもHOLD。再開封しない |
| 評価が完了し、結果の保存が失敗 | 同じworkerで残っている結果の保存を試みる。復号・評価のやり直しはしない |
| 結果・receiptが保存済み | 記録したdigestを照合して読み直す。再開封しない |

保証するのは、自動経路による**最大1回の復号への進行**である。通信断・強制停止が起きても必ず1回の評価が完了するという保証はできない。管理者によるタグ削除や旧CLIの直接実行も防止する仕組みではない。受付タグは削除・付け替え禁止として運用し、実際の手動workflowを接続する工程で権限と保存経路を検証する。

ライブラリの `runOnce` は受付→復号callback→評価callback→保存callbackの順序を固定した。現在は開発用callbackだけでテストしており、正式な復号callback・開封workflow・承認記録は導入していない。既存のCIと学習workflowへ収集鍵を追加しない。正式finalの平文を成果artifactや通常ログへ保存しない。

## 今回の検証と次の順序

ローカルでは新規12テストが通過した。同時競合・既存受付・ref作成後の応答消失・権限エラー・復号失敗・結果保存失敗・候補とoriginの差替え・attempt 2・希少層の欠落を確認した。既存学習テスト9件との合計21件も通過した。すべて偽のAPIと開発payloadを使い、GitHubに正式受付を作成していない。

凍結線形モデルの推論smokeには、既知の除外対象 `random/700000` と `greedy/700001` から32進行中局面を使用した。Python／JavaScript出力32件・反対称性32件が一致し、正式行読込み0・最終開封なしを確認した。[ローカル検証JSON](AI_FORMAL_FINAL_LOCAL_20261005.json)に保存する。

新しい [formal-final-check.yml](../.github/workflows/formal-final-check.yml) は読取り権限だけで、preflight・偽APIテスト・開発用推論smokeを実行する。収集鍵・受付タグの作成・開封の手動起動を含まない。GitHub CIの結果は [CI記録](AI_FORMAL_FINAL_CI_20261005.json) に対象head・run・attempt・job・artifactの識別情報とともに保存した。

PR [#20](https://github.com/nkkmd/bao-nakakamado/pull/20) のhead `6f6a8c5afa637f7d5de753387b118015c4eed5a4` で、[準備用CI run 37261069975](https://github.com/nkkmd/bao-nakakamado/actions/runs/37261069975)（attempt 1）と [既存CI run 37261069985](https://github.com/nkkmd/bao-nakakamado/actions/runs/37261069985)（attempt 1）が成功した。準備用CIは12テスト・整数出力32件・反対称性32件の一致、正式行読込み0件・未開封を確認した。既存CIは全8ジョブが成功し、規則・探索・通常遷移・実ブラウザー・候補計画の再構築・固定artifact復元を通過した。ローカルとCIの準備fingerprint `9049d1e84028a67932003b8daaf5d40df9f901f7528471dcf323ed74686a12bf` は一致した。

CI通過後、2026年10月5日12:54:14 JSTにmainへ統合した。merge commitは `fa6767886589a03742514d917143cfca034d2794`。統合後のpreflightも通過し、元収集・学習fingerprint、モデルと原記録のbytes、未開封状態を維持した。

次は、この契約と検証済みライブラリへ、固定artifactの復元・封印照合・正式復号・1候補の整数照合・判定報告の保存を行う手動workerを接続する。実装のCIとmain統合を確認し、そのcommitとrunを固定した承認記録を作ってから正式finalを開く。受付記録・結果・出典はActionsの30日期限だけに依存せず保存する。元datasetの期限は2026年11月4日09:05:21 JSTで、別保管が完了したとは記録しない。

最終評価後に、終局と安全停止を維持して探索接続・同時間対局・最善手集合・既知戦術・moto g52j 5Gを含む実機を確認する。公開画面のコンピューターは引き続き簡易方式であり、今回の準備では変更しない。

説明文はCC BY-SA 4.0。コード・設定・保護対象の機械可読記録はMIT。[出典と利用条件](../LICENSES.md)を維持する。
