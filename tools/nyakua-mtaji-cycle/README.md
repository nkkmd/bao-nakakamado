# 案AのMTAJI循環の追加分析

調査日：2026年10月6日（Asia/Tokyo）。Node v24.19.0、外部依存なし。固定点は `a0a6514f54a53b463f9c514f0b278400fa6662cd`。公開規則・AI・過去の原試験は変更しません。

## 再現

```sh
node tools/nyakua-mtaji-cycle/run.cjs structure
node tools/nyakua-mtaji-cycle/run.cjs alternatives
node tools/nyakua-mtaji-cycle/run.cjs continuations
node tools/nyakua-mtaji-cycle/check.cjs
```

- `ring.cjs` は既存エンジンを呼ばず、16穴の非捕獲リレーを計算します。全Baoの合法手・捕獲・takasiaの実装ではありません。
- `structure` は案B比較の案A対照11異常棋譜を全再生し、同じ40手の経路と、独立した周期272の種まき計算を照合します。全165個の1石移動、合法な108変更、追加を省いた同じ棋譜の再生、根の4手先の全幅評価を記録します。近傍・反実仮想は到達性の証明や勝率試験ではありません。
- `alternatives` は有限な3手の直後を、それぞれ既存のAND/OR探索で調べます。各深さ10万ノード、各手45秒、最大14手。保存済みの個別完了結果は根・依存SHA-256・深さ・ノード予算が一致する場合だけ再利用します。UNKNOWNと上限は勝敗として確定しません。
- `continuations` は有限な3手を根に固定し、調査search4同士で各1局だけ続けます。seed `2026100601` の単一共通乱数列、最大200追加手。新しい探索的な説明用棋譜で、以前の正式対局へ合算せず、勝率や必勝の証拠にしません。
- `check` は別の既知の周期100・284・32,184の独立再現、既存エンジンとの896境界状態照合、有限計算と継続3例の再生を検査します。A周期の272境界照合は `structure` が行います。

出力は `results/`。依存ソースと入力棋譜のSHA-256は `structure.json` に保存しています。コード・出力の一覧とSHA-256は `results/receipt.json` に保存します。未完了の探索深さは再計算します。短い固定局面の診断なのでローカルで実行し、新規の大規模対局は実施していません。

結果と限界は[追加調査報告](../../doc/NYAKUA_A_MTAJI_CYCLE_FOLLOWUP_20261006.md)を参照してください。コードは[MIT](../../LICENSE)、説明文は © 2026 nkkmd and Bao Nakakamado contributors、[CC BY-SA 4.0](../../LICENSE-CC-BY-SA-4.0.txt)。基礎資料の出典は既存の[ライセンス記録](../../LICENSES.md)を維持しています。
