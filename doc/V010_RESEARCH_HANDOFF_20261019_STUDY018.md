# v0.10.0：実戦バランス評価・調査018の引き継ぎ

記録日：2026年10月19日（Asia/Tokyo）。[AGENTS.md](../AGENTS.md)／[017結果](V010_BALANCE017_RESULTS_20261018.md)／[旧引き継ぎ](V010_RESEARCH_HANDOFF_20261018_STUDY017.md)／[018固定計画](V010_BALANCE018_PLAN_20261018.md)／[起動記録](V010_BALANCE018_LAUNCH_20261019.md)／[PR #58](https://github.com/nkkmd/bao-nakakamado/pull/58)。

## 研究の対象と現在地

ユーザーの指示により、当面は「先後差による実戦上のゲームバランス破綻」の評価に絞る。初期配置の新規理論解析・局所証明探索は起動しない。既存の理論値UNKNOWN・主経路15手目直前の後攻52着手以内・016の18手目直前の後攻43着手以内の証明、13手目前2／6親・016分割元1／6および0／2は保持する。

017結果は[PR #56](https://github.com/nkkmd/bao-nakakamado/pull/56)、計画は[PR #57](https://github.com/nkkmd/bao-nakakamado/pull/57)でmain統合済み（最新基準 `e5180b02cc18d560e602f978f9c2d82d2e0561e2`）。各統合後の全15監査も成功した。実戦上の破綻は判断保留。自然6条件は先攻全勝1・後攻全勝5だが方向が頑健でなく、強制全14開幕で多数勝者が条件依存、7左に対抗候補が残る。公平・破綻不在の証明ではない。

018は7左・全2応手に、先後各base／mobilityの4組合せと3探索量を適用する。主比較の同方針12セルと、相手方針変更の診断12セルを分ける。異方針の成績を純粋な手番効果と呼ばず、強制開幕を自然対局へ合算しない。64交換組の24セル同時95%区間で、75%超／25%未満の警報と、先攻同一方針が全12相手条件で下端25%超となる対抗候補を分ける。許容幅40〜60%の確認試験ではない。018の成否だけで全体の公平・破綻を断定しない。

## 完了・未完了

- 実装・低予算の役割固定／正常再生／改ざん・未完拒否／完成bytes再利用のテストを完了。
- 24条件48局の運用試走と保存、独立再監査を完了。全局通常終局、深度0なし。正式標本には数えない。
- [manifest](../tools/v010-balance018/manifest.json)を封印。digest `8bd3045b41a2392376a0ae18f84e0173b4f2c19db44689724021045a190f3369`。計画件数3,072局・予算・閾値は変更していない。
- **正式試験は実行中。** source `80ba721ef8e2377f06931393318ae13104c74bae`、[run 39139965350](https://github.com/nkkmd/bao-nakakamado/actions/runs/39139965350)、初回attemptでpreflight成功・4分割開始を確認。全3,072局の結果はまだない。結果branchは `results/v010-balance-study-018`。正式sourceと起動記録追記commitを区別する。

## 再開・保存・監査

1. 最新main・PR #58・起動記録・固定sourceを照合する。途中経過のmain統合を正式試験完了と混同しない。
2. 原記録・開始marker・receiptを監査して再利用する。正式計測入口は監査に呼ばず、未完job・attemptの自動再計測をしない。
3. 試走の読取り専用再検証は `node tools/v010-balance018/pilot.cjs verify doc/v010-balance018/pilot`。Gitの完全履歴を取得し、元source commitから全fingerprintを照合する。`node tools/v010-balance018/freeze.cjs` は既存sealとの一致確認のみ。
4. 正式完了後は原ZIP・summary・receiptを保存し、`python3 tools/v010-balance018/reaudit.py doc/v010-balance018/completed <resultsCommit> <sourceSHA> <runID>` で全原bytesと通常再生・summary一致を確認する。別実装による統計の独立集計と、24セル・対応seed・停止・重複・分岐時点の分析を行う。
5. 試走・017・旧10,240局を正式018の標本へ混ぜず、未終局は最悪割当区間と件数を保持する。通常勝利・循環・安全停止・400手上限・中断を区別する。
6. 全セルの結果が揃ってから、7左が指定相手集合でも対抗候補として残るかを報告する。崩れても別初手・途中の別合法抵抗がない証明とはしない。後続は自然開幕から対抗策を選べるか、または早い分岐の全合法抵抗screenを別ID・別seed・別固定計画で扱う。
7. 原記録・summary・receipt・独立監査を保存し、報告・索引・引き継ぎを更新してPR・統合後監査へ進む。旧全14監査と017結果監査を維持する。

本文 © 2026 nkkmd and Bao Nakakamado contributors、[CC BY-SA 4.0](../LICENSE-CC-BY-SA-4.0.txt)。
