# 初期配置の分割必勝探索002

[固定計画](../../doc/V010_INITIAL_PROOF_PLAN_20261012.md)。全14開幕2手後と主経路の早い5局面を両目標から調べる38job。新しいAI対局は行わない。

```sh
node --test tools/v010-certainty/check.test.cjs
node tools/v010-certainty/freeze.cjs
node tools/v010-certainty/study.cjs manifest
```

`study.cjs job <out> <rootIndex> <target>` は正式探索。完成記録は新規探索0件で再利用し、中断記録はHOLD。全38jobが揃ってから `study.cjs aggregate <out>` を使う。初期配置への合成には相手の全応答を網羅した、開始状態の一致する証明を要求する。

PROVEDには独立検証された通常勝利の証明木がある。未証明・予算停止は公平・互角・勝ち戦略不在の証明ではない。保存形式は前回の原bytes・分割片SHA方式を使う。

コードはMIT、説明文はCC BY-SA 4.0。
