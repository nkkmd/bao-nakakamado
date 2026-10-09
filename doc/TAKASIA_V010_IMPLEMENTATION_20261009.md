# takasia 対応：Bao Nakakamado v0.10.0

記録日：2026年10月9日（日本時間）。対象：Bao Nakakamado v0.10.0。

## 採用方針

Bao Nakakamado の原型である Bao la Kiswahili 側で正式採用された takasia を、Bao Nakakamado の基礎規則として採用する。独自規則 NYAKUA は v0.9.0 の案Aを維持し、takasia に独自の意味変更を加えない。

参照基準は `bao-la-kiswahili-ja` v0.2.0 と `bao-la-kiswahili-game` のルール改訂 `BAO-RULES-V0.2.0-TAKASIA-001`。原型側の E30 固定局面・成立条件・例外・1手だけの有効期間・relay sowing の停止を受入条件とする。

## 実装

現行公開経路は次の3ファイル。

- `prototype/end-pit-engine.js`
- `prototype/end-pit-rules.js`
- `prototype/app.js`

盤面状態に `takasia: null` または `{ player, index }` を明示して保持する。石配置から履歴を推測しない。

`detectTakasia(state, attacker, previousMove)` は MTAJI の takata が正常終了した盤面だけを対象にする。防御側に最初の蒔きによる捕獲手がなく、攻撃側の最初の蒔きによる捕獲対象が重複除去後ちょうど1穴で、次の例外に該当しない場合だけ、防御側の次の1手に対象を設定する。

- 対象穴が1個だけ
- 防御側前列の唯一の占有穴
- 防御側前列で唯一2個以上ある穴
- 所有中のNYUMBA

所有を失ったNYUMBA位置は通常穴として扱う。

有効なtakasia対象があるMTAJI手では、対象穴からtakataを開始できない。種まきの途中で対象穴を通過する場合は通常どおり1個置いて続行する。最後の1個が対象穴へ入った場合は、その到達後の個数にかかわらずrelay sowingを停止する。制約は防御側が1手を終えた時点で失効し、その手自身が新しいtakasiaを成立させた場合だけ反対側へ新しい対象を設定する。

## NYAKUAとの関係

NYAKUA案AはNAMUAだけ、takasiaはMTAJIだけで作用する。したがって同じ着手の終点処理で両規則を競合させない。

NYAKUAは従来どおり、NAMUAで一手に捕獲2回以上かつ通常処理完了時に自分のハンド1個以上・相手2個以上なら、双方のハンドから1個ずつ蒔き終点へ計2個追加し、そのまま着手を終了する。相手の最後の1個を保護する。

## 簡易コンピューター

簡易コンピューターは `NakakamadoSteal.moveVariants()` と `apply()` を使って候補手を作るため、v0.10.0の合法手生成とtakasia停止をそのまま共有する。対象穴からの違法開始手は候補に入らない。

一手後評価には従来の前列KETE差・総KETE差・捕獲加点に加え、相手の次手へtakasiaを成立させた局面へ小さい加点を行う。探索AIや学習済みモデルはv0.10.0にはまだ搭載しない。

## 棋譜

棋譜は次へ更新する。

- format: `bao-nakakamado-prototype`
- version: `9`
- rulesVersion: `0.10.0`
- baseRulesVersion: `0.2.0`
- baseRulesRevision: `BAO-RULES-V0.2.0-TAKASIA-001`
- variantRule: `takasia-namua-end-pit-two-protect-last-two-row-ring-hand22`
- takasia: `true`

各着手に `takasiaBefore` と `takasiaAfter` を保存し、最終局面にも状態を保持する。version 8／v0.9.0以前の棋譜は現行棋譜として受理せず、過去棋譜にtakasiaを自動適用しない。

## 検証

`prototype/takasia.test.cjs` に原型側E30を移し、少なくとも次を固定回帰とする。

1. 初期状態は `takasia: null`。
2. E30でNorthの本人視点前列index 3（a4相当）を対象として検出する。
3. 対象穴からMTAJI takataを開始できない。
4. E30の合法応手の中に、対象穴でrelay sowingを停止する手が存在する。
5. 制約は1手で消費され、新規成立時だけ置き換わる。
6. 棋譜version 9の往復再生が一致する。
7. v0.9.0／version 8棋譜を現行規則として誤受理しない。

`tools/end-pit-live-check.cjs` ではNYAKUAの従来物理遷移との比較を、takasiaが物理的な差を生じない範囲で継続する。takasia制約下は現行エンジンの不変条件・総数保存・棋譜再生を確認する。`tools/end-pit-browser-check.cjs` では実ブラウザーでv0.10.0表示、E30対象穴の開始不可、takasia停止経路の存在、簡易コンピューターの先後、棋譜version 9を確認する。

## 保存方針

- `trials/v0.8.0/` は原bytesの保存版として変更しない。
- v0.9.0の採用記録・研究結果は当時の条件のまま保持する。
- v0.8.0用探索AI・学習済みモデルの結果をv0.10.0へ読み替えない。
- v0.10.0の探索コンピューター対応は別工程とする。
