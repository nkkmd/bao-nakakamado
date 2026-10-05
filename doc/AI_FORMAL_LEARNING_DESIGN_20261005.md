# 正式収集v2を使う学習仕様と実装検証

> 本文は当該工程時点の条件と結果の原記録。後続の[正式学習の実行記録](AI_FORMAL_LEARNING_RUN_20261005.md)で学習・validationを完了し線形候補を凍結した。最終評価の開封・公開AI採用は未実施。

作成日：2026年10月5日（日本時間）。出発点：main `1ad2cb64b9d991ce277f28eafccdd69d02e6450f`。対象はBao Nakakamado v0.8.0・棋譜version 7・368bit入力。考案者nkkmd、初公開日2026年9月30日を維持する。

[正式収集v2](AI_FORMAL_COLLECTION_RUN_V2_20261005.md)の後続として、学習器・比較条件・数値基準・再開と手動workflowを実装した。この段階では正式train/validationのZIPを取得せず、正式の誤差・モデル性能を確認していない。既知の開発経路だけで実装を検証した。正式の本学習、最終開封、棋力評価、公開画面への採用は未実施。

## 収集資産と学習への受け渡し

機械可読の固定条件は [formal-learning-spec.json](../tools/ai-integration/formal-learning-spec.json)、ID `NAKAKAMADO-FORMAL-LEARNING-20261005-v1`。収集run 37245789837・attempt 1・head e0fd2d0、dataset artifact 11319211802とZIP digestを固定した。train 5019行・validation 1517行は行列全体のdigestでも照合する。候補計画・除外一覧・元収集ソース・全体監査digestを引き継ぐ。収集コードと原記録を改変して新しい条件に置き換えない。

復元処理はActionsのrun/attempt/head・artifact名/ID/digest/期限とダウンロードZIPのSHA-256を照合する。ZIP内の5ファイル・CRC・パス・展開量を検査し、封印済みfinalの暗号文hashを確認する。学習準備へ書き出すのはtrain・validation・公開summaryの3ファイルだけ。収集鍵は使用せず、final・詳細監査は復号しない。

各行の通常棋譜再生、368bit入力、合法な教師手、深度4完了、target、既存の採用判定を照合する。学習用の正規化行にも原収集行を併記し、再開時に固定の行digestから照合し直す。train/validation間の局面・入力・開幕groupの漏洩を再確認する。

Actionsはprepare→9学習worker→validationと分離する。学習workerへ配るartifactにはtrainだけを入れ、validationは別jobへ渡す。各workerはtrainから両評価観点を作り、反対側のtargetを符号反転する。別splitや独立した行数には数えない。

## 比較する構成と学習条件

| 比較対象 | 固定した構成 |
|---|---|
| 手作り基準 | `NAKAKAMADO-HANDCRAFT-v1` の根局面評価を±1024へclip。教師の深度4評価とは区別 |
| 二値線形 | 368bit入力のridge、lambda 0.01 |
| MLP | 368→32 tanh→1、Adam、150epoch |
| 論理ゲート | 3層×512、各ゲート16真理値表の連続緩和、離散化後にridgeで出力調整 |

batch 64、学習率0.01、float64、PCG64、固定seed 2026100401/02/03を使用する。seedごとにMLPと論理ゲートを作り、線形にも同じ3識別を割り当てる。線形は乱数を使わず、重みは3識別とも同一になる。validationによるearly stoppingやepoch選択は行わない。targetは原仕様の `clip(rawScore/1024,-1,1)`、整数化倍率は4096。

比較するのは実際の整数推論モデルである。線形・論理ゲートは整数重みと真理値表を使う。MLPも重みを整数化し、入力和を1/256刻みの固定tanh表（±8で範囲制限、4096倍率）へ変換する。両観点のclip後の出力差を2で割り、±1024へ切り捨てる。推論時にPythonとJavaScriptの浮動小数点tanhの違いを持ち込まない。通常終局・安全停止を学習モデルへ直接入力せず、将来の探索接続で既存の終局処理を維持する。

元の399固定の後方伝播境界を入力幅から取得するよう変更した。重複するゲート接続の勾配は加算し、有限差分で照合する。元の重みや元ゲームでの採用判断は流用していない。[出典・ライセンス](../LICENSES.md)に適応した元ソース・変更内容・依存を記録した。

## 正式validation前に固定する数値基準

以下は事前に選んだ開発候補の判定基準であり、正式成績から推定した実現性・棋力・実機の合格基準ではない。開発用smokeは実装照合に限定し、正式validationの誤差を見ていない。候補が通過しなければHOLDとし、同じ正式validation/finalの結果を理由に閾値・モデル集合・seed・epochを変更して再選定しない。

| 判定 | 必須条件 |
|---|---|
| 主指標 | 開幕groupごとの行MSEを均等平均し、手作り基準の0.90倍以下 |
| NAMUA・MTAJI | 各phaseのMSEが手作り基準の1.10倍以下 |
| 全12層 | 各層のMAE増加が手作り基準に対して0.05以下。必須層の空集合は不合格 |
| 整数推論 | 正式validation全行のPython/Node不一致0、反対称性が成立 |
| モデル量 | JSON 1 MiB以下、非有限値なし、整数重みは±1,048,576以内 |
| 推論時間 | Actionsの当該workerでwarmup 200回、1000評価×5回の中央値が2000µs以下 |

12層はNAMUA/MTAJI、NORTH/SOUTH、自分/相手の確保分、3個/2個投入、確保分のみ、最後の通常1個、移行付近、有限深度終局線。層は重複し、希少な層の精度を統計的に保証するものではない。主指標は開幕groupを均等に扱い、行数の多い経路だけで選定しない。各層の行数とMAE/MSE、全体MAE/MSEも報告する。

