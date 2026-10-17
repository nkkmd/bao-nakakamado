# 追加調査016 起動記録

2026年10月18日（Asia/Tokyo）。基準main `d6d5bb5a481c38d212c24b674e132dd31401ff91`。[計画](V010_PARTITION016_PLAN_20261018.md)／[manifest](../tools/v010-partition016/manifest.json)／[比較](v010-partition016/comparison.json)／[独立照合](v010-partition016/verify-comparison.json)／[選択](v010-partition016/selection.json)。

正式起動前の準備記録。全13旧記録監査、最終8検証、104比較原ファイルの独立照合、manifest固定を通した後、研究branchと事前作成した結果branchが同じsourceを指すことを確認して一度だけ起動する。起動後にsource SHA・digest・run ID・日時を追記する。現段階では正式結果を主張しない。

研究branch `research/v010-partition-016-20261018`、結果branch `results/v010-partition-study-016`。完了済み旧jobの再実行はしない。中断jobはHOLD、完成済み原記録だけを監査して探索0で再利用する。Actions再試行を禁止する。

初期配置の必勝側・公平性はUNKNOWN。今回の局所証明と混同しない。公開ルール・初期配置・公開AIは変更しない。

## 正式起動の追記

2026年10月18日07時27分15秒JST（run作成日時、UTC `2026-10-17T22:27:15Z`）。[PR #53](https://github.com/nkkmd/bao-nakakamado/pull/53)、[正式run 39075132061](https://github.com/nkkmd/bao-nakakamado/actions/runs/39075132061)、attempt 1。

- source commit: `d69eeeab2db780a9a3522fce02c37925151e6420`
- source tree: `38b9eb495fb5c2c206ec38c5af1010e243900cb9`
- 固定manifest digest: `c96d769fb97c9b88a0bfb7884200bf4b7cdb642b6dcf7a79dcffe99d12c2d70a`
- 事前全13監査・最終8検証・比較104原ファイルの独立照合・固定manifest再読込み検証：全成功。
- GitHubとローカルの139差分ファイルのtree一致を確認。結果branchはsourceと同じcommitから事前作成し、その後研究branchをsourceへ進めて一度だけ起動した。

本追記は正式source確定後の起動記録で、固定計画・manifest・入力・方法を変更しない。正式runは旧記録監査→preflight→16目標→全階層集計→原記録保存の順に進む。起動時点では正式結果未確定。中断・失敗の場合は原記録を確認し、完成済みjobだけを再利用、未完はHOLDとする。無断のrun再試行・追加探索をしない。結果commitと独立再監査receiptは完了後に追記する。

## 完了の追記

正式runは2026年10月18日07時56分55秒JSTに全31job成功で完了。結果commit `e6cdfac8627df8e94ce81465ee6169bf600185a8` に130原ファイル・summary・receiptを保存した。PROVED1・WALL_BUDGET14・UNKNOWN1、新規1局面で後攻43着手以内。上位合成と初期配置は未確定。[結果報告](V010_PARTITION016_RESULTS_20261018.md)と[独立再監査receipt](v010-partition016/independent-reaudit.json)を参照。実際の統合・CIはPR #53を基準とする。元の起動記録・source・固定計画を保持する。
