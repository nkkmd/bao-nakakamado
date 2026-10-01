# Bao Nakakamado の用語

## NYAKUA（ニャクア）

2026-09-30に、ハンドからKETEを奪う動作の名称として **NYAKUA** を採用した。日本語の読みは **ニャクア**。初めて説明するときは「NYAKUA（ニャクア、ハンド奪取）」と書く。

現行試作では、NAMUAの一着手で2回以上捕獲し、相手のハンドにKETEが2個以上残っている場合、着手後に相手のハンドからKETEを1個、自分のハンドへ移す。この動作をNYAKUAと呼ぶ。3回以上捕獲しても奪うのは1個で、捕獲が1回以下、相手ハンド0〜1個、MTAJIの着手では発動しない。

盤上のKETEを取る動作は引き続き「捕獲」と呼ぶ。「一穴全投入」は別の動作であり、NYAKUAには含めない。以前の文書にある「ハンド奪取」「KETE奪取」「ハンド間の1個奪取」は、同じ動作を説明する表現である。

2026-10-02、v0.7.0で前列・後列とハンド22個へ戻し、最後の1個保護と一穴全投入を現行仕様として固定した。一穴全投入はNYAKUAに伴うハンド枯渇時の規則であり、奪取動作そのものとは区別する。現行の発動条件は[試作ルール](../prototype/README.md#試作ルール)を参照。

画面の説明、発動表示、着手候補ではNYAKUAを使う。棋譜の `stolen`、イベントの `steal`、既存のファイル名は維持する。v0.6.0では1列・折り返し・ハンド12個へルールを変更したため、棋譜をversion 4とし、`variantRule`を `namua-steal-one-fixed-pit-bulk-one-row-bounce-hand12` に更新した。その時点ではNYAKUAの発動条件自体は変えていない。

v0.6.1では、NYAKUAで相手の最後の1個は奪えない条件を暫定採用した。棋譜はversion 5、`rulesVersion: "0.6.1"`、`nyakuaProtectLast: true`、`variantRule: "namua-steal-one-protect-last-fixed-pit-bulk-one-row-bounce-hand12"` として旧ルールと区別する。

初期配置から終局までの全体の遊び方は、[現行試作のルールブック](RULEBOOK.md)を参照。

v0.7.0の棋譜はversion 6、`rulesVersion: "0.7.0"`、前後列・循環・ハンド22個・総数64個、`nyakuaProtectLast: true`、`nyakuaFixedPitBulk: true`、`variantRule: "namua-steal-one-protect-last-fixed-pit-bulk-two-row-ring-hand22"`。旧1列盤の棋譜と区別する。
