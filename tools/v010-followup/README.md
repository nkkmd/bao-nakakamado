# 全開局と必勝ルートの追加調査

[追加計画](../../doc/V010_OPENING_PROOF_PLAN_20261012.md)。公開規則・AIと以前のmanifestを変更しない研究用実装。

```sh
python3 tools/v010-followup/extract-inputs.py
node --test tools/v010-followup/check.test.cjs
node tools/v010-followup/freeze.cjs
node tools/v010-followup/study.cjs manifest
```

`policies.cjs` は現行探索と現行特徴計算を共有し、3つの固定方針を提供する。別重みは学習・採用を意図しない診断用。`registry.cjs` は全14初手／応手と自由な初期局面、13の証明対象を作る。

`prover.cjs` は評価関数を使わないAND/OR探索。`book.cjs` の順序ヒントは合法手を削除せず、勝ちのcacheは再検証した証明だけ。`PROVED` は全応答を含む証明を要求し、予算停止を引き分けへ変換しない。初期局面の合成は、その初手直後に一致する部分証明だけを使う。

`study.cjs matrix <out> <shard>` と `study.cjs proof <out> <rootIndex> <target>` は本計測。本計測前にmanifestを固定する。完成組／証明jobの再呼出しは新規探索0で監査し、中断した.startedだけのjobはHOLD。全32計測shardと26証明jobが揃ったときだけ `study.cjs aggregate <out>` を使う。

保存ZIPが複数に分かれた場合、`preservation-receipt.json` の各files/pieces順にentry bytesを連結し、元ファイルのSHA-256を検査する。原ファイルが45MiB以内ならそのまま同名entryで保存する。

コードはMIT、説明文はCC BY-SA 4.0。元ゲーム由来の探索・評価器の表示は既存ソースに保持する。