各モデル種の3seedがすべての基準を通過した場合にだけ、その種を候補とする。種間では3seedのgroup MSE中央値が小さい順。同値なら線形→MLP→論理ゲートの固定順。採用するseedは2026100401に固定し、validationで最も良いseedへ差し替えない。条件を満たす種がなければHOLD。比較結果の保存はworkflow成功と区別し、HOLDでも結果を保存する。

validation結果は候補モデルのsha、学習入力digest、ソースfingerprint、run/attempt/head、実行環境とともに固定する。`authorizedToOpenOnce: false` を保持し、開封用gateは作らない。条件通過後も、同時間の探索・最善手集合への所属、既知の戦術、対局・moto g52j 5Gを含む実機を別工程で検証する。2000µsのworker基準だけで実機合格や棋力向上と扱わない。

## 完了単位と再開

checkpointにはparams、Adamのm/v/step、PCG64状態、epoch、次のbatch位置、現在の並び順、固定接続、入力ファイルSHA-256、学習仕様・ソースfingerprint、Python/NumPy/BLAS/CPU/threadの実行環境を保存する。64batchごとと通常の中断時に一時ファイルからrenameする。途中の `.tmp` を完了として使わない。強制停止時は最後に保存した完全なbatchから再開し、その後の未保存の更新を同じ順序で再実行する。

既存checkpointのchecksum、binding、shape、batch位置、step、並び順、非有限値を検査する。実行環境や入力・ソース・条件が異なれば混ぜずに停止する。完全一致の確認は同一環境での再開について行った。異なるCPU/BLAS間のbit一致を保証しない。Actionsの別workerでCPUが変わればこの実装は再開を拒否する。その場合は原因を記録し、同じ固定仕様でfresh runを使う。

別runからは `resume_receipts` にrepository/runId/attempt/headSha/artifactId/name/ZIP digestを具体的に列挙する。対象は固定seedのMLP/logic checkpointだけ。`latest` や同名artifactの自動探索をしない。過去runが失敗・中断でも保存済みartifactのdigestとepoch/batchを照合して利用する。線形は再計算が決定的なのでcheckpointを要求しない。再開は新しい手動runで行い、前runの記録を上書きしない。

## この段階の検証

既存の閲覧済みパイロット経路 `random/700000` と `greedy/700001` から32進行中局面を使った。正式なtrain/validation/finalを使用しない。これは以前の開発除外一覧に属する経路であり、今回のsmoke結果を正式評価の成績へ混ぜない。

| 確認 | ローカル結果 |
|---|---:|
| 新規Nodeテスト | 8/8 |
| 新規Python数値・再開テスト | 6/6 |
| 新規ZIP境界テスト | 3/3 |
| 既存の規則・探索・収集・画面テスト | 89/89 |
| Pythonの独立入力照合 | 64観点、不一致0 |
| 整数化した9候補のPython/Node評価 | 288件、不一致0 |
| 反対称性・南北交換 | 576件、不一致0 |
| MLP/logicの3seed×2種の途中再開 | 6候補すべてparams・Adam・出力完全一致 |
| 小幅論理ゲートの有限差分 | 多重接続・入力幅境界を含め通過 |

smokeは2epoch・batch 8、モデル幅は本番と同じ368→32、3×512。正式の150epochの完了を確認したものではない。[ローカル検証記録](AI_FORMAL_LEARNING_LOCAL_20261005.json)に実行環境とfingerprintを保存する。

実装head `73f0fe8bf2e3aa638fe7edfee679fa1bf1a85aff` の[学習用CI run 37251558704](https://github.com/nkkmd/bao-nakakamado/actions/runs/37251558704)（attempt 1）は17テストと同じ32局面のsmokeを通過した。学習fingerprint `c678948ee4ee46d99cc2ad19fce1012377b422453940ea1781e574b40feb5290` はローカルと一致した。Python 3.12.14・NumPy 2.3.5で整数評価288件・対称性576件・再開6候補が一致し、正式行の読込み0件・final未開封を確認した。

同じheadの[既存CI run 37251558645](https://github.com/nkkmd/bao-nakakamado/actions/runs/37251558645)（attempt 1）も全8ジョブ成功。89テスト、実ブラウザー、探索・遷移照合、開発用教師試走・固定artifact再開・元の候補計画の再構築を通過した。計画digest・収集ソースdigestは元の正式収集v2と一致する。[CI記録](AI_FORMAL_LEARNING_CI_20261005.json)に対象head・job・artifact ID/digest・実行環境を固定する。この後の記録追加で実装fingerprintが変わらないことも照合する。

## 次の順序

変更をPRで確認し、CI通過を記録する。mainに統合した学習仕様・コード・workflowのcommitを固定してから、手動 [formal-learning.yml](../.github/workflows/formal-learning.yml) を新規 `resume_receipts: []` で起動する。元datasetの期限は2026年11月4日09:05:21 JST。今回、正式ZIPの別環境への保存・復元が完了したとは記録しない。

本学習後は9候補の固定条件によるvalidation報告を保存する。通過候補だけを凍結し、最終開封の条件・一度だけの運用を別途整備する。正式最終評価を開発に逆流させない。その後に探索接続・同時間対局・実機確認へ進む。

説明文はCC BY-SA 4.0、コード・設定・保護対象の機械可読記録はMIT。[出典と利用条件](../LICENSES.md)を維持する。
