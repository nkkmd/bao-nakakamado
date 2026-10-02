# ニャクア・次手3個投入案の検証

調査ID：NYAKUA-THREE-20261002。公開v0.7.0を変更しない隔離試験です。

奪取分は別確保し、次の自分の手で通常ハンド2個と一緒に同じ合法穴へ投入します。通常ハンド1個なら合計2個、0個なら確保分1個。確保分がなければ通常1個。捕獲2回以上なら相手の通常ハンドから1個奪い、通常ハンドの最後の1個と確保分を保護します。両者の通常ハンド・確保分がすべて0で共通MTAJIへ移行します。

```sh
node --test prototype/four-row.test.cjs
node tools/nyakua-three/check.cjs tools/nyakua-three/results/checks.json
node tools/nyakua-three/run.cjs self-random tools/nyakua-three/results/self-random
node tools/nyakua-three/run.cjs self-search4 tools/nyakua-three/results/self-search4
node tools/nyakua-three/run.cjs cross-1 tools/nyakua-three/results/cross-1
node tools/nyakua-three/run.cjs proof tools/nyakua-three/results/proof
```

正式試験はActionsで自己対戦8方針・交差対戦3組・初期必勝探索を実行します。完了後、全taskを集めて `node tools/nyakua-three/report.cjs` で集約・代表棋譜再構築・日本語報告を生成します。正式実行にはNode v24.19.0を使用します。第4引数で局数（proofではノード予算）を変更でき、正式結果と混在させないでください。

同じコード・task・局数なら20単位ごとのチェックポイントから再開します。コードや条件が変わったチェックポイントは署名照合で拒否します。Actionsの再実行時には前回artifactを作業ディレクトリへ戻せば未完了部分だけ再開できます。

`engine.cjs` は固定した元エンジンの4か所だけを検査付きで変更してロードします。別会計方式のoracleは、元エンジンに通常ハンドと確保分の合計を渡し、投入数だけを指定して、処理後に残数を分割します。盤上の種まき規則そのものの独立実装ではありません。

総KETE64個・非負整数は全着手で検査。反復・512回安全上限・400手は通常勝敗から分離します。必勝探索の末端UNKNOWNは未確定であり、不在証明ではありません。公開AIや人間の最善対戦を再現する調査ではありません。
