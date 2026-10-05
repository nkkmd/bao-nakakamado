# 正式同時間比較v2：全512局の完了と棋力判定

2026年10月5日（日本時間）。説明文はCC BY-SA 4.0、コード・JSON・原成果はMIT。Bao Nakakamado v0.8.0・棋譜7、考案者nkkmd・初公開日2026年9月30日を維持する。

固定線形seed 2026100401と手作り評価器を、共通探索core・各手150ms・独立開幕256組の先後交換512局で比較した。全512局が通常終局し、モデル311勝・手作り評価器201勝。事前固定した全5条件が通過し、判定は `STRENGTH-GATE-PASS-NOT-PUBLIC-ADOPTION`。この開幕分布・探索条件での比較結果であり、最善プレイや元ゲームのAI-GEN4との同等性、公開採用の証明ではない。

## 固定条件と再開

[固定条件](equal-time-formal-v2/contract.json)と[worker](AI_EQUAL_TIME_WORKER_20261005.md)を維持した。main `6d3d779d630132ff977d1c301ade56da960b4b63`、worker fingerprint `ce0cb9f7e7defc9c4b776a95188ca2e55d53eed8d69c755b5eb3e582117894d7`、session tag SHA `4b464569a1e53a8e656611661df1e08c8bde14e0`。モデルSHA-256は `f74175fbaa6f2d6a82148cf5e106da7291f396b2b38cb79866dc641b2147254d`。モデル・教師・学習・正式final・主要指標・CPU許可一覧・局数・開幕・時間予算を変更しなかった。正式finalの再取得・再開封は0件。

| 実行 | 日本時間 | 新規実測 | Actions状態 |
| --- | --- | ---: | --- |
| [37307084139](https://github.com/nkkmd/bao-nakakamado/actions/runs/37307084139) | 21:04:55–21:16:49 | 20分割・320局 | 未登録CPUの探索前停止、部分集約HOLD |
| [37309702988](https://github.com/nkkmd/bao-nakakamado/actions/runs/37309702988) | 21:27:52–21:37:32 | 9分割・144局 | 未登録CPUの探索前停止、部分集約HOLD |
| [37317410478](https://github.com/nkkmd/bao-nakakamado/actions/runs/37317410478) | 22:31:03–22:37:53 | 分割0・24・26の48局 | 完成成果の一部carrierも未登録CPUで停止、部分集約HOLD |

すべてmain・workflow_dispatch・attempt 1、同じsessionの受付／resumeで、Re-run jobsは使用していない。前チャットのブラウザー審査容量エラー後、ユーザーの継続指示に基づき29原receiptを指定して第3runを起動した。完成局の再測定・中断組・未封印leaseは0件。全32分割はgeneration 0、8組ずつCOMPLETE、activeなし・pendingなし、sealあり。

## 複数runの原成果監査

workerは現在hostのCPU確認を完成成果のコピーより前に行うため、後続runのcarrier artifactが全32個揃わないことがある。第3runのcurrent-run集約は22分割・errors 0・棋力未集計のHOLDだった。このFailureをworkflow成功へ変更しない。

全対局の集計前に固定された[読取り専用集約手順](equal-time-strength-v2/RECOVERY_20261005.md)（commit `816d006d9b6eac444663f0b2666e46965b75ee8e`）を適用した。各分割の最初の実測・封印済み原ZIPを固定し、全32原receipt、run/attempt/head、artifact ID/name/digest/bytes、原session・lease・sealのGitHub現在値を照合した。既存の安全展開・`auditDirectory` と、変更していない `aggregate` で全256組512棋譜を通常遷移と探索遷移から再生し、固定開幕・担当順・合法手・64 KETE・各手hash・勝敗・checksum・実測環境を監査した。監査hostのNode v24.19.0は読取り専用で探索を行わず、実測hostのNode v24.21.0を偽装していない。

原ZIP32個・原metadata・receipt・session・監査結果・集約報告を [equal-time-strength-v2/](equal-time-strength-v2/) に保存した。元の20分割、9分割、3分割の出所を保持し、後続carrierへ置き換えない。過去の464局時点の保存branchと各runの部分reportも保持する。

再監査：`node doc/equal-time-strength-v2/audit-public-records.cjs doc/equal-time-strength-v2`。監査コードは旧読取り専用入口と同じbytesで、原JSONを展開・再生する。保存metadataは取得時点の原値。独立したPython標準ライブラリによるZIP内勝敗集計でも311対201、全256pair indexの重複なし、全局通常終局、固定下限の再計算が一致した。新規探索0件、正式final行参照0件。

## 結果と事前固定判定

| 指標 | 固定基準 | 結果 |
| --- | --- | --- |
| 固定日程の完了 | 256組512局 | 全件完了 |
| 技術的失敗 | 0件 | 0件 |
| 通常終局率 | 95%以上 | 100%（512局） |
| 未決着を敗北扱いした保守的平均 | 55%以上 | 60.7421875% |
| ペア単位の条件付きHoeffding下限（alpha 0.05） | 50%超 | 53.09297865412245% |

モデルが2局とも勝った組77、1勝1敗157、2敗22。未決着・反復・手数上限・対局の安全停止は0件。条件付き下限は256開幕ペアを単位とした固定式で、全Bao局面に対する一般的な勝率の信頼区間として扱わない。[原集約報告](equal-time-strength-v2/report.json)に全数値と固定判定を保存する。

| 実時計指標 | 線形モデル | 手作り評価器 |
| --- | ---: | ---: |
| 着手数 | 8,205 | 8,150 |
| 完了深度の中央値 | 7 | 6 |
| 各手応答P99 | 150.465ms | 150.396ms |
| 最大各手応答 | 152.167ms | 151.872ms |
| 代替手 | 0 | 0 |

対局時間P95は7.665秒、最大11.544秒。探索内の安全停止検出はモデル236・基準85で、対局自体の停止とは区別する。Actionsの登録CPU環境での測定であり、スマートフォンの速度には読み替えない。

## 次工程

同時間棋力基準の通過を根拠に、要求ID・局面照合・取消し・古い応答の破棄・返却手の再検証を備えた画面用Web Worker接続へ進む。難易度の予算と連続対局・取消し・棋譜互換を確認し、moto g52j 5Gで実機検証する。公開AIの採用・配信用ZIP・サイト公開は未実施で、現画面の簡易方式をこの結果だけで差し替えたとは記録しない。
