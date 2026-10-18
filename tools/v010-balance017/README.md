# 調査017：実戦バランス

[固定計画](../../doc/V010_BALANCE017_PLAN_20261018.md)／[既存記録の再整理](../../doc/V010_BALANCE_REASSESSMENT_20261018.md)。公開コード・旧記録は変更しない。

`reanalyse.py` は原ZIPをSHA照合して既存10,240局と保存済み001を新しいJSONへ集計する。`verify-reanalysis.py` は別のPython集計で件数・重複・seed・最初の分岐を照合する。`report.py` はその結果と既存016比較から報告書を再生成する。新規対局・証明探索0。

```sh
python3 tools/v010-balance017/reanalyse.py
python3 tools/v010-balance017/verify-reanalysis.py
python3 tools/v010-balance017/report.py
node --test tools/v010-balance017/check.test.cjs
node tools/v010-balance017/freeze.cjs
node tools/v010-balance017/study.cjs manifest
```

`freeze.cjs` は試走6条件と全14監査receiptを読み、再現可能なmanifestを封印する。既存manifestがある場合は一致確認だけで変更しない。

`pilot.cjs <new-directory>` は新しい運用試走12局を実行する入口。既存pilotを再実行しない。`study.cjs shard <directory> <index>` は正式な新規計測なので監査に使わない。正式起動は固定workflowの専用message、同時4、run_attempt=1に限定する。完成組は通常再生後に再利用し、中断markerがある未完組はHOLD。手動再起動やmarker削除をしない。

`study.cjs aggregate <complete-directory>` は全予定原記録とreceiptを通常再生して再集計するだけ。`reaudit.py <completed-directory> <resultsCommit> <sourceSHA> <runID>` は保存ZIPを復元し原bytes・通常再生・summary一致を独立に確認する。正式結果がまだない段階では実行できない。自然開幕の確認と全14強制開幕の条件付きscreenを混ぜない。

コードはMIT。説明文はCC BY-SA 4.0。元探索の権利表示を維持する。
