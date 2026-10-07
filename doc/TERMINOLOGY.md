# Bao Nakakamado の用語

対象：現行試作v0.9.0。更新日：2026年10月7日。

## NYAKUA（ニャクア）

NYAKUAは独自のハンド奪取規則の名称です。2026年9月30日に採用し、日本語ではニャクアと読みます。Bao Nakakamado・NYAKUAの考案者はnkkmd、初公開日は2026年9月30日。[変更履歴](ORIGIN_AND_HISTORY.md)に根拠を保存しています。

v0.9.0では、NAMUAの一手で捕獲2回以上、通常処理完了時に自分のハンド1個以上・相手2個以上なら、双方から1個ずつ蒔き終わりの穴へ計2個追加します。相手の最後の1個は保護。一手につき一度、追加後の捕獲・種まき・終点再判定はありません。即時終局・安全停止した手では発動しません。

| 用語 | v0.9.0での意味 |
|---|---|
| ハンド | 初期22個から盤へ未投入のKETE。開始時投入とNYAKUAの追加で減る |
| 終点2個追加 | 双方のハンドから各1個を、通常処理が完了した手の蒔き終わりの穴へ置く |
| 捕獲 | 相手前列の穴のKETEを取る盤上の動作 |
| 連続種まき | 種まきの終点の中身を持ち上げ、同じ着手を続けること。NYAKUA追加後には行わない |
| 確保分・次手3個投入 | 旧v0.8.0の規則。現行v0.9.0では使わない |

両者のハンドが0になると、現在の着手のNAMUA処理を完了して共通MTAJIへ移ります。追加手番や片側だけのMTAJI移行はありません。通常初期局面からハンド枯渇パスは生じません。

## 棋譜

現行formatはbao-nakakamado-prototype、version 8、rulesVersion 0.9.0、variantRule namua-end-pit-two-protect-last-two-row-ring-hand22、publicAdopted trueです。nyakuaEndPitAdd true、nyakuaProtectLast true、nyakuaNextTurnThree false、nyakuaReservedProtected false、nyakuaFixedPitBulk false。

placedは開始時投入数、capturesは捕獲回数、stolenは相手ハンドから取った数、addedは終点へ追加した総数（0か2）、ownAdded・opponentAddedは各ハンドから追加した数、endpointは追加先（非発動はnull）。イベント名はend-pit-add。reserveはハンド、nyakuaReserveは互換用[0,0]、pendingは終局時捕獲保留数です。安全停止はadjudication safety-stop・outcome.winner nullで通常勝敗と区別します。

| ルール版 | 盤・初期ハンド | NYAKUA後の扱い | 棋譜version |
|---|---|---|---:|
| v0.6.0 | 各人1列・折り返し・12個 | 最後の1個も奪い、通常ハンドへ加算。一穴全投入 | 4 |
| v0.6.1 | 各人1列・折り返し・12個 | 最後の1個を保護し、通常ハンドへ加算。一穴全投入 | 5 |
| v0.7.0 | 各人前後2列・循環・22個 | 最後の1個保護と一穴全投入を固定 | 6 |
| v0.8.0 | 各人前後2列・循環・22個 | 最後の1個と確保分を保護。別確保・次手3個投入 | 7 |
| **v0.9.0** | **各人前後2列・循環・22個** | **最後の1個を保護。着手終了後に両ハンドから終点へ2個追加** | **8** |

案A実機試験版は別format bao-nakakamado-nyakua-a-trial、version 1、rulesVersion nyakua-a-trial-001、publicAdopted falseです。旧・試験棋譜を現行棋譜として解釈しません。初期配置と遊び方は[ルールブック](RULEBOOK.md)、実装・配布は[試作README](../prototype/README.md)を参照してください。
