# Bao Nakakamado の用語

対象：現行試作 v0.10.0。更新日：2026年10月9日。

## NYAKUA（ニャクア）

NYAKUAはBao Nakakamado独自のハンド奪取規則の名称です。2026年9月30日に採用し、日本語ではニャクアと読みます。Bao Nakakamado・NYAKUAの考案者はnkkmd、初公開日は2026年9月30日。[変更履歴](ORIGIN_AND_HISTORY.md)に根拠を保存しています。

v0.10.0でもv0.9.0案Aを維持します。NAMUAの一手で捕獲2回以上、通常処理完了時に自分のハンド1個以上・相手2個以上なら、双方から1個ずつ蒔き終わりの穴へ計2個追加します。相手の最後の1個は保護。一手につき一度、追加後の捕獲・種まき・終点再判定はありません。即時終局・安全停止した手では発動しません。

## takasia（タカシア）

takasiaはBao la Kiswahili側で正式採用されたMTAJIの規則で、v0.10.0からBao Nakakamadoの基礎規則として採用します。

MTAJIのtakata終了後、所定の成立条件を満たすと、防御側の次の1手だけ特定の前列穴が対象になります。

- 対象穴からtakataを開始できません。
- 種まき途中で通過するときは通常どおり1個置いて続行します。
- 最後の1個が対象穴へ入れば、その時点の個数にかかわらずrelay sowingを停止します。
- 制約はその1手で失効し、新規成立した場合だけ反対側へ新しい対象を設定します。

対象穴が1個だけ、防御側前列の唯一の占有穴、防御側前列で唯一2個以上ある穴、所有中NYUMBAの場合は対象外です。所有を失ったNYUMBA位置は通常穴として扱います。

## 主な用語

| 用語 | v0.10.0での意味 |
|---|---|
| ハンド | 初期22個から盤へ未投入のKETE。NAMUA開始時投入とNYAKUAの追加で減る |
| NAMUA | ハンドを使う段階。NYAKUAが作用する |
| MTAJI | 両者のハンドが0になった後、盤上だけで指す段階。takasiaが作用する |
| takata | 一着手を通じて捕獲しない手 |
| relay sowing | 終点のKETEを持ち上げ、同じ着手で種まきを続けること |
| NYUMBA | 各人の前列5番にある特別な穴。所有状態を別に持つ |
| 終点2個追加 | NYAKUA発動時、双方のハンドから各1個を通常処理後の終点へ置くこと |
| 確保分・次手3個投入 | 旧v0.8.0の規則。現行では使わない |

両者のハンドが0になると、現在のNAMUA着手を完了して共通MTAJIへ移ります。NAMUAからMTAJIへ移行しただけではtakasiaは成立しません。

## 棋譜

現行棋譜は次の識別情報を使用します。

- format: `bao-nakakamado-prototype`
- version: `9`
- rulesVersion: `0.10.0`
- baseRulesVersion: `0.2.0`
- baseRulesRevision: `BAO-RULES-V0.2.0-TAKASIA-001`
- variantRule: `takasia-namua-end-pit-two-protect-last-two-row-ring-hand22`
- publicAdopted: `true`
- takasia: `true`

各着手の `takasiaBefore` と `takasiaAfter`、最終局面のtakasia状態を保存します。`placed`は開始時投入数、`captures`は捕獲回数、`stolen`はNYAKUAで相手ハンドから取った数、`added`は終点への追加総数、`ownAdded`・`opponentAdded`は各ハンドから追加した数、`endpoint`は追加先です。

安全停止は `adjudication: safety-stop`、`outcome.winner: null` として通常勝敗と区別します。

| ルール版 | 盤・初期ハンド | NYAKUA／基礎規則の主な変更 | 棋譜version |
|---|---|---|---:|
| v0.6.0 | 各人1列・折り返し・12個 | 最後の1個も奪い、通常ハンドへ加算。一穴全投入 | 4 |
| v0.6.1 | 各人1列・折り返し・12個 | 最後の1個を保護し、通常ハンドへ加算。一穴全投入 | 5 |
| v0.7.0 | 各人前後2列・循環・22個 | 最後の1個保護と一穴全投入を固定 | 6 |
| v0.8.0 | 各人前後2列・循環・22個 | 最後の1個と確保分を保護。別確保・次手3個投入 | 7 |
| v0.9.0 | 各人前後2列・循環・22個 | 着手終了後に両ハンドから終点へ2個追加 | 8 |
| **v0.10.0** | **各人前後2列・循環・22個** | **NYAKUA案Aを維持し、基礎規則にtakasiaを追加** | **9** |

旧版・試験版の棋譜を現行棋譜として解釈せず、v0.9.0以前の棋譜へtakasiaを自動適用しません。初期配置と遊び方は[ルールブック](RULEBOOK.md)、実装・配布は[試作README](../prototype/README.md)を参照してください。

## v0.10.0試験用探索の棋譜メタデータ

探索対局もmodeはcomputer、棋譜本体はversion 9です。任意のcomputerフィールドに試験AI ID・releaseId・searchId・evaluatorId・learnedModel:false・difficulty・budgetMs・着手別diagnosticsを記録します。トップレベルpublicAdopted:trueは現行ルールの採用、computer.publicAdopted:falseは試験AIの未採用を意味します。通常のhistory/final/takasia再生はAI診断に依存しません。Worker失敗と、深度0での時間切れ代替を区別して記録します。
