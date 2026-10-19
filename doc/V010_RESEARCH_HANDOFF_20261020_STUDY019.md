# v0.10.0：調査019完了・main統合前の引き継ぎ

更新日：2026年10月20日（Asia/Tokyo）。[AGENTS.md](../AGENTS.md)／[019結果](V010_BALANCE019_RESULTS_20261020.md)／[固定計画](V010_BALANCE019_PLAN_20261019.md)／[起動記録](V010_BALANCE019_LAUNCH_20261019.md)／[manifest](../tools/v010-balance019/manifest.json)／[旧018引き継ぎ](V010_RESEARCH_HANDOFF_20261019_STUDY018.md)。

## 現在地と停止位置

対象は先後差による実戦上のゲームバランス破綻。**実戦全体は判断保留、初期配置の理論値は未確定（UNKNOWN）**を別に報告する。公開ルールv0.10.0・標準初期配置・公開AI・旧原記録は変更しない。新しい理論解析・局所証明は起動しない。

調査019の対局・保存・固定原記録の独立再監査・別実装集計・敗局frontier・報告整理が完了。結果は[PR #61](https://github.com/nkkmd/bao-nakakamado/pull/61)で確認する。ユーザーの2026年10月20日の指示により**main統合前で停止する**。mainはPR #60統合commit `57c7936a5c8d6e80f3979571ae9aa9b3c29e88fa`、019は未統合。CI・レビューの最終状態はGitHubを参照し、未確認を成功と記録しない。

## 正式sourceと原記録

- [run 39241595646](https://github.com/nkkmd/bao-nakakamado/actions/runs/39241595646)、attempt=1、全54 job成功。
- source `bf6e7724b663c2918866b5c9637f6547efe7e484`、結果commit `5015ee1f968a3ced31a83648524b9ac0132e3369`。
- digest `1a517eaa5475b2c9ec8fe3eef9b51b64e580fd5f76d61e98e642308747e8231d`。
- 原1,353ファイルの[ZIP・summary・receipt](v010-balance019/completed/)を同一Git blobで保存。全原SHA・通常エンジン全局再生・再生成summary byte一致。[独立監査](v010-balance019/independent-reaudit.json)。
- 別実装[Python原集計](v010-balance019/results-analysis.json)は全156セル、勝敗・停止・seed交換対応・深度・訪問量・重複・同時区間・探索候補判定で一致。新規対局・証明探索0。
- 全624交換組・1,248局が通常終局。未終局・循環・安全停止・手数上限・深度0は0。試走312局・旧研究を正式成績に合算しない。
- 集計・保存job完了は10月20日1時23分51秒（日本時間）。前回チャットで示した1時39分45秒はAPI run更新時刻であり、完了時刻とは区別する。実測全job合計約20.97 runner時間。

## 分かったことと残る問題

共通prefix7左→5左の後、6左／6右を強制した2根、さらに後攻全5＋6応手を強制した11根を別集計した。同方針78セルと異方針78セルも分離する。

6右でも先攻勝利を観測した。3手まで強制した同方針では2,048は両方後攻全勝、8,192／32,768は両方先攻全勝だが、M→Bは全3予算で後攻全勝。6左／6右×先攻base／mobilityの4固定候補すべてに0勝セルが残り、事前の全条件で1交換組以上の先攻勝利という探索上の優先基準は不成立。対抗策不存在・必敗・全体の破綻の証明ではない。

固有seedは4個を全条件で共有した。交換2局・条件間の共有seedを独立標本として数えない。156セル同時区間は全セル0〜100%となり、有効性の確認試験ではない。140セルは先頭12手が1種類で、開幕多様性も限定される。

[敗局frontier](v010-balance019/loss-frontier.json)は先攻敗北を観測した93セルの最初の敗局seedを固定。最初の先攻自由着手で79セルは複数合法手、14セルは1手。後者も同じ敗局の後続に複数合法手がある。既選択手と全合法手・状態を保存したが、別手の有効性は調べていない。新規試験を自動起動しない。

初期理論値UNKNOWNと、既存の52着手／43着手の局所証明・未証明親・有限手数の反証／予算停止を従来の範囲で保持する。6右の0勝条件を無期限の必敗へ変えない。全4初手・14応手の旧被覆は[017結果](V010_BALANCE017_RESULTS_20261018.md)、全過去記録の索引照合は[coverage receipt](v010-balance019/coverage-receipt.json)と[証明義務照合](v010-balance019/coverage-obligations.json)を参照。

## 再監査と次の扱い

```sh
python3 tools/v010-balance019/reaudit.py doc/v010-balance019/completed 5015ee1f968a3ced31a83648524b9ac0132e3369 bf6e7724b663c2918866b5c9637f6547efe7e484 39241595646
python3 tools/v010-balance019-results/analyse.py
node tools/v010-balance019-results/frontier.cjs
python3 tools/v010-balance019-results/report.py
git diff --exit-code -- doc/v010-balance019/results-analysis.json doc/v010-balance019/loss-frontier.json doc/V010_BALANCE019_RESULTS_20261020.md
```

Gitの完全履歴を取得し、旧全16監査と019結果監査を維持する。固定019ソース・plan・manifestを編集せず、結果branchの旧文書でmainや研究branchを巻き戻さない。原記録のディレクトリだけ同一blobで取り込む。中断したjobの再探索・run_attempt>1を自動起動しない。

この時点でmain統合は許可されていない。次の調査は未計画・未起動。019の結果から候補を選ぶ場合も、別ID・別seed・別manifestによる探索／独立確認を区別する。人間の全技能水準や別系列AIへ一般化しない。

本文 © 2026 nkkmd and Bao Nakakamado contributors、[CC BY-SA 4.0](../LICENSE-CC-BY-SA-4.0.txt)。
