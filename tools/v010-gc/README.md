# 証明データ整理・遡及探索003

[固定計画](../../doc/V010_PROOF_GC_PLAN_20261012.md)。新しいAI対戦は0局。21→19→17手目、全14開幕の順に34証明jobを実行する。

```sh
node --expose-gc --test tools/v010-gc/check.test.cjs
node tools/v010-gc/freeze.cjs
node tools/v010-gc/study.cjs manifest
```

`study.cjs job <out> <index> <target> [earlierDir]` が本探索。index14は21手目、15は19手目、16は17手目、0〜13は全開幕。後続jobは指定の以前の段階の全原記録を要求し、証明だけを再利用する。完成job再呼出しは新規探索0で依存SHAも照合し、中断はHOLD。

全34jobが揃ってから `study.cjs aggregate <out>` を使う。`store.cjs` は探索中の証明とcacheから参照される部分木を保持し、到達できないノードを除去する。必要な証明が容量を超えると未証明に止める。

保存は従来の原bytes・分割片SHA方式。未証明は公平・引き分け・必勝不在の証拠ではない。

コードはMIT、説明文はCC BY-SA 4.0。
