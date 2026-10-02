# ニャクア・次手3個投入案の検証

調査ID：NYAKUA-THREE-20261002。調査当時の公開v0.7.0を対照にした隔離試験の再現用です。調査は完了し、3個投入案は[現行v0.8.0へ採用済み](../../doc/NYAKUA_THREE_ADOPTION_20261002.md)です。コードと保存結果の `current` は旧v0.7.0、`three` は3個投入案を指します。現行実装との照合は `node tools/next-turn-live-check.cjs 100 /tmp/next-turn-live-results.json` で行います。

奪取分は別確保し、次の自分の手で通常ハンド2個と一緒に同じ合法穴へ投入します。通常ハンド1個なら合計2個、0個なら確保分1個。確保分がなければ通常1個。捕獲2回以上なら相手の通常ハンドから1個奪い、通常ハンドの最後の1個と確保分を保護します。両者の通常ハンド・確保分がすべて0で共通MTAJIへ移行します。

```sh
node --test prototype/four-row.test.cjs
node tools/nyakua-three/check.cjs tools/nyakua-three/results/checks.json
node tools/nyakua-three/run.cjs self-random tools/nyakua-three/results/self-random
node tools/nyakua-three/run.cjs self-search4 tools/nyakua-three/results/self-search4
node tools/nyakua-three/run.cjs cross-1 tools/nyakua-three/results/cross-1
node tools/nyakua-three/run.cjs proof tools/nyakua-three/results/proof
```

正式試験はActionsで実施済みです。再実行時は自己対戦8方針・交差対戦3組・初期必勝探索を実行します。完了後、全taskを集めて `node tools/nyakua-three/report.cjs` で集約・代表棋譜再構築・日本語報告を生成します。正式実行にはNode v24.19.0を使用します。第4引数で局数（proofではノード予算）を変更でき、正式結果と混在させないでください。

同じコード・task・局数なら20単位ごとのチェックポイントから再開します。コードや条件が変わったチェックポイントは署名照合で拒否します。Actionsの再実行時には前回artifactを作業ディレクトリへ戻せば未完了部分だけ再開できます。

`engine.cjs` は固定した元エンジンの4か所だけを検査付きで変更してロードします。別会計方式のoracleは、元エンジンに通常ハンドと確保分の合計を渡し、投入数だけを指定して、処理後に残数を分割します。盤上の種まき規則そのものの独立実装ではありません。

総KETE64個・非負整数は全着手で検査。反復・512回安全上限・400手は通常勝敗から分離します。必勝探索の末端UNKNOWNは未確定であり、不在証明ではありません。公開AIや人間の最善対戦を再現する調査ではありません。

## 原記録の再現と現行実装の検証

v0.8.0では `prototype/steal.js` が別確保対応へ変わりました。ゲーム規則の照合は成功していますが、研究実行時とバイト列が異なるため、保存済みチェックポイントの署名はそのままでは一致せず、`audit.cjs` のソース検査も拒否します。原記録を再検証する場合は、HEADから別の作業ツリーを作り、各taskの `summary.json` の `metadata.commit` と `metadata.hashes` に指定された7ソースを復元してください。正式対局の実行commitは `1c266fe03581865064521910d0bc9fb2740d471e` です。

`report.cjs` は調査当時の比較報告を再生成します。現在の文書の冒頭にあるv0.8.0採用済みの案内は、再生成後に維持してください。現行v0.8.0の検証は[試作README](../../prototype/README.md)の手順で行い、調査時の対照 `current` と区別します。
