# v0.10.0：調査018完了・実戦バランス評価の引き継ぎ

更新日：2026年10月19日（Asia/Tokyo）。[AGENTS.md](../AGENTS.md)／[018結果](V010_BALANCE018_RESULTS_20261019.md)／[固定計画](V010_BALANCE018_PLAN_20261018.md)／[起動記録](V010_BALANCE018_LAUNCH_20261019.md)／[manifest](../tools/v010-balance018/manifest.json)／[017結果](V010_BALANCE017_RESULTS_20261018.md)／[旧引き継ぎ](V010_RESEARCH_HANDOFF_20261018_STUDY017.md)。

> 019の着手後の状態は[coverage照合・実装記録](V010_BALANCE019_IMPLEMENTATION_20261019.md)を参照。019の隔離実装と既存記録の索引照合を完了し、312局の運用試走run 39225245641を初回起動した。試走312局は完了・独立監査一致。正式試験は封印後検証中で未起動。以下の018原記録・数値は保持する。

## 範囲と現在地

当面の対象は先後差による実戦上のバランス破綻。初期配置の新規理論解析・局所証明探索は起動しない。公開ルールv0.10.0・標準初期配置・公開AI・旧固定記録は変更しない。

017結果・018計画・018実装はPR #56〜#58、018結果は[PR #59](https://github.com/nkkmd/bao-nakakamado/pull/59)でmainへ統合済み。018結果の統合commitは `251e93c353da856f451a89ae60c29aec3b34ac0f`。統合後は旧全14読取り専用監査・017結果監査・018結果監査の全16チェックが成功した。[統合後監査一覧](v010-balance019/main018-postmerge-audit.json)。正式計測sourceと結果commitは下記のままで、統合commitと混同しない。

2026年10月19日の追加指示により、前回の「統合前まで」を完了した後にmain統合・監査を実施した。次の[019計画](V010_BALANCE019_PLAN_20261019.md)は探索設計段階で、manifest未封印・対局未起動。

## 正式018：完了・保存・独立監査

- [run 39139965350](https://github.com/nkkmd/bao-nakakamado/actions/runs/39139965350)：attempt=1、全66 job成功。10月19日13時37分55秒（日本時間）に集計・保存完了。
- 固定source `80ba721ef8e2377f06931393318ae13104c74bae`、結果commit `6c712782f35f21335d5af12472579ef5e7f4f6d6`、digest `8bd3045b41a2392376a0ae18f84e0173b4f2c19db44689724021045a190f3369`。
- 24セル×64交換組＝1,536組・3,072局。全通常終局、循環・安全停止・400手上限・技術的中断・深度0は0。運用試走48局・017・旧10,240局は正式標本へ合算しない。
- [原ZIP・summary・receipt](v010-balance018/completed/)の3,201原ファイルを固定Git blob・SHA・通常再生・summary byte一致で独立監査した。[receipt](v010-balance018/independent-reaudit.json)。別実装の[Python原集計](v010-balance018/results-analysis.json)も全24セルと一致。新規正式対局・新規証明探索0。
- 結果branch `results/v010-balance-study-018`の旧文書でmainを巻き戻さず、完成原記録のディレクトリのみ同一blobで取り込む。起動記録追記commit・main統合commitを正式sourceと混同しない。

## 解釈と残る問題

実戦全体は**判断保留**。7左の対抗候補は、先攻baseが6／12セル、mobilityが8／12セルで下端25%超を支持したが、どちらも事前の全12相手条件という耐性基準を満たさない。mobility同士は全6セルで先攻全勝。一方、後攻baseが5左を選ぶと、先攻の両方針・全3予算で後攻128勝となる。同方針12セルと異方針12セルを分け、後者の成績を純粋な手番効果と呼ばない。

この結果を7左の全合法継続の敗北証明・対抗策不在・公平の証明にしない。全24セルの勝者は安定したが、23セルは先頭12手が共通で、戦略の多様性は限定される。018には自然開幕の新規対局がなく、残り3初手・12応手は新規確認していない。

[3手目の全合法手の被覆表](v010-balance018/decision-frontier.json)では、7左→5左後に6左・6右が合法だが、018の全条件は6左しか選んでいない。017の同条件screenでも6右は選択されていない。優先候補は未観測の6右と、既存6左からの早い別継続・別防御。通常合法列挙だけを有効対抗策の証明にせず、既存001等の同一状態記録をまず照合し、新しい試験は別ID・別seed・別固定manifestで設計する。新規調査は未固定・未起動。

初期理論値は**UNKNOWN**。主経路15手目直前から後攻52着手以内、016の18手目直前から後攻43着手以内の局所証明、13手目前2／6親、016分割元1／6・0／2を維持。未証明・有限手数反証・予算停止を無期限の結論へ変えない。

## 読取り専用の再現と次工程

```sh
python3 tools/v010-balance018/reaudit.py doc/v010-balance018/completed 6c712782f35f21335d5af12472579ef5e7f4f6d6 80ba721ef8e2377f06931393318ae13104c74bae 39139965350
python3 tools/v010-balance018-results/analyse.py
node tools/v010-balance018-results/frontier.cjs
python3 tools/v010-balance018-results/report.py
git diff --exit-code -- doc/v010-balance018/results-analysis.json doc/v010-balance018/decision-frontier.json doc/V010_BALANCE018_RESULTS_20261019.md
```

Gitの完全履歴を取得する。旧全14監査・017結果監査・新018結果監査を継続し、固定018ソース・計画・manifest・原記録のbytesを変更しない。正式計測入口を監査に呼ばず、未完job・run_attempt>1を自動再計測しない。

次は019計画に従い、既存全記録との正規化coverage照合、実装、小規模運用検証、manifest封印を順に行う。019計画の入力列挙は完了したが、正式対局は未起動。018での失敗から選んだ候補を018自身で独立確認済みにしない。確認試験は別ID・別seedに分ける。

本文 © 2026 nkkmd and Bao Nakakamado contributors、[CC BY-SA 4.0](../LICENSE-CC-BY-SA-4.0.txt)。
